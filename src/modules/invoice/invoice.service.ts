import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, QueryFilter, Types } from 'mongoose';
import { DatabaseService } from '../../database/database.service';
import { calculateDiscounts } from '../../utils/discount-calculator';
import { DailyCounterService } from '../daily-counter/daily-counter.service';
import { DeficitRecord } from '../deficit/deficit.schema';
import { DeficitService } from '../deficit/deficit.service';
import { OutletService } from '../outlet/outlet.service';
import { ProductService } from '../product/product.service';
import { ChangeType } from '../stock-audit/stock-audit.schema';
import { StockAuditLogService } from '../stock-audit/stock-audit.service';
import { StockService } from '../stock/stock.service';
import { TenantService } from '../tenant/tenant.service';
import { CreateInvoiceDto } from './dto/invoice-create.dto';
import { CreateRefundDto } from './dto/invoice-refund.dto';
import {
  DiscountType,
  Invoice,
  InvoiceItem,
  InvoiceType,
  PaymentMethod,
} from './invoice.schema';

interface InsufficientStockDetail {
  productId: string;
  productName: string;
  requestedQuantity: number;
  currentStock: number;
  deficitThreshold: number;
  currentDeficit: number;
  canOverride: boolean;
  overrideBlockReason?: string;
}

@Injectable()
export class InvoiceService {
  constructor(
    @InjectModel(Invoice.name) private invoiceModel: Model<Invoice>,
    @InjectModel(DeficitRecord.name) private deficitModel: Model<DeficitRecord>,
    private databaseService: DatabaseService,
    private stockService: StockService,
    private deficitService: DeficitService,
    private stockAuditLogService: StockAuditLogService,
    private dailyCounterService: DailyCounterService,
    private tenantService: TenantService,
    private outletService: OutletService,
    private productService: ProductService,
  ) {}

