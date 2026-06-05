import { Types } from 'mongoose';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService.getTopProducts', () => {
  let service: AnalyticsService;
  let mockStockModel: any;
  let mockProductModel: any;
  let mockDailyProductSalesModel: any;
  let mockInvoiceModel: any;
  let mockDeficitRecordModel: any;
  let mockDailyRevenueSummaryModel: any;
  let mockOutletService: any;

  beforeEach(() => {
    mockStockModel = {};
    mockProductModel = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockDailyProductSalesModel = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockInvoiceModel = {
      find: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue([]),
    };
    mockDeficitRecordModel = {};
    mockDailyRevenueSummaryModel = {};
    mockOutletService = {
      getDefault: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId('507f1f77bcf86cd799439013'),
      }),
    };

    service = new AnalyticsService(
      mockStockModel,
      mockProductModel,
      mockDailyProductSalesModel,
      mockInvoiceModel,
      mockDeficitRecordModel,
      mockDailyRevenueSummaryModel,
      mockOutletService,
    );
  });

  it('should correctly fetch and sort top products by revenue (default)', async () => {
    const p1 = new Types.ObjectId('507f1f77bcf86cd799439001');
    const p2 = new Types.ObjectId('507f1f77bcf86cd799439002');

    mockDailyProductSalesModel.find = jest.fn().mockResolvedValue([
      { productId: p1, netRevenue: 100, netUnitsSold: 5 },
      { productId: p2, netRevenue: 50, netUnitsSold: 10 },
    ]);

    mockProductModel.find = jest.fn().mockResolvedValue([
      { _id: p1, name: 'Product A' },
      { _id: p2, name: 'Product B' },
    ]);

    const result = await service.getTopProducts(
      '507f1f77bcf86cd799439011',
      'last30days',
    );

    expect(result.totalNetRevenue).toBe(150);
    expect(result.totalUnitsSold).toBe(15);
    expect(result.topProducts).toHaveLength(2);
    
    // Product A should be first because it has higher revenue (100 > 50)
    expect(result.topProducts[0].productId).toBe(p1.toString());
    expect(result.topProducts[0].productName).toBe('Product A');
    expect(result.topProducts[0].netRevenue).toBe(100);
    expect(result.topProducts[0].unitsSold).toBe(5);
    expect(result.topProducts[0].percentOfTotal).toBe(66.67);

    expect(result.topProducts[1].productId).toBe(p2.toString());
    expect(result.topProducts[1].productName).toBe('Product B');
    expect(result.topProducts[1].netRevenue).toBe(50);
    expect(result.topProducts[1].unitsSold).toBe(10);
    expect(result.topProducts[1].percentOfTotal).toBe(33.33);
  });

  it('should correctly fetch and sort top products by units sold', async () => {
    const p1 = new Types.ObjectId('507f1f77bcf86cd799439001');
    const p2 = new Types.ObjectId('507f1f77bcf86cd799439002');

    mockDailyProductSalesModel.find = jest.fn().mockResolvedValue([
      { productId: p1, netRevenue: 100, netUnitsSold: 5 },
      { productId: p2, netRevenue: 50, netUnitsSold: 10 },
    ]);

    mockProductModel.find = jest.fn().mockResolvedValue([
      { _id: p1, name: 'Product A' },
      { _id: p2, name: 'Product B' },
    ]);

    const result = await service.getTopProducts(
      '507f1f77bcf86cd799439011',
      'last30days',
      undefined,
      undefined,
      'units_sold',
    );

    expect(result.totalNetRevenue).toBe(150);
    expect(result.totalUnitsSold).toBe(15);
    expect(result.topProducts).toHaveLength(2);

    // Product B should be first because it has higher units sold (10 > 5)
    expect(result.topProducts[0].productId).toBe(p2.toString());
    expect(result.topProducts[0].productName).toBe('Product B');
    expect(result.topProducts[0].netRevenue).toBe(50);
    expect(result.topProducts[0].unitsSold).toBe(10);
    expect(result.topProducts[0].percentOfTotal).toBe(66.67);

    expect(result.topProducts[1].productId).toBe(p1.toString());
    expect(result.topProducts[1].productName).toBe('Product A');
    expect(result.topProducts[1].netRevenue).toBe(100);
    expect(result.topProducts[1].unitsSold).toBe(5);
    expect(result.topProducts[1].percentOfTotal).toBe(33.33);
  });
});
