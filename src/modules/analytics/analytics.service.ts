import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Stock } from '../stock/stock.schema';
import { Product } from '../product/product.schema';
import { DailyProductSales } from './schemas/daily-product-sales.schema';
import { Invoice } from '../invoice/invoice.schema';
import { DeficitRecord, DeficitStatus } from '../deficit/deficit.schema';
import {
  DailyRevenueSummary,
  DailyRevenueSummaryDocument,
} from './schemas/daily-revenue-summary.schema';
import { OutletService } from '../outlet/outlet.service';

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
          quantity: { $lte: 10 },
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
        },
      },
      {
        $project: {
          _id: 0,
          productId: '$productId',
          productName: '$product.name',
          currentStock: '$quantity',
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
    insufficientReason: 'INSUFFICIENT_PRODUCTS' | 'INSUFFICIENT_DIFFERENTIATION' | null;
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

    this.logger.log(`[HealthDebug] tenantId=${tenantId} outletId=${defaultOutlet._id} startDateStr=${startDateStr} endDateStr=${endDateStr}`);

    // 2. Query historical sales from DailyProductSales
    const historicalSales = await this.dailyProductSalesModel.find({
      outletId: defaultOutlet._id,
      date: { $gte: startDateStr, $lte: endDateStr },
    });

    this.logger.log(`[HealthDebug] historicalSales count=${historicalSales.length}`);

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

    if (maxAvgDaily - minAvgDaily <= 2) {
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
      const index = Math.max(
        0,
        slowCandidates.length - bottom20PercentCount,
      );
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

  private outletIdFilter(outletId: string): any {
    try {
      return { $in: [outletId, new Types.ObjectId(outletId)] };
    } catch {
      return outletId;
    }
  }
}