  /**
   * Phase 1: Validation - Check idempotency and stock availability
   * Returns existing invoice on replay, 409 if stock insufficient
   */
  async validateAndCheckStock(
    tenantId: string,
    createInvoiceDto: CreateInvoiceDto,
  ): Promise<{
    existingInvoice?: Invoice;
    insufficiencies?: InsufficientStockDetail[];
  }> {
    // Check for existing invoice (idempotency)
    const existing = await this.invoiceModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      clientGeneratedId: createInvoiceDto.clientGeneratedId,
    });

    if (existing) {
      return { existingInvoice: existing };
    }

    // Check stock availability
    const insufficiencies: InsufficientStockDetail[] = [];

    for (const item of createInvoiceDto.items) {
      const currentStock = await this.stockService.findByProductAndOutlet(
        tenantId,
        item.productId.toString(),
        createInvoiceDto.outletId.toString(),
      );

      const currentStockQty = currentStock?.quantity || 0;
      const wouldBeNegative = currentStockQty - item.quantity < 0;

      if (wouldBeNegative) {
        const product = await this.productService.findById(
          tenantId,
          item.productId.toString(),
        );

        // Get total pending deficit for this product at THIS OUTLET (per contract section 14.5)
        // Deficit threshold is enforced per product-outlet combination
        const pendingDeficit = await this.deficitModel.aggregate([
          {
            $match: {
              tenantId: new Types.ObjectId(tenantId),
              productId: item.productId,
              outletId: new Types.ObjectId(createInvoiceDto.outletId),
              status: 'PENDING',
            },
          },
          {
            $group: {
              _id: null,
              totalDeficit: { $sum: '$quantity' },
            },
          },
        ]);

        const currentDeficit = pendingDeficit[0]?.totalDeficit || 0;
        const deficitThreshold = product?.deficitThreshold || 10;

        // Calculate new deficit this transaction would create
        const newDeficitFromThisTransaction = Math.abs(
          Math.min(0, currentStockQty - item.quantity),
        );

        // Total pending deficit AFTER this transaction would be:
        const projectedTotalDeficit =
          currentDeficit + newDeficitFromThisTransaction;

        // Can override ONLY if projected total <= threshold
        // If threshold is already met or would be exceeded, block the override
        const canOverride = projectedTotalDeficit <= deficitThreshold;

        insufficiencies.push({
          productId: item.productId.toString(),
          productName: item.productName,
          requestedQuantity: item.quantity,
          currentStock: currentStockQty,
          deficitThreshold,
          currentDeficit,
          canOverride,
          overrideBlockReason: !canOverride
            ? `Deficit threshold (${deficitThreshold}) would be exceeded by this transaction. Current pending deficit: ${currentDeficit}. New deficit from this sale: ${newDeficitFromThisTransaction}. Total would be: ${projectedTotalDeficit}.`
            : undefined,
        });
      }
    }

    return {
      insufficiencies: insufficiencies.length > 0 ? insufficiencies : undefined,
    };
  }

  /**
   * Phase 2: Create invoice with atomic transaction
   * Locks abbreviations on first invoice, handles stock deduction, creates deficits
   */
  async create(
    tenantId: string,
    createInvoiceDto: CreateInvoiceDto,
  ): Promise<Invoice> {
    return this.databaseService.executeInTransaction(
      async (session: ClientSession) => {
        // Double-check for duplicate clientGeneratedId (transaction safety)
        const existing = await this.invoiceModel
          .findOne({
            tenantId: new Types.ObjectId(tenantId),
            clientGeneratedId: createInvoiceDto.clientGeneratedId,
          })
          .session(session);

        if (existing) {
          return existing;
        }

        // Get tenant and outlet for snapshots
        const tenant = await this.tenantService.findById(tenantId);
        const outlet = await this.outletService.findById(
          tenantId,
          createInvoiceDto.outletId.toString(),
        );

        // Lock abbreviations if not already locked (first invoice for business)
        let abbreviationsLocked = false;
        if (!tenant.abbrLocked) {
          await this.tenantService.updateLockAbbr(tenantId, true, session);
          abbreviationsLocked = true;
        }
        if (!outlet.abbrLocked) {
          await this.outletService.updateLockAbbr(
            tenantId,
            createInvoiceDto.outletId.toString(),
            true,
            session,
          );
          abbreviationsLocked = abbreviationsLocked || true;
        }

        // Calculate totals and prepare items using discount calculator
        const items: InvoiceItem[] = [];
        const gstEnabled = createInvoiceDto.gstEnabled ?? tenant.gstEnabled;

        const calcInput = createInvoiceDto.items.map((it) => ({
          unitPrice: Number(it.unitPrice),
          quantity: Number(it.quantity),
          gstRate: Number(it.gstRate),
          itemDiscountType: (it as any).itemDiscountType || 'NONE',
          itemDiscountValue: (it as any).itemDiscountValue || 0,
        }));

        const calc = calculateDiscounts(
          calcInput,
          (createInvoiceDto as any).billDiscountType || 'NONE',
          (createInvoiceDto as any).billDiscountValue || 0,
          gstEnabled,
        );

        let subtotal = calc.subtotal;
        let totalGstAmount = calc.totalGstAmount;
        const grandTotal = calc.grandTotal;

        for (let idx = 0; idx < createInvoiceDto.items.length; idx++) {
          const item = createInvoiceDto.items[idx];
          const r = calc.items[idx];

          items.push({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            gstAmount: r.gstAmount,
            lineTotal: r.lineTotal,
            overridden: item.override ?? false,
            itemDiscountType:
              (item as any).itemDiscountType || DiscountType.NONE,
            itemDiscountValue: (item as any).itemDiscountValue || 0,
            itemDiscountAmount: r.itemDiscountAmount,
          });
        }

        // Get invoice number from Daily Counter
        // IMPORTANT: Pass session to ensure counter increment is atomic within transaction
        const invoiceNumber = await this.dailyCounterService.incrementAndGet(
          createInvoiceDto.outletId,
          new Types.ObjectId(tenantId),
          outlet.outletAbbr,
          session,
        );

        // Create invoice document
        const invoice = new this.invoiceModel({
          tenantId: new Types.ObjectId(tenantId),
          outletId: createInvoiceDto.outletId,
          invoiceNumber,
          clientGeneratedId: createInvoiceDto.clientGeneratedId,
          items,
          subtotal,
          totalGstAmount,
          grandTotal,
          billDiscountType:
            (createInvoiceDto as any).billDiscountType || DiscountType.NONE,
          billDiscountValue: (createInvoiceDto as any).billDiscountValue || 0,
          billDiscountAmount: (calc as any).billDiscountAmount || 0,
          paymentMethod: createInvoiceDto.paymentMethod,
          customerName: createInvoiceDto.customerName,
          customerPhone: createInvoiceDto.customerPhone,
          gstEnabled: createInvoiceDto.gstEnabled ?? tenant.gstEnabled,
          tenantGstNumber: createInvoiceDto.gstEnabled
            ? tenant.gstNumber
            : undefined,
          // Snapshots for audit trail
          businessName: tenant.businessName,
          businessAbbr: tenant.businessAbbr,
          outletName: outlet.outletName,
          outletAbbr: outlet.outletAbbr,
          abbreviationsLocked,
          isDeleted: false,
        });

        // Deduct stock and create deficits
        for (const item of createInvoiceDto.items) {
          const currentStock = await this.stockService.findByProductAndOutlet(
            tenantId,
            item.productId.toString(),
            createInvoiceDto.outletId.toString(),
            session,
          );

          const currentQty = currentStock?.quantity || 0;
          // new Quantity after deduction, ensuring it doesn't go below 0
          const newQuantity = Math.max(currentQty - item.quantity, 0);
          // Calculate deficit quantity that needs to be created (if any)
          const deficitQuantity = Math.max(item.quantity - currentQty, 0);

          // Update stock
          await this.stockService.decrementStock(
            tenantId,
            item.productId.toString(),
            createInvoiceDto.outletId.toString(),
            item.quantity,
            session,
          );

          // Create audit log
          await this.stockAuditLogService.create(
            tenantId,
            item.productId.toString(),
            createInvoiceDto.outletId.toString(),
            currentQty,
            newQuantity,
            ChangeType.SALE,
            invoice._id,
            session,
          );

          // Create deficit record for the amount that could not be fulfilled
          if (deficitQuantity > 0) {
            await this.deficitService.create(
              tenantId,
              item.productId.toString(),
              createInvoiceDto.outletId.toString(),
              deficitQuantity,
              invoice._id,
              session,
            );
          }
        }

        return invoice.save({ session });
      },
    );
  }

  async findById(tenantId: string, invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoiceModel.findOne({
      _id: new Types.ObjectId(invoiceId),
      tenantId: new Types.ObjectId(tenantId),
      isDeleted: false,
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async findByNumber(
    tenantId: string,
    invoiceNumber: string,
  ): Promise<Invoice> {
    const invoice = await this.invoiceModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      invoiceNumber,
      isDeleted: false,
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  /**
   * Find invoices with filters and pagination
   */
  async findWithFilters(
    tenantId: string,
    filters: {
      page?: number;
      limit?: number;
      dateFrom?: Date;
      dateTo?: Date;
      invoiceNumber?: string;
      paymentMethod?: PaymentMethod;
      gstEnabled?: boolean;
      outletId?: string;
      productId?: string;
      invoiceType?: string;
    } = {},
  ): Promise<{ data: Invoice[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 20,
      dateFrom,
      dateTo,
      invoiceNumber,
      paymentMethod,
      gstEnabled,
      outletId,
      productId,
      invoiceType,
    } = filters;

    const skip = (page - 1) * limit;

    const query: QueryFilter<Invoice> = {
      tenantId: new Types.ObjectId(tenantId),
      isDeleted: false,
    };

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = dateFrom;
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endOfDay;
      }
    }

    // Invoice number filter
    if (invoiceNumber) {
      query.invoiceNumber = { $regex: invoiceNumber, $options: 'i' };
    }

    // Payment method filter
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    // GST enabled filter
    if (gstEnabled !== undefined) {
      query.gstEnabled = gstEnabled;
    }

    // Outlet filter
    if (outletId) {
      query.outletId = new Types.ObjectId(outletId);
    }

    // Product filter
    if (productId) {
      query['items.productId'] = new Types.ObjectId(productId);
    }

    // Invoice type filter
    if (invoiceType && invoiceType !== 'ALL') {
      query.invoiceType = invoiceType as any;
    }

    const data = await this.invoiceModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await this.invoiceModel.countDocuments(query);

    return { data, total, page, limit };
  }

  async findByOutlet(tenantId: string, outletId: string): Promise<Invoice[]> {
    return this.invoiceModel.find({
      tenantId: new Types.ObjectId(tenantId),
      outletId: new Types.ObjectId(outletId),
      isDeleted: false,
    });
  }

  async findByPaymentMethod(
    tenantId: string,
    paymentMethod: PaymentMethod,
  ): Promise<Invoice[]> {
    return this.invoiceModel.find({
      tenantId: new Types.ObjectId(tenantId),
      paymentMethod,
      isDeleted: false,
    });
  }

  async softDelete(tenantId: string, invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoiceModel.findOneAndUpdate(
      {
        _id: invoiceId,
        tenantId: new Types.ObjectId(tenantId),
        isDeleted: false,
      },
      { isDeleted: true },
      { new: true },
    );

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async findRefundsByOriginalInvoice(
    tenantId: string,
    originalInvoiceId: string,
  ): Promise<any[]> {
    return this.invoiceModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        originalInvoiceId: new Types.ObjectId(originalInvoiceId),
        isDeleted: false,
        invoiceType: InvoiceType.REFUND,
      })
      .lean();
  }

  async findOriginalInvoiceSummary(
    tenantId: string,
    originalInvoiceId: string,
  ) {
    return this.invoiceModel
      .findOne({
        _id: new Types.ObjectId(originalInvoiceId),
        tenantId: new Types.ObjectId(tenantId),
      })
      .select('_id invoiceNumber createdAt')
      .lean();
  }

  async createRefund(
    tenantId: string,
    originalInvoiceId: string,
    dto: CreateRefundDto,
  ): Promise<{ invoice: Invoice; replayed: boolean }> {
    const existing = await this.invoiceModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      clientGeneratedId: dto.clientGeneratedId,
    });
    if (existing) {
      return { invoice: existing, replayed: true };
    }

    const originalInvoice = await this.invoiceModel.findOne({
      _id: new Types.ObjectId(originalInvoiceId),
      tenantId: new Types.ObjectId(tenantId),
      isDeleted: false,
      invoiceType: InvoiceType.SALE,
    });

    if (!originalInvoice) {
      throw new BadRequestException(
        'Original SALE invoice not found or is deleted.',
      );
    }

    if (!originalInvoice.invoiceNumber) {
      throw new ConflictException('This invoice has not finished syncing.');
    }

    const existingRefunds = await this.invoiceModel.find({
      tenantId: new Types.ObjectId(tenantId),
      originalInvoiceId: new Types.ObjectId(originalInvoiceId),
      invoiceType: InvoiceType.REFUND,
      isDeleted: false,
    });

    const requestedItems = dto.items?.length
      ? dto.items.filter((item) => item.quantity > 0)
      : this.buildFullRefundRequestedItems(originalInvoice, existingRefunds);

    if (requestedItems.length === 0) {
      throw new ConflictException(
        'This invoice has already been fully refunded.',
      );
    }

    const violations: Array<{
      productId: string;
      productName: string;
      maxReturnableQty: number;
      requestedQty: number;
    }> = [];

    const validItems: Array<
      InvoiceItem & { effectiveUnitPrice: number; returnQuantity: number }
    > = [];

    for (const reqItem of requestedItems) {
      const originalItem = originalInvoice.items.find(
        (i) => i.productId.toString() === reqItem.productId.toString(),
      );
      if (!originalItem) {
        throw new BadRequestException(
          `Product ${reqItem.productId.toString()} not found in original invoice`,
        );
      }

      let previouslyRefundedQty = 0;
      for (const refund of existingRefunds) {
        const refundedItem = refund.items.find(
          (i: any) => i.productId.toString() === reqItem.productId.toString(),
        );
        if (refundedItem) {
          previouslyRefundedQty += Math.abs(refundedItem.quantity);
        }
      }

      const maxReturnableQty = originalItem.quantity - previouslyRefundedQty;
      if (reqItem.quantity > maxReturnableQty) {
        violations.push({
          productId: reqItem.productId.toString(),
          productName: originalItem.productName,
          maxReturnableQty,
          requestedQty: reqItem.quantity,
        });
      } else {
        const originalDiscountAmount = originalItem.itemDiscountAmount
          ? Number(originalItem.itemDiscountAmount.toString())
          : 0;
        const originalUnitPrice = Number(originalItem.unitPrice.toString());
        const discountedUnitSubtotal =
          originalUnitPrice * originalItem.quantity - originalDiscountAmount;
        const effectiveUnitPrice =
          discountedUnitSubtotal / originalItem.quantity;

        validItems.push({
          ...originalItem,
          effectiveUnitPrice,
          returnQuantity: reqItem.quantity,
        });
      }
    }

    if (violations.length > 0) {
      throw new BadRequestException({
        error: 'REFUND_VALIDATION_FAILED',
        violations,
        message: 'Some items exceed the maximum returnable quantity.',
      });
    }

    return this.databaseService.executeInTransaction(
      async (session: ClientSession) => {
        const existingTx = await this.invoiceModel
          .findOne({
            tenantId: new Types.ObjectId(tenantId),
            clientGeneratedId: dto.clientGeneratedId,
          })
          .session(session);
        if (existingTx) return { invoice: existingTx, replayed: true } as any;

        const refundId = new Types.ObjectId();
        const items: InvoiceItem[] = [];
        let subtotal = 0;
        let totalGstAmount = 0;

        for (const vItem of validItems) {
          const currentStock = await this.stockService.findByProductAndOutlet(
            tenantId,
            vItem.productId.toString(),
            originalInvoice.outletId.toString(),
            session,
          );
          const currentQty = currentStock?.quantity || 0;
          const newStock = currentQty + vItem.returnQuantity;

          await this.stockService.incrementStock(
            tenantId,
            vItem.productId.toString(),
            originalInvoice.outletId.toString(),
            vItem.returnQuantity,
            session,
          );

          await this.stockAuditLogService.create(
            tenantId,
            vItem.productId.toString(),
            originalInvoice.outletId.toString(),
            currentQty,
            newStock,
            ChangeType.REFUND,
            refundId,
            session,
          );

          const gstEnabled = !!originalInvoice.gstEnabled;
          const appliedGstRate = gstEnabled ? vItem.gstRate : 0;
          const gstAmount = -(
            vItem.effectiveUnitPrice *
            vItem.returnQuantity *
            (appliedGstRate / 100)
          );
          const roundedGstAmount = Math.round(gstAmount * 100) / 100;
          const lineTotal = -(
            vItem.effectiveUnitPrice * vItem.returnQuantity +
            Math.abs(roundedGstAmount)
          );

          items.push({
            productId: vItem.productId,
            productName: vItem.productName,
            quantity: vItem.returnQuantity,
            unitPrice: vItem.effectiveUnitPrice,
            gstRate: vItem.gstRate,
            gstAmount: roundedGstAmount,
            lineTotal: Math.round(lineTotal * 100) / 100,
            overridden: false,
            itemDiscountType: DiscountType.NONE,
            itemDiscountValue: 0,
            itemDiscountAmount: 0,
          });

          subtotal += -(vItem.effectiveUnitPrice * vItem.returnQuantity);
          totalGstAmount += roundedGstAmount;
        }

        subtotal = Math.round(subtotal * 100) / 100;
        totalGstAmount = Math.round(totalGstAmount * 100) / 100;
        const grandTotal = Math.round((subtotal + totalGstAmount) * 100) / 100;

        const invoiceNumber = await this.dailyCounterService.incrementAndGet(
          originalInvoice.outletId,
          new Types.ObjectId(tenantId),
          originalInvoice.outletAbbr,
          session,
        );

        const refundInvoice = new this.invoiceModel({
          _id: refundId,
          invoiceType: InvoiceType.REFUND,
          originalInvoiceId: originalInvoice._id,
          tenantId: originalInvoice.tenantId,
          outletId: originalInvoice.outletId,
          paymentMethod: originalInvoice.paymentMethod,
          customerName: originalInvoice.customerName,
          customerPhone: originalInvoice.customerPhone,
          refundReason: dto.refundReason ?? null,
          invoiceNumber,
          clientGeneratedId: dto.clientGeneratedId,
          billDiscountType: DiscountType.NONE,
          billDiscountValue: 0,
          billDiscountAmount: 0,
          items,
          subtotal,
          totalGstAmount,
          grandTotal,
          gstEnabled: originalInvoice.gstEnabled,
          tenantGstNumber: originalInvoice.tenantGstNumber,
          businessName: originalInvoice.businessName,
          businessAbbr: originalInvoice.businessAbbr,
          outletName: originalInvoice.outletName,
          outletAbbr: originalInvoice.outletAbbr,
          abbreviationsLocked: originalInvoice.abbreviationsLocked,
          isDeleted: false,
        });

        const saved = await refundInvoice.save({ session });
        return { invoice: saved, replayed: false } as any;
      },
    );
  }

  private buildFullRefundRequestedItems(
    originalInvoice: Invoice,
    existingRefunds: Invoice[],
  ): Array<{ productId: Types.ObjectId; quantity: number }> {
    return originalInvoice.items
      .map((originalItem) => {
        let previouslyRefundedQty = 0;

        for (const refund of existingRefunds) {
          const refundedItem = refund.items.find(
            (i: any) =>
              i.productId.toString() === originalItem.productId.toString(),
          );

          if (refundedItem) {
            previouslyRefundedQty += Math.abs(refundedItem.quantity);
          }
        }

        const remainingQty = originalItem.quantity - previouslyRefundedQty;
        if (remainingQty <= 0) {
          return null;
        }

        return {
          productId: originalItem.productId,
          quantity: remainingQty,
        };
      })
      .filter(
        (
          item,
        ): item is {
          productId: Types.ObjectId;
          quantity: number;
        } => item !== null,
      );
  }
}
