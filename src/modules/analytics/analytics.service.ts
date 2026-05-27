import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Stock } from '../stock/stock.schema';
import { OutletService } from '../outlet/outlet.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(Stock.name) private readonly stockModel: Model<Stock>,
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

    // 1. Get default outlet for the tenant
    const defaultOutlet = await this.outletService.getDefault(tenantId);

    // 2. Perform aggregate lookup to fetch stock <= 10 joined with active products
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
          currentStock: 1, // Sort ascending by stock quantity
        },
      },
    ]);

    // 3. Map to compute stockStatus
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
}
