import { Types } from 'mongoose';
import { DatabaseService } from '../../database/database.service';
import { DailyCounterService } from '../daily-counter/daily-counter.service';
import { DeficitService } from '../deficit/deficit.service';
import { OutletService } from '../outlet/outlet.service';
import { ProductService } from '../product/product.service';
import { StockAuditLogService } from '../stock-audit/stock-audit.service';
import { StockService } from '../stock/stock.service';
import { TenantService } from '../tenant/tenant.service';
import { CreateRefundDto } from './dto/invoice-refund.dto';
import { InvoiceType } from './invoice.schema';
import { InvoiceService } from './invoice.service';

describe('InvoiceService.createRefund', () => {
  it('refunds the full bill when no item list is provided', async () => {
    const save = jest.fn().mockImplementation(async function saveInvoice() {
      return this;
    });

    const invoiceModel: any = jest.fn().mockImplementation((doc) => ({
      ...doc,
      save,
    }));
    const findOneResults: any[] = [
      null,
      {
        _id: new Types.ObjectId('507f1f77bcf86cd799439021'),
        tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
        invoiceNumber: 'INV-001',
        invoiceType: InvoiceType.SALE,
        outletId: new Types.ObjectId('507f1f77bcf86cd799439013'),
        outletAbbr: 'OUT',
        paymentMethod: 'CASH',
        customerName: 'Customer',
        customerPhone: '1234567890',
        gstEnabled: true,
        tenantGstNumber: 'GSTIN',
        businessName: 'Biz',
        businessAbbr: 'BZ',
        outletName: 'Outlet',
        abbreviationsLocked: false,
        items: [
          {
            productId: new Types.ObjectId('507f1f77bcf86cd799439012'),
            productName: 'Product A',
            quantity: 2,
            unitPrice: 100,
            gstRate: 18,
            itemDiscountAmount: 0,
          },
        ],
      },
      null,
    ];

    invoiceModel.findOne = jest.fn().mockImplementation(() => {
      const value = findOneResults.shift();
      return {
        then: (onFulfilled: any) => Promise.resolve(value).then(onFulfilled),
        session: (_s: any) => Promise.resolve(value),
      } as any;
    });
    invoiceModel.find = jest.fn().mockResolvedValue([]);

    const databaseService = {
      executeInTransaction: jest.fn(async (callback) => callback({})),
    } as unknown as DatabaseService;
    const stockService = {
      findByProductAndOutlet: jest.fn().mockResolvedValue({ quantity: 0 }),
      incrementStock: jest.fn(),
    } as unknown as StockService;
    const stockAuditLogService = {
      create: jest.fn(),
    } as unknown as StockAuditLogService;
    const dailyCounterService = {
      incrementAndGet: jest.fn().mockResolvedValue('REF-001'),
    } as unknown as DailyCounterService;

    const service = new InvoiceService(
      invoiceModel,
      {} as any,
      databaseService,
      stockService,
      {} as DeficitService,
      stockAuditLogService,
      dailyCounterService,
      {} as TenantService,
      {} as OutletService,
      {} as ProductService,
    );

    const dto: CreateRefundDto = {
      clientGeneratedId: '550e8400-e29b-41d4-a716-446655440000',
      refundReason: 'Customer request',
    };

    const result = await service.createRefund(
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439021',
      dto,
    );

    const refund = (result as any).invoice;

    expect(refund.invoiceType).toBe(InvoiceType.REFUND);
    expect(refund.items).toHaveLength(1);
    expect(refund.items[0].quantity).toBe(2);
    expect(refund.grandTotal).toBe(-236);
    expect(stockService.incrementStock).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439012',
      '507f1f77bcf86cd799439013',
      2,
      {},
    );
  });
});
