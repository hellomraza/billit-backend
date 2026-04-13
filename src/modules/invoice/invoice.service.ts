import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { DatabaseService } from '../../database/database.service';
import { DailyCounterService } from '../daily-counter/daily-counter.service';
import { DeficitService } from '../deficit/deficit.service';
import { ChangeType } from '../stock-audit/stock-audit.schema';
import { StockAuditLogService } from '../stock-audit/stock-audit.service';
import { StockService } from '../stock/stock.service';
import { CreateInvoiceDto } from './dto/invoice.dto';
import { Invoice, InvoiceItem } from './invoice.schema';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectModel(Invoice.name) private invoiceModel: Model<Invoice>,
    private databaseService: DatabaseService,
    private stockService: StockService,
    private deficitService: DeficitService,
    private stockAuditLogService: StockAuditLogService,
    private dailyCounterService: DailyCounterService,
  ) {}

  async create(
    tenantId: string,
    createInvoiceDto: CreateInvoiceDto,
  ): Promise<Invoice> {
    return this.databaseService.executeInTransaction(
      async (session: ClientSession) => {
        // Check for duplicate clientGeneratedId
        const existing = await this.invoiceModel.findOne({
          tenantId: new Types.ObjectId(tenantId),
          clientGeneratedId: createInvoiceDto.clientGeneratedId,
        });

        if (existing) {
          throw new BadRequestException(
            'Invoice with this clientGeneratedId already exists',
          );
        }

        // Calculate totals
        const items: InvoiceItem[] = [];
        let subtotal = 0;
        let totalGstAmount = 0;

        for (const item of createInvoiceDto.items) {
          const lineSubtotal = item.quantity * item.unitPrice;
          const gstAmount = lineSubtotal * (item.gstRate / 100);
          const lineTotal = lineSubtotal + gstAmount;

          items.push({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            gstAmount,
            lineTotal,
          });

          subtotal += lineSubtotal;
          totalGstAmount += gstAmount;
        }

        const grandTotal = subtotal + totalGstAmount;

        // Get invoice number from Daily Counter
        const invoiceNumber = await this.dailyCounterService.incrementAndGet(
          createInvoiceDto.outletId,
          new Types.ObjectId(tenantId),
        );

        // Create invoice
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
          isGstInvoice: createInvoiceDto.isGstInvoice || false,
          tenantGstNumber: createInvoiceDto.tenantGstNumber,
          isDeleted: false,
        });

        // Deduct stock for each item
        for (const item of createInvoiceDto.items) {
          const currentStock = await this.stockService.findByProductAndOutlet(
            tenantId,
            item.productId.toString(),
            createInvoiceDto.outletId.toString(),
          );

          const newQuantity = currentStock.quantity - item.quantity;

          // Update stock
          await this.stockService.decrementStock(
            tenantId,
            item.productId.toString(),
            createInvoiceDto.outletId.toString(),
            item.quantity,
          );

          // Create audit log
          await this.stockAuditLogService.create(
            tenantId,
            item.productId.toString(),
            createInvoiceDto.outletId.toString(),
            currentStock.quantity,
            newQuantity,
            ChangeType.SALE,
            invoice._id,
          );

          // Create deficit record if stock goes negative
          if (newQuantity < 0) {
            await this.deficitService.create(
              tenantId,
              item.productId.toString(),
              createInvoiceDto.outletId.toString(),
              Math.abs(newQuantity),
              invoice._id,
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

  async findAll(
    tenantId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Invoice[]; total: number }> {
    const skip = (page - 1) * limit;
    const query = { tenantId: new Types.ObjectId(tenantId), isDeleted: false };

    const data = await this.invoiceModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await this.invoiceModel.countDocuments(query);

    return { data, total };
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
