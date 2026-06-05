import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DeficitRecord, DeficitStatus } from '../deficit/deficit.schema';
import { Invoice } from '../invoice/invoice.schema';
import { OutletService } from '../outlet/outlet.service';
import { Product } from '../product/product.schema';
import { Stock } from '../stock/stock.schema';
import { DailyProductSales } from './schemas/daily-product-sales.schema';
import {
  DailyRevenueSummary,
  DailyRevenueSummaryDocument,
} from './schemas/daily-revenue-summary.schema';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function todayIST(): string {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  return `${istNow.getUTCFullYear()}-${pad(istNow.getUTCMonth() + 1)}-${pad(istNow.getUTCDate())}`;
}

function yesterdayIST(): string {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const yesterday = new Date(istNow);
  yesterday.setUTCDate(istNow.getUTCDate() - 1);
  return `${yesterday.getUTCFullYear()}-${pad(yesterday.getUTCMonth() + 1)}-${pad(yesterday.getUTCDate())}`;
}

function getIstDateMinusDays(days: number): string {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const target = new Date(istNow);
  target.setUTCDate(istNow.getUTCDate() - days);
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}`;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(Stock.name) private readonly stockModel: Model<Stock>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(DailyProductSales.name)
    private readonly dailyProductSalesModel: Model<DailyProductSales>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(DeficitRecord.name)
    private readonly deficitRecordModel: Model<DeficitRecord>,
    @InjectModel(DailyRevenueSummary.name)
    private readonly dailyRevenueSummaryModel: Model<DailyRevenueSummaryDocument>,
    private readonly outletService: OutletService,
  ) {}

  /**
   * Retrieves low stock products (quantity <= 10) for the tenant's default outlet,
   * sorted by quantity ascending, and computes stock status.
   */
  async getLowStock(tenantId: string): Promise<{
    lowStockProducts: Array<{
      productId: string;
      productName: string;
      currentStock: number;
      stockStatus: 'NEGATIVE' | 'OUT_OF_STOCK' | 'LOW';
    }>;
    count: number;
  }> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const defaultOutlet = await this.outletService.getDefault(tenantId);

    const rawResults = await this.stockModel.aggregate([
      {
        $match: {
          tenantId: tenantObjectId,
          outletId: defaultOutlet._id,
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      {
        $unwind: '$product',
      },
      {
        $match: {
          'product.isDeleted': false,
          $expr: {
            $lte: ['$quantity', '$product.deficitThreshold'],
          },
        },
      },
      {
        $project: {
          _id: 0,
          productId: '$productId',
          productName: '$product.name',
          currentStock: '$quantity',
          deficitThreshold: '$product.deficitThreshold',
        },
      },
      {
        $sort: {
          currentStock: 1,
        },
      },
    ]);

    const lowStockProducts = rawResults.map((row) => {
      let stockStatus: 'NEGATIVE' | 'OUT_OF_STOCK' | 'LOW' = 'LOW';
      if (row.currentStock < 0) {
        stockStatus = 'NEGATIVE';
      } else if (row.currentStock === 0) {
        stockStatus = 'OUT_OF_STOCK';
      }

      return {
        productId: row.productId.toString(),
        productName: row.productName,
        currentStock: row.currentStock,
        stockStatus,
      };
    });

    return {
      lowStockProducts,
      count: lowStockProducts.length,
    };
  }

  /**
   * Computes product health categories (Fast Selling, Slow Selling, Dead Stock, Normal)
   * for a given time window (7, 30, or 90 days).
   */
  async getProductHealth(
    tenantId: string,
    window: number,
  ): Promise<{
    window: number;
    categoriesAvailable: boolean;
    insufficientReason:
      | 'INSUFFICIENT_PRODUCTS'
      | 'INSUFFICIENT_DIFFERENTIATION'
      | null;
    fastSelling: Array<{
      productId: string;
      productName: string;
      avgDailySales: number;
      totalSoldInWindow: number;
    }>;
    slowSelling: Array<{
      productId: string;
      productName: string;
      avgDailySales: number;
      daysSinceLastSale: number;
    }>;
    deadStock: Array<{
      productId: string;
      productName: string;
      daysSinceLastSale: number;
      currentStock: number;
    }>;
    normal: Array<{
      productId: string;
      productName: string;
      avgDailySales: number;
      totalSoldInWindow: number;
    }>;
  }> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const defaultOutlet = await this.outletService.getDefault(tenantId);

    // 1. Fetch all active (non-deleted) products for the tenant
    const activeProducts = await this.productModel.find({
      tenantId: tenantObjectId,
      isDeleted: false,
    });

    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        createdAt: Date;
        totalNetUnitsSold: number;
        daysWithSales: number;
        lastSaleDate: Date | null;
      }
    >();

    for (const prod of activeProducts) {
      productMap.set(prod._id!.toString(), {
        productId: prod._id!.toString(),
        productName: prod.name,
        createdAt: prod.createdAt,
        totalNetUnitsSold: 0,
        daysWithSales: 0,
        lastSaleDate: null,
      });
    }

    // Determine window dates in IST
    const todayStr = todayIST();
    const endDateStr = yesterdayIST();
    const startDateStr = getIstDateMinusDays(window);

    this.logger.log(
      `[HealthDebug] tenantId=${tenantId} outletId=${defaultOutlet._id} startDateStr=${startDateStr} endDateStr=${endDateStr}`,
    );

    // 2. Query historical sales from DailyProductSales
    const historicalSales = await this.dailyProductSalesModel.find({
      outletId: defaultOutlet._id,
      date: { $gte: startDateStr, $lte: endDateStr },
    });

    this.logger.log(
      `[HealthDebug] historicalSales count=${historicalSales.length}`,
    );

    for (const sale of historicalSales) {
      const prodId = sale.productId.toString();
      if (!productMap.has(prodId)) continue; // skip deleted products

      const entry = productMap.get(prodId)!;
      entry.totalNetUnitsSold += sale.netUnitsSold;
      if (sale.netUnitsSold > 0) {
        entry.daysWithSales += 1;
        const saleDate = new Date(`${sale.date}T00:00:00Z`);
        if (!entry.lastSaleDate || saleDate > entry.lastSaleDate) {
          entry.lastSaleDate = saleDate;
        }
      }
    }

    // 3. Query today's live invoices
    const utcStart = new Date(`${todayStr}T00:00:00+05:30`);
    const utcEnd = new Date(`${todayStr}T23:59:59.999+05:30`);

    const todayInvoices = await this.invoiceModel.aggregate([
      {
        $match: {
          tenantId: tenantObjectId,
          outletId: this.outletIdFilter(defaultOutlet._id.toString()),
          createdAt: { $gte: utcStart, $lte: utcEnd },
          isDeleted: false,
        },
      },
    ]);

    const todayProductSalesMap = new Map<
      string,
      { unitsSold: number; refundedUnits: number }
    >();

    for (const invoice of todayInvoices) {
      const isSale = invoice.invoiceType === 'SALE';
      const isRefund = invoice.invoiceType === 'REFUND';

      for (const item of invoice.items) {
        const productId = item.productId.toString();
        if (!todayProductSalesMap.has(productId)) {
          todayProductSalesMap.set(productId, {
            unitsSold: 0,
            refundedUnits: 0,
          });
        }
        const entry = todayProductSalesMap.get(productId)!;
        if (isSale) {
          entry.unitsSold += item.quantity;
        } else if (isRefund) {
          entry.refundedUnits += item.quantity;
        }
      }
    }

    for (const [prodId, data] of todayProductSalesMap.entries()) {
      if (!productMap.has(prodId)) continue; // skip deleted products

      const entry = productMap.get(prodId)!;
      const netToday = Math.max(0, data.unitsSold - data.refundedUnits);
      entry.totalNetUnitsSold += netToday;
      if (netToday > 0) {
        entry.daysWithSales += 1;
        const todayDate = new Date(`${todayStr}T00:00:00Z`);
        if (!entry.lastSaleDate || todayDate > entry.lastSaleDate) {
          entry.lastSaleDate = todayDate;
        }
      }
    }

    // Compute avgDailySales for each product
    const productsList = Array.from(productMap.values()).map((entry) => {
      const avgDailySales = entry.totalNetUnitsSold / window;
      return {
        ...entry,
        avgDailySales,
      };
    });

    // 4. Check minimum data requirements
    const productsWithAnySales = productsList.filter(
      (p) => p.totalNetUnitsSold > 0,
    );

    if (productsWithAnySales.length < 5) {
      return {
        window,
        categoriesAvailable: false,
        insufficientReason: 'INSUFFICIENT_PRODUCTS',
        fastSelling: [],
        slowSelling: [],
        deadStock: [],
        normal: [],
      };
    }

    const avgDailySalesValues = productsWithAnySales.map(
      (p) => p.avgDailySales,
    );
    const maxAvgDaily = Math.max(...avgDailySalesValues);
    const minAvgDaily = Math.min(...avgDailySalesValues);

    if (maxAvgDaily - minAvgDaily <= 1) {
      return {
        window,
        categoriesAvailable: false,
        insufficientReason: 'INSUFFICIENT_DIFFERENTIATION',
        fastSelling: [],
        slowSelling: [],
        deadStock: [],
        normal: [],
      };
    }

    // Fetch stock records to populate currentStock for deadStock products
    const stocks = await this.stockModel.find({
      tenantId: tenantObjectId,
      outletId: defaultOutlet._id,
    });
    const stockMap = new Map<string, number>();
    for (const s of stocks) {
      stockMap.set(s.productId.toString(), s.quantity);
    }

    // 5. Category Assignment Algorithm
    // Sort products by avgDailySales descending
    productsList.sort((a, b) => b.avgDailySales - a.avgDailySales);

    const totalProductsWithSales = productsWithAnySales.length;
    const top20PercentCount = Math.ceil(totalProductsWithSales * 0.2);
    const bottom20PercentCount = Math.ceil(totalProductsWithSales * 0.2);

    const todayDate = new Date(`${todayStr}T00:00:00Z`);

    // Helper to compute daysSinceLastSale
    const getDaysSinceLastSale = (
      lastSaleDate: Date | null,
      createdAt: Date,
    ): number => {
      const baseDate = lastSaleDate ?? createdAt;
      const diffMs = todayDate.getTime() - new Date(baseDate).getTime();
      return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
    };

    // Allocate Fast Selling with boundary tie expansion
    const fastSellingSet = new Set<string>();
    const fastSelling: any[] = [];
    if (top20PercentCount > 0) {
      const fastBoundaryValue =
        productsList[top20PercentCount - 1].avgDailySales;

      for (const p of productsList) {
        if (p.avgDailySales >= fastBoundaryValue && p.avgDailySales > 0) {
          fastSellingSet.add(p.productId);
          fastSelling.push({
            productId: p.productId,
            productName: p.productName,
            avgDailySales: parseFloat(p.avgDailySales.toFixed(2)),
            totalSoldInWindow: p.totalNetUnitsSold,
          });
        }
      }
    }

    // Allocate Dead Stock
    const deadStockSet = new Set<string>();
    const deadStock: any[] = [];

    for (const p of productsList) {
      const daysSince = getDaysSinceLastSale(p.lastSaleDate, p.createdAt);
      if (p.avgDailySales === 0 && daysSince >= 30) {
        deadStockSet.add(p.productId);
        deadStock.push({
          productId: p.productId,
          productName: p.productName,
          daysSinceLastSale: daysSince,
          currentStock: stockMap.get(p.productId) ?? 0,
        });
      }
    }

    // Allocate Slow Selling with boundary tie expansion
    const slowCandidates = productsList.filter(
      (p) =>
        p.avgDailySales > 0 &&
        !fastSellingSet.has(p.productId) &&
        !deadStockSet.has(p.productId),
    );

    const slowSellingSet = new Set<string>();
    const slowSelling: any[] = [];

    if (slowCandidates.length > 0 && bottom20PercentCount > 0) {
      const index = Math.max(0, slowCandidates.length - bottom20PercentCount);
      const slowBoundaryValue = slowCandidates[index].avgDailySales;

      for (const p of slowCandidates) {
        if (p.avgDailySales <= slowBoundaryValue) {
          slowSellingSet.add(p.productId);
          slowSelling.push({
            productId: p.productId,
            productName: p.productName,
            avgDailySales: parseFloat(p.avgDailySales.toFixed(2)),
            daysSinceLastSale: getDaysSinceLastSale(
              p.lastSaleDate,
              p.createdAt,
            ),
          });
        }
      }
    }

    // Allocate Normal
    const normal: any[] = [];
    for (const p of productsList) {
      if (
        p.avgDailySales > 0 &&
        !fastSellingSet.has(p.productId) &&
        !deadStockSet.has(p.productId) &&
        !slowSellingSet.has(p.productId)
      ) {
        normal.push({
          productId: p.productId,
          productName: p.productName,
          avgDailySales: parseFloat(p.avgDailySales.toFixed(2)),
          totalSoldInWindow: p.totalNetUnitsSold,
        });
      }
    }

    return {
      window,
      categoriesAvailable: true,
      insufficientReason: null,
      fastSelling,
      slowSelling,
      deadStock,
      normal,
    };
  }

  /**
   * Computes a compact summary of pending deficits for the tenant default outlet.
   */
  async getDeficitSummary(tenantId: string): Promise<{
    pendingProductCount: number;
    totalPendingQuantity: number;
    hasDeficits: boolean;
  }> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const defaultOutlet = await this.outletService.getDefault(tenantId);

    const result = await this.deficitRecordModel.aggregate([
      {
        $match: {
          tenantId: tenantObjectId,
          outletId: defaultOutlet._id,
          status: DeficitStatus.PENDING,
        },
      },
      {
        $group: {
          _id: null,
          productIds: { $addToSet: '$productId' },
          totalPendingQuantity: { $sum: '$quantity' },
        },
      },
    ]);

    if (result.length === 0) {
      return {
        pendingProductCount: 0,
        totalPendingQuantity: 0,
        hasDeficits: false,
      };
    }

    const pendingProductCount = result[0].productIds.length;
    const totalPendingQuantity = result[0].totalPendingQuantity;

    return {
      pendingProductCount,
      totalPendingQuantity,
      hasDeficits: pendingProductCount > 0,
    };
  }

  /**
   * Returns the four summary card values (totalNetRevenue, totalInvoices,
   * totalRefundsCount, totalRefundsAmount, avgInvoiceValue) for the given period.
   */
  async getRevenueSummary(
    tenantId: string,
    period: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{
    period: string;
    startDate: string;
    endDate: string;
    totalNetRevenue: number;
    totalInvoices: number;
    totalRefundsCount: number;
    totalRefundsAmount: number;
    avgInvoiceValue: number;
  }> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const defaultOutlet = await this.outletService.getDefault(tenantId);

    // 1. Resolve date range in IST
    const { startDateStr, endDateStr } = this.resolveDateRange(
      period,
      dateFrom,
      dateTo,
    );

    const allDates = this.generateDateRange(startDateStr, endDateStr);
    const todayStr = todayIST();

    // Separate historical dates to query precomputed summaries
    const historicalDates = allDates.filter((d) => d !== todayStr);
    const summaryMap = new Map<string, any>();

    if (historicalDates.length > 0) {
      const summaries = await this.dailyRevenueSummaryModel.find({
        outletId: defaultOutlet._id,
        date: { $in: historicalDates },
      });
      for (const s of summaries) {
        summaryMap.set(s.date, s);
      }
    }

    let totalNetRevenue = 0;
    let totalInvoices = 0;
    let totalRefundsCount = 0;

    // 2. Fetch data day by day with hybrid precomputed + live fallback strategy
    for (const date of allDates) {
      if (date === todayStr) {
        // Today is always live
        const live = await this.queryLiveInvoiceRevenue(
          tenantObjectId,
          defaultOutlet._id,
          date,
        );
        totalNetRevenue += live.netRevenue;
        totalInvoices += live.totalInvoices;
        totalRefundsCount += live.totalRefunds;
      } else if (summaryMap.has(date)) {
        // Historical precomputed exists
        const s = summaryMap.get(date)!;
        totalNetRevenue += parseFloat(s.netRevenue?.toString() || '0');
        totalInvoices += s.totalInvoices;
        totalRefundsCount += s.totalRefunds;
      } else {
        // Historical precomputed is missing, fall back to live query for that day
        const live = await this.queryLiveInvoiceRevenue(
          tenantObjectId,
          defaultOutlet._id,
          date,
        );
        totalNetRevenue += live.netRevenue;
        totalInvoices += live.totalInvoices;
        totalRefundsCount += live.totalRefunds;
      }
    }

    // 3. Query all REFUND invoices in this period live to compute totalRefundsAmount
    const startUtc = new Date(`${startDateStr}T00:00:00+05:30`);
    const endUtc = new Date(`${endDateStr}T23:59:59.999+05:30`);

    const refundInvoices = await this.invoiceModel.find({
      tenantId: tenantObjectId,
      outletId: this.outletIdFilter(defaultOutlet._id.toString()),
      invoiceType: 'REFUND',
      createdAt: { $gte: startUtc, $lte: endUtc },
      isDeleted: false,
    });

    let refundsSum = 0;
    for (const refund of refundInvoices) {
      refundsSum += parseFloat(refund.grandTotal?.toString() || '0');
    }
    const totalRefundsAmount = -refundsSum; // Return as a negative value

    // 4. Compute avgInvoiceValue
    const avgInvoiceValue =
      totalInvoices > 0 ? totalNetRevenue / totalInvoices : 0;

    return {
      period,
      startDate: startDateStr,
      endDate: endDateStr,
      totalNetRevenue: parseFloat(totalNetRevenue.toFixed(2)),
      totalInvoices,
      totalRefundsCount,
      totalRefundsAmount: parseFloat(totalRefundsAmount.toFixed(2)),
      avgInvoiceValue: parseFloat(avgInvoiceValue.toFixed(2)),
    };
  }

  /**
   * Helper to execute live invoice query for a single calendar date.
   */
  private async queryLiveInvoiceRevenue(
    tenantId: Types.ObjectId,
    outletId: Types.ObjectId,
    dateStr: string,
  ): Promise<{
    netRevenue: number;
    totalInvoices: number;
    totalRefunds: number;
  }> {
    const utcStart = new Date(`${dateStr}T00:00:00+05:30`);
    const utcEnd = new Date(`${dateStr}T23:59:59.999+05:30`);

    const invoices = await this.invoiceModel.aggregate([
      {
        $match: {
          tenantId,
          outletId: this.outletIdFilter(outletId.toString()),
          createdAt: { $gte: utcStart, $lte: utcEnd },
          isDeleted: false,
        },
      },
    ]);

    let totalInvoices = 0;
    let totalRefunds = 0;
    let grossRevenue = 0;
    let totalDiscounts = 0;

    const parseDecimal = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      return parseFloat(val.toString?.() || '0');
    };

    for (const invoice of invoices) {
      if (invoice.invoiceType === 'SALE') {
        totalInvoices++;
        grossRevenue += parseDecimal(invoice.subtotal);
        let itemDiscountTotal = 0;
        for (const item of invoice.items) {
          itemDiscountTotal += parseDecimal(item.itemDiscountAmount);
        }
        totalDiscounts +=
          itemDiscountTotal + parseDecimal(invoice.billDiscountAmount);
      } else if (invoice.invoiceType === 'REFUND') {
        totalRefunds++;
      }
    }

    const netRevenue = Math.max(0, grossRevenue - totalDiscounts);

    return {
      netRevenue,
      totalInvoices,
      totalRefunds,
    };
  }

  /**
   * Resolves date period strings to IST startDateStr and endDateStr (YYYY-MM-DD format).
   */
  private resolveDateRange(
    period: string,
    dateFrom?: string,
    dateTo?: string,
  ): { startDateStr: string; endDateStr: string } {
    const todayStr = todayIST();

    switch (period) {
      case 'today':
        return { startDateStr: todayStr, endDateStr: todayStr };

      case 'this_week': {
        const now = new Date();
        const istNow = new Date(now.getTime() + IST_OFFSET_MS);
        const day = istNow.getUTCDay();
        const diff = day === 0 ? 6 : day - 1;
        const monday = new Date(istNow);
        monday.setUTCDate(istNow.getUTCDate() - diff);
        const startDateStr = `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
        return { startDateStr, endDateStr: todayStr };
      }

      case 'this_month': {
        const now = new Date();
        const istNow = new Date(now.getTime() + IST_OFFSET_MS);
        const startDateStr = `${istNow.getUTCFullYear()}-${pad(istNow.getUTCMonth() + 1)}-01`;
        return { startDateStr, endDateStr: todayStr };
      }

      case 'last7days':
        return { startDateStr: getIstDateMinusDays(6), endDateStr: todayStr };

      case 'last30days':
        return { startDateStr: getIstDateMinusDays(29), endDateStr: todayStr };

      case 'last90days':
        return { startDateStr: getIstDateMinusDays(89), endDateStr: todayStr };

      case 'custom': {
        if (!dateFrom || !dateTo) {
          throw new BadRequestException(
            'dateFrom and dateTo are required for custom period',
          );
        }
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateFrom) || !dateRegex.test(dateTo)) {
          throw new BadRequestException(
            'dateFrom and dateTo must be in YYYY-MM-DD format',
          );
        }
        const start = new Date(`${dateFrom}T00:00:00Z`);
        const end = new Date(`${dateTo}T00:00:00Z`);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
          throw new BadRequestException(
            'Invalid date range. Start date must be <= end date.',
          );
        }
        return { startDateStr: dateFrom, endDateStr: dateTo };
      }

      default:
        throw new BadRequestException(
          'Invalid period. Must be today, this_week, this_month, last7days, last30days, last90days, or custom',
        );
    }
  }

  /**
   * Helper to generate range of dates YYYY-MM-DD between two date bounds (inclusive).
   */
  private generateDateRange(startStr: string, endStr: string): string[] {
    const dates: string[] = [];
    const current = new Date(`${startStr}T00:00:00Z`);
    const end = new Date(`${endStr}T00:00:00Z`);

    while (current <= end) {
      const y = current.getUTCFullYear();
      const m = pad(current.getUTCMonth() + 1);
      const d = pad(current.getUTCDate());
      dates.push(`${y}-${m}-${d}`);
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  }

  /**
   * Returns daily, weekly, or hourly revenue chart data for the bar chart.
   */
  async getRevenueChart(
    tenantId: string,
    period: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{
    aggregation: 'hourly' | 'daily' | 'weekly';
    dataPoints: Array<{
      label: string;
      netRevenue: number;
      grossRevenue: number;
      discounts: number;
      invoiceCount: number;
    }>;
  }> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const defaultOutlet = await this.outletService.getDefault(tenantId);

    // 1. Resolve date range in IST
    const { startDateStr, endDateStr } = this.resolveDateRange(
      period,
      dateFrom,
      dateTo,
    );

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const todayStr = todayIST();

    const parseDecimal = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      return parseFloat(val.toString?.() || '0');
    };

    // --- CASE 1: Hourly Aggregation (today only) ---
    if (diffDays === 1 && startDateStr === todayStr) {
      const utcStart = new Date(`${todayStr}T00:00:00+05:30`);
      const utcEnd = new Date(`${todayStr}T23:59:59.999+05:30`);

      const todayInvoices = await this.invoiceModel.find({
        tenantId: tenantObjectId,
        outletId: this.outletIdFilter(defaultOutlet._id.toString()),
        invoiceType: 'SALE',
        createdAt: { $gte: utcStart, $lte: utcEnd },
        isDeleted: false,
      });

      const hourMap = new Map<
        number,
        {
          netRevenue: number;
          grossRevenue: number;
          discounts: number;
          invoiceCount: number;
        }
      >();

      // Pre-populate hours 8am to 10pm (8 to 22)
      for (let h = 8; h <= 22; h++) {
        hourMap.set(h, {
          netRevenue: 0,
          grossRevenue: 0,
          discounts: 0,
          invoiceCount: 0,
        });
      }

      for (const invoice of todayInvoices) {
        const istDate = new Date(invoice.createdAt.getTime() + IST_OFFSET_MS);
        const hour = istDate.getUTCHours();

        if (!hourMap.has(hour)) {
          hourMap.set(hour, {
            netRevenue: 0,
            grossRevenue: 0,
            discounts: 0,
            invoiceCount: 0,
          });
        }

        const entry = hourMap.get(hour)!;
        const subtotal = parseDecimal(invoice.subtotal);
        let itemDiscountTotal = 0;
        for (const item of invoice.items) {
          itemDiscountTotal += parseDecimal(item.itemDiscountAmount);
        }
        const billDiscount = parseDecimal(invoice.billDiscountAmount);
        const totalDiscount = itemDiscountTotal + billDiscount;
        const netRevenue = Math.max(0, subtotal - totalDiscount);

        entry.grossRevenue += subtotal;
        entry.discounts += totalDiscount;
        entry.netRevenue += netRevenue;
        entry.invoiceCount += 1;
      }

      const sortedHours = Array.from(hourMap.keys()).sort((a, b) => a - b);
      const dataPoints = sortedHours.map((h) => {
        const entry = hourMap.get(h)!;
        return {
          label: `${pad(h)}:00`,
          netRevenue: parseFloat(entry.netRevenue.toFixed(2)),
          grossRevenue: parseFloat(entry.grossRevenue.toFixed(2)),
          discounts: parseFloat(entry.discounts.toFixed(2)),
          invoiceCount: entry.invoiceCount,
        };
      });

      return {
        aggregation: 'hourly',
        dataPoints,
      };
    }

    // Generate all calendar days in range for Daily / Weekly aggregation
    const allDates = this.generateDateRange(startDateStr, endDateStr);

    // Query precomputed summaries
    const historicalDates = allDates.filter((d) => d !== todayStr);
    const summaryMap = new Map<string, any>();

    if (historicalDates.length > 0) {
      const summaries = await this.dailyRevenueSummaryModel.find({
        outletId: defaultOutlet._id,
        date: { $in: historicalDates },
      });
      for (const s of summaries) {
        summaryMap.set(s.date, s);
      }
    }

    // Resolve daily records
    const dailyRecords: Array<{
      date: string;
      netRevenue: number;
      grossRevenue: number;
      discounts: number;
      invoiceCount: number;
    }> = [];

    for (const date of allDates) {
      if (date === todayStr) {
        const live = await this.queryLiveInvoiceRevenue(
          tenantObjectId,
          defaultOutlet._id,
          date,
        );
        // Find grossRevenue and discounts for today
        const utcStart = new Date(`${todayStr}T00:00:00+05:30`);
        const utcEnd = new Date(`${todayStr}T23:59:59.999+05:30`);
        const invoices = await this.invoiceModel.find({
          tenantId: tenantObjectId,
          outletId: this.outletIdFilter(defaultOutlet._id.toString()),
          invoiceType: 'SALE',
          createdAt: { $gte: utcStart, $lte: utcEnd },
          isDeleted: false,
        });

        let grossRevenue = 0;
        let discounts = 0;
        for (const invoice of invoices) {
          grossRevenue += parseDecimal(invoice.subtotal);
          let itemDiscountTotal = 0;
          for (const item of invoice.items) {
            itemDiscountTotal += parseDecimal(item.itemDiscountAmount);
          }
          discounts +=
            itemDiscountTotal + parseDecimal(invoice.billDiscountAmount);
        }

        dailyRecords.push({
          date,
          netRevenue: live.netRevenue,
          grossRevenue,
          discounts,
          invoiceCount: live.totalInvoices,
        });
      } else if (summaryMap.has(date)) {
        const s = summaryMap.get(date)!;
        dailyRecords.push({
          date,
          netRevenue: parseDecimal(s.netRevenue),
          grossRevenue: parseDecimal(s.grossRevenue),
          discounts: parseDecimal(s.totalDiscounts),
          invoiceCount: s.totalInvoices,
        });
      } else {
        // Fallback live query for missing historical days
        const live = await this.queryLiveInvoiceRevenue(
          tenantObjectId,
          defaultOutlet._id,
          date,
        );
        dailyRecords.push({
          date,
          netRevenue: live.netRevenue,
          grossRevenue: live.netRevenue, // fallback approximation
          discounts: 0,
          invoiceCount: live.totalInvoices,
        });
      }
    }

    // --- CASE 2: Daily Aggregation (Duration <= 30 days) ---
    if (diffDays <= 30) {
      const dataPoints = dailyRecords.map((r) => ({
        label: r.date,
        netRevenue: parseFloat(r.netRevenue.toFixed(2)),
        grossRevenue: parseFloat(r.grossRevenue.toFixed(2)),
        discounts: parseFloat(r.discounts.toFixed(2)),
        invoiceCount: r.invoiceCount,
      }));

      return {
        aggregation: 'daily',
        dataPoints,
      };
    }

    // --- CASE 3: Weekly Aggregation (Duration > 30 days) ---
    const getMondayOfDate = (dateStr: string): string => {
      const date = new Date(`${dateStr}T00:00:00Z`);
      const day = date.getUTCDay();
      const diff = day === 0 ? 6 : day - 1;
      date.setUTCDate(date.getUTCDate() - diff);
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    };

    const weekMap = new Map<
      string,
      {
        netRevenue: number;
        grossRevenue: number;
        discounts: number;
        invoiceCount: number;
      }
    >();

    for (const r of dailyRecords) {
      const weekStart = getMondayOfDate(r.date);
      if (!weekMap.has(weekStart)) {
        weekMap.set(weekStart, {
          netRevenue: 0,
          grossRevenue: 0,
          discounts: 0,
          invoiceCount: 0,
        });
      }
      const entry = weekMap.get(weekStart)!;
      entry.netRevenue += r.netRevenue;
      entry.grossRevenue += r.grossRevenue;
      entry.discounts += r.discounts;
      entry.invoiceCount += r.invoiceCount;
    }

    const sortedWeeks = Array.from(weekMap.keys()).sort((a, b) =>
      a.localeCompare(b),
    );
    const dataPoints = sortedWeeks.map((w) => {
      const entry = weekMap.get(w)!;
      return {
        label: w,
        netRevenue: parseFloat(entry.netRevenue.toFixed(2)),
        grossRevenue: parseFloat(entry.grossRevenue.toFixed(2)),
        discounts: parseFloat(entry.discounts.toFixed(2)),
        invoiceCount: entry.invoiceCount,
      };
    });

    return {
      aggregation: 'weekly',
      dataPoints,
    };
  }

  /**
   * Helper to execute live invoice query for product-level sales on a single date.
   */
  private async queryLiveProductSales(
    tenantId: Types.ObjectId,
    outletId: Types.ObjectId,
    dateStr: string,
  ): Promise<
    Map<
      string,
      { unitsSold: number; refundedUnits: number; netRevenue: number }
    >
  > {
    const utcStart = new Date(`${dateStr}T00:00:00+05:30`);
    const utcEnd = new Date(`${dateStr}T23:59:59.999+05:30`);

    const invoices = await this.invoiceModel.find({
      tenantId,
      outletId: this.outletIdFilter(outletId.toString()),
      createdAt: { $gte: utcStart, $lte: utcEnd },
      isDeleted: false,
    });

    const productMap = new Map<
      string,
      {
        unitsSold: number;
        refundedUnits: number;
        grossRevenue: number;
        discountAmount: number;
      }
    >();

    const parseDecimal = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      return parseFloat(val.toString?.() || '0');
    };

    for (const invoice of invoices) {
      const isSale = invoice.invoiceType === 'SALE';
      const isRefund = invoice.invoiceType === 'REFUND';

      const subtotal = parseDecimal(invoice.subtotal);
      const billDiscountAmount = parseDecimal(invoice.billDiscountAmount);

      for (const item of invoice.items) {
        const productId = item.productId.toString();
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            unitsSold: 0,
            refundedUnits: 0,
            grossRevenue: 0,
            discountAmount: 0,
          });
        }

        const entry = productMap.get(productId)!;
        const lineTotal = parseDecimal(item.lineTotal);
        const itemDiscountAmount = parseDecimal(item.itemDiscountAmount);
        const unitPrice = parseDecimal(item.unitPrice);
        const qty = item.quantity;

        if (isSale) {
          entry.unitsSold += qty;
          entry.grossRevenue += unitPrice * qty;

          const billDiscountShare =
            subtotal > 0 ? (lineTotal / subtotal) * billDiscountAmount : 0;
          entry.discountAmount += itemDiscountAmount + billDiscountShare;
        } else if (isRefund) {
          entry.refundedUnits += qty;
        }
      }
    }

    const resultMap = new Map<
      string,
      { unitsSold: number; refundedUnits: number; netRevenue: number }
    >();

    for (const [productId, data] of productMap.entries()) {
      const netUnitsSold = Math.max(0, data.unitsSold - data.refundedUnits);
      const netRevenue = Math.max(0, data.grossRevenue - data.discountAmount);
      resultMap.set(productId, {
        unitsSold: netUnitsSold,
        refundedUnits: data.refundedUnits,
        netRevenue,
      });
    }

    return resultMap;
  }

  /**
   * Returns top 10 products by net revenue or units sold in the given period.
   */
  async getTopProducts(
    tenantId: string,
    period: string,
    dateFrom?: string,
    dateTo?: string,
    sortBy: 'revenue' | 'units_sold' = 'revenue',
  ): Promise<{
    topProducts: Array<{
      rank: number;
      productId: string;
      productName: string;
      netRevenue: number;
      unitsSold: number;
      percentOfTotal: number;
    }>;
    totalNetRevenue: number;
    totalUnitsSold: number;
  }> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const defaultOutlet = await this.outletService.getDefault(tenantId);

    // 1. Resolve date range in IST
    const { startDateStr, endDateStr } = this.resolveDateRange(
      period,
      dateFrom,
      dateTo,
    );

    const allDates = this.generateDateRange(startDateStr, endDateStr);
    const todayStr = todayIST();
    const historicalDates = allDates.filter((d) => d !== todayStr);

    const productStats = new Map<
      string,
      {
        netRevenue: number;
        unitsSold: number;
      }
    >();

    const parseDecimal = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      return parseFloat(val.toString?.() || '0');
    };

    // 2. Fetch historical from DailyProductSales
    if (historicalDates.length > 0) {
      const historicalSales = await this.dailyProductSalesModel.find({
        outletId: defaultOutlet._id,
        date: { $in: historicalDates },
      });

      for (const sale of historicalSales) {
        const pId = sale.productId.toString();
        if (!productStats.has(pId)) {
          productStats.set(pId, { netRevenue: 0, unitsSold: 0 });
        }
        const stat = productStats.get(pId)!;
        stat.netRevenue += parseDecimal(sale.netRevenue);
        stat.unitsSold += sale.netUnitsSold; // Using netUnitsSold for output unitsSold
      }
    }

    // 3. Fetch today's live data
    if (allDates.includes(todayStr)) {
      const liveSales = await this.queryLiveProductSales(
        tenantObjectId,
        defaultOutlet._id,
        todayStr,
      );

      for (const [pId, data] of liveSales.entries()) {
        if (!productStats.has(pId)) {
          productStats.set(pId, { netRevenue: 0, unitsSold: 0 });
        }
        const stat = productStats.get(pId)!;
        stat.netRevenue += data.netRevenue;
        stat.unitsSold += data.unitsSold; // This is the netUnitsSold from the live query
      }
    }

    // 4. Calculate total net revenue and total units sold across all products
    let totalNetRevenue = 0;
    let totalUnitsSold = 0;
    for (const stat of productStats.values()) {
      totalNetRevenue += stat.netRevenue;
      totalUnitsSold += stat.unitsSold;
    }

    // 5. Sort descending by selected metric
    const sortedProducts = Array.from(productStats.entries()).map(
      ([productId, stat]) => ({
        productId,
        netRevenue: stat.netRevenue,
        unitsSold: stat.unitsSold,
      }),
    );
    if (sortBy === 'units_sold') {
      sortedProducts.sort((a, b) => b.unitsSold - a.unitsSold);
    } else {
      sortedProducts.sort((a, b) => b.netRevenue - a.netRevenue);
    }

    // 6. Take top 10
    const top10 = sortedProducts.slice(0, 10);

    // 7. Resolve product names
    const productIds = top10.map((p) => new Types.ObjectId(p.productId));
    const products = await this.productModel.find({
      _id: { $in: productIds },
    });
    const productNameMap = new Map<string, string>();
    for (const p of products) {
      productNameMap.set(p._id!.toString(), p.name);
    }

    // 8. Build response
    const topProducts = top10.map((p, index) => {
      const productName = productNameMap.get(p.productId) || p.productId;

      let percentOfTotal = 0;
      if (sortBy === 'units_sold') {
        percentOfTotal =
          totalUnitsSold > 0 ? (p.unitsSold / totalUnitsSold) * 100 : 0;
      } else {
        percentOfTotal =
          totalNetRevenue > 0 ? (p.netRevenue / totalNetRevenue) * 100 : 0;
      }

      return {
        rank: index + 1,
        productId: p.productId,
        productName,
        netRevenue: parseFloat(p.netRevenue.toFixed(2)),
        unitsSold: p.unitsSold,
        percentOfTotal: parseFloat(percentOfTotal.toFixed(2)),
      };
    });

    return {
      topProducts,
      totalNetRevenue: parseFloat(totalNetRevenue.toFixed(2)),
      totalUnitsSold,
    };
  }

  /**
   * Returns breakdown of sales grouped by payment method (CASH, CARD, UPI) for a given period.
   * Computed live from the Invoice collection.
   */
  async getPaymentBreakdown(
    tenantId: string,
    period: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{
    paymentBreakdown: Array<{
      paymentMethod: 'CASH' | 'CARD' | 'UPI';
      invoiceCount: number;
      totalAmount: number;
      percentage: number;
    }>;
    totalInvoices: number;
    totalAmount: number;
  }> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const defaultOutlet = await this.outletService.getDefault(tenantId);

    // 1. Resolve date range in IST
    const { startDateStr, endDateStr } = this.resolveDateRange(
      period,
      dateFrom,
      dateTo,
    );

    const startUtc = new Date(`${startDateStr}T00:00:00+05:30`);
    const endUtc = new Date(`${endDateStr}T23:59:59.999+05:30`);

    // 2. Perform live aggregation on Invoice collection
    const aggregations = await this.invoiceModel.aggregate([
      {
        $match: {
          tenantId: tenantObjectId,
          outletId: this.outletIdFilter(defaultOutlet._id.toString()),
          invoiceType: 'SALE',
          createdAt: { $gte: startUtc, $lte: endUtc },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$paymentMethod',
          invoiceCount: { $sum: 1 },
          totalAmount: { $sum: '$grandTotal' },
        },
      },
    ]);

    // Parse decimal type cleanly if needed
    const parseDecimal = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      return parseFloat(val.toString?.() || '0');
    };

    // 3. Map aggregations into a lookup map
    const statsMap = new Map<string, { count: number; amount: number }>();
    for (const agg of aggregations) {
      if (agg._id) {
        const methodStr = agg._id.toString().toUpperCase();
        statsMap.set(methodStr, {
          count: agg.invoiceCount || 0,
          amount: parseDecimal(agg.totalAmount),
        });
      }
    }

    // 4. Ensure CASH, CARD, and UPI are always present
    const methods: Array<'CASH' | 'CARD' | 'UPI'> = ['CASH', 'CARD', 'UPI'];
    let totalInvoices = 0;
    let totalAmountSum = 0;

    const rawBreakdown = methods.map((method) => {
      const stats = statsMap.get(method) || { count: 0, amount: 0 };
      totalInvoices += stats.count;
      totalAmountSum += stats.amount;
      return {
        paymentMethod: method,
        invoiceCount: stats.count,
        totalAmount: stats.amount,
      };
    });

    // 5. Calculate percentages based on invoice count
    const paymentBreakdown = rawBreakdown.map((item) => {
      const percentage =
        totalInvoices > 0 ? (item.invoiceCount / totalInvoices) * 100 : 0;
      return {
        ...item,
        totalAmount: parseFloat(item.totalAmount.toFixed(2)),
        percentage: parseFloat(percentage.toFixed(2)),
      };
    });

    return {
      paymentBreakdown,
      totalInvoices,
      totalAmount: parseFloat(totalAmountSum.toFixed(2)),
    };
  }

  /**
   * Returns GST collected in the period, plus a count of GST vs non-GST invoices.
   * Uses hybrid precomputed data for totalGstCollected and strictly live count for invoices.
   */
  async getGstSummary(
    tenantId: string,
    period: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{
    totalGstCollected: number;
    gstInvoiceCount: number;
    nonGstInvoiceCount: number;
    hasGstData: boolean;
  }> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const defaultOutlet = await this.outletService.getDefault(tenantId);

    // 1. Resolve date range in IST
    const { startDateStr, endDateStr } = this.resolveDateRange(
      period,
      dateFrom,
      dateTo,
    );

    const allDates = this.generateDateRange(startDateStr, endDateStr);
    const todayStr = todayIST();

    const historicalDates = allDates.filter((d) => d !== todayStr);
    const summaryMap = new Map<string, any>();

    if (historicalDates.length > 0) {
      const summaries = await this.dailyRevenueSummaryModel.find({
        outletId: defaultOutlet._id,
        date: { $in: historicalDates },
      });
      for (const s of summaries) {
        summaryMap.set(s.date, s);
      }
    }

    let totalGstCollected = 0;

    const parseDecimal = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      return parseFloat(val.toString?.() || '0');
    };

    // 2. Aggregate totalGstCollected day-by-day (hybrid approach)
    for (const date of allDates) {
      if (date === todayStr) {
        const liveGst = await this.queryLiveGstAmount(
          tenantObjectId,
          defaultOutlet._id,
          date,
        );
        totalGstCollected += liveGst;
      } else if (summaryMap.has(date)) {
        const s = summaryMap.get(date)!;
        totalGstCollected += parseDecimal(s.totalGstAmount);
      } else {
        const liveGst = await this.queryLiveGstAmount(
          tenantObjectId,
          defaultOutlet._id,
          date,
        );
        totalGstCollected += liveGst;
      }
    }

    // 3. Count of SALE invoices with gstEnabled = true vs gstEnabled = false for the ENTIRE period (strictly live query)
    const startUtc = new Date(`${startDateStr}T00:00:00+05:30`);
    const endUtc = new Date(`${endDateStr}T23:59:59.999+05:30`);

    const countAgg = await this.invoiceModel.aggregate([
      {
        $match: {
          tenantId: tenantObjectId,
          outletId: this.outletIdFilter(defaultOutlet._id.toString()),
          invoiceType: 'SALE',
          createdAt: { $gte: startUtc, $lte: endUtc },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$gstEnabled',
          count: { $sum: 1 },
        },
      },
    ]);

    let gstInvoiceCount = 0;
    let nonGstInvoiceCount = 0;

    for (const item of countAgg) {
      if (item._id === true) {
        gstInvoiceCount = item.count;
      } else if (item._id === false) {
        nonGstInvoiceCount = item.count;
      }
    }

    const hasGstData = totalGstCollected > 0 || gstInvoiceCount > 0;

    return {
      totalGstCollected: parseFloat(totalGstCollected.toFixed(2)),
      gstInvoiceCount,
      nonGstInvoiceCount,
      hasGstData,
    };
  }

  /**
   * Helper to execute live invoice query for GST amount on a single date.
   */
  private async queryLiveGstAmount(
    tenantId: Types.ObjectId,
    outletId: Types.ObjectId,
    dateStr: string,
  ): Promise<number> {
    const utcStart = new Date(`${dateStr}T00:00:00+05:30`);
    const utcEnd = new Date(`${dateStr}T23:59:59.999+05:30`);

    const result = await this.invoiceModel.aggregate([
      {
        $match: {
          tenantId,
          outletId: this.outletIdFilter(outletId.toString()),
          invoiceType: 'SALE',
          createdAt: { $gte: utcStart, $lte: utcEnd },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalGst: { $sum: '$totalGstAmount' },
        },
      },
    ]);

    if (result.length === 0) return 0;

    const parseDecimal = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      return parseFloat(val.toString?.() || '0');
    };

    return parseDecimal(result[0].totalGst);
  }

  private outletIdFilter(outletId: string): any {
    try {
      return { $in: [outletId, new Types.ObjectId(outletId)] };
    } catch {
      return outletId;
    }
  }
}
