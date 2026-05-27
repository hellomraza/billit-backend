import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Stock } from '../stock/stock.schema';
import { Product } from '../product/product.schema';
import { DailyProductSales } from './schemas/daily-product-sales.schema';
import { Invoice } from '../invoice/invoice.schema';
import { DeficitRecord, DeficitStatus } from '../deficit/deficit.schema';
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

  private outletIdFilter(outletId: string): any {
    try {
      return { $in: [outletId, new Types.ObjectId(outletId)] };
    } catch {
      return outletId;
    }
  }
}
