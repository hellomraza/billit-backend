import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { DatabaseService } from '../../database/database.service';
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
import { Invoice, InvoiceItem } from './invoice.schema';

interface InvoiceItemWithStock extends InvoiceItem {
  currentStock?: number;
}

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

        // Get total pending deficit for this product
        const pendingDeficit = await this.deficitModel.aggregate([
          {
            $match: {
              tenantId: new Types.ObjectId(tenantId),
              productId: item.productId,
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

        // Can override only if threshold not exceeded
        const canOverride =
          currentDeficit +
            Math.abs(wouldBeNegative ? currentStockQty - item.quantity : 0) <=
          deficitThreshold;

        insufficiencies.push({
          productId: item.productId.toString(),
          productName: item.productName,
          requestedQuantity: item.quantity,
          currentStock: currentStockQty,
          deficitThreshold,
          currentDeficit,
          canOverride,
          overrideBlockReason: !canOverride
            ? `Deficit threshold (${deficitThreshold}) would be exceeded. Current deficit: ${currentDeficit}. New deficit would be: ${currentDeficit + Math.abs(currentStockQty - item.quantity)}`
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

        // Calculate totals and prepare items
        const items: InvoiceItem[] = [];
        let subtotal = 0;
        let totalGstAmount = 0;

        for (const item of createInvoiceDto.items) {
          const lineSubtotal = item.quantity * item.unitPrice;
          const gstAmount =
            Math.round(lineSubtotal * (item.gstRate / 100) * 100) / 100;
          const lineTotal = lineSubtotal + gstAmount;

          items.push({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            gstAmount,
            lineTotal,
            overridden: item.override ?? false,
          });

          subtotal += lineSubtotal;
          totalGstAmount += gstAmount;
        }

        const grandTotal = subtotal + totalGstAmount;

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
          const newQuantity = currentQty - item.quantity;

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

          // Create deficit record if stock goes negative
          if (newQuantity < 0) {
            await this.deficitService.create(
              tenantId,
              item.productId.toString(),
              createInvoiceDto.outletId.toString(),
              Math.abs(newQuantity),
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
      _id: invoiceId,
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
      paymentMethod?: string;
      gstEnabled?: boolean;
      outletId?: string;
      productId?: string;
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
    } = filters;

    const skip = (page - 1) * limit;

    const query: any = {
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

    const data = await this.invoiceModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

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
    paymentMethod: string,
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
}
