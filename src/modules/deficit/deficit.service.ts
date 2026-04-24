import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { DatabaseService } from '../../database/database.service';
import { ChangeType } from '../stock-audit/stock-audit.schema';
import { StockAuditLogService } from '../stock-audit/stock-audit.service';
import {
  AdjustmentReason,
  DeficitRecord,
  DeficitStatus,
  ResolutionMethod,
} from './deficit.schema';

@Injectable()
export class DeficitService {
  constructor(
    @InjectModel(DeficitRecord.name) private deficitModel: Model<DeficitRecord>,
    private databaseService: DatabaseService,
    private stockAuditLogService: StockAuditLogService,
  ) {}

  async create(
    tenantId: string,
    productId: string,
    outletId: string,
    quantity: number,
    linkedInvoiceId?: Types.ObjectId,
    session?: ClientSession,
  ): Promise<DeficitRecord> {
    const deficit = new this.deficitModel({
      tenantId: new Types.ObjectId(tenantId),
      productId: new Types.ObjectId(productId),
      outletId: new Types.ObjectId(outletId),
      quantity,
      linkedInvoiceId,
      status: DeficitStatus.PENDING,
    });

    return deficit.save({ session });
  }

  async findById(tenantId: string, deficitId: string): Promise<DeficitRecord> {
    const deficit = await this.deficitModel.findOne({
      _id: deficitId,
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!deficit) {
      throw new NotFoundException('Deficit record not found');
    }

    return deficit;
  }

  async findPendingByProduct(
    tenantId: string,
    productId: string,
  ): Promise<DeficitRecord[]> {
    return this.deficitModel.find({
      tenantId: new Types.ObjectId(tenantId),
      productId: new Types.ObjectId(productId),
      status: DeficitStatus.PENDING,
    });
  }

  async findPendingByOutlet(
    tenantId: string,
    outletId: string,
  ): Promise<DeficitRecord[]> {
    return this.deficitModel.find({
      tenantId: new Types.ObjectId(tenantId),
      outletId: new Types.ObjectId(outletId),
      status: DeficitStatus.PENDING,
    });
  }

  async findAll(
    tenantId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: DeficitRecord[]; total: number }> {
    const skip = (page - 1) * limit;
    const query = { tenantId: new Types.ObjectId(tenantId) };

    const data = await this.deficitModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await this.deficitModel.countDocuments(query);

    return { data, total };
  }

  async resolve(
    tenantId: string,
    deficitId: string,
    resolutionMethod: ResolutionMethod,
    adjustmentReason?: AdjustmentReason,
  ): Promise<DeficitRecord> {
    const deficit = await this.deficitModel.findOneAndUpdate(
      {
        _id: deficitId,
        tenantId: new Types.ObjectId(tenantId),
        status: DeficitStatus.PENDING,
      },
      {
        status: DeficitStatus.RESOLVED,
        resolutionMethod,
        adjustmentReason,
        resolvedAt: new Date(),
      },
      { new: true },
    );

    if (!deficit) {
      throw new NotFoundException(
        'Deficit record not found or already resolved',
      );
    }

    return deficit;
  }

  async getPendingCount(
    tenantId: string,
    productId: string,
    outletId: string,
  ): Promise<number> {
    return this.deficitModel.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
      productId: new Types.ObjectId(productId),
      outletId: new Types.ObjectId(outletId),
      status: DeficitStatus.PENDING,
    });
  }

  async getTotalPendingQuantity(
    tenantId: string,
    productId: string,
    outletId: string,
  ): Promise<number> {
    const result = await this.deficitModel.aggregate([
      {
        $match: {
          tenantId: new Types.ObjectId(tenantId),
          productId: new Types.ObjectId(productId),
          outletId: new Types.ObjectId(outletId),
          status: DeficitStatus.PENDING,
        },
      },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$quantity' },
        },
      },
    ]);

    return result.length > 0 ? result[0].totalQuantity : 0;
  }

  /**
   * Find all pending deficits for tenant, grouped by product
   * Returns flat structure with product data to be enriched by caller
   */
  async findPendingGroupedByProduct(tenantId: string): Promise<
    Array<{
      productId: string;
      productName: string;
      deficitThreshold: number;
      totalPendingQuantity: number;
      recordCount: number;
      outlets: Array<{ outletId: string; pendingQuantity: number }>;
    }>
  > {
    // This requires joining with product data, so we'll fetch deficits and aggregate
    const deficits = await this.deficitModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        status: DeficitStatus.PENDING,
      })
      .lean();

    // Group by product
    const grouped = new Map<
      string,
      {
        productId: Types.ObjectId;
        outlets: Map<string, number>;
        totalQuantity: number;
        recordCount: number;
      }
    >();

    for (const deficit of deficits) {
      const key = deficit.productId.toString();
      if (!grouped.has(key)) {
        grouped.set(key, {
          productId: deficit.productId,
          outlets: new Map(),
          totalQuantity: 0,
          recordCount: 0,
        });
      }

      const group = grouped.get(key);
      if (group) {
        const outletKey = deficit.outletId.toString();
        group.outlets.set(
          outletKey,
          (group.outlets.get(outletKey) || 0) + deficit.quantity,
        );
        group.totalQuantity += deficit.quantity;
        group.recordCount += 1;
      }
    }

    // Convert to array format (product name and threshold would need to be fetched from product service)
    return Array.from(grouped.values()).map((group) => ({
      productId: group.productId.toString(),
      productName: '', // Would be populated by controller from product service
      deficitThreshold: 0, // Would be populated by controller from product service
      totalPendingQuantity: group.totalQuantity,
      recordCount: group.recordCount,
      outlets: Array.from(group.outlets.entries()).map(
        ([outletId, quantity]) => ({
          outletId,
          pendingQuantity: quantity,
        }),
      ),
    }));
  }

  /**
   * Find all pending deficits grouped by product with full details
   * Includes latest deficit date per product-level view
   */
  async findAllGroupedByProduct(
    tenantId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: Array<{
      productId: string;
      productName: string;
      totalPendingDeficit: number;
      pendingRecordCount: number;
      latestDeficitDate: Date;
      deficitThreshold: number;
      records: Array<{
        deficitId: string;
        outletName: string;
        quantity: number;
        linkedInvoiceId?: string;
        createdAt: Date;
      }>;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    // Get all pending deficits with full data
    const allDeficits = await this.deficitModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        status: DeficitStatus.PENDING,
      })
      .populate('productId', 'name deficitThreshold')
      .populate('outletId', 'outletName')
      .lean();

    // Group by product ID
    const grouped = new Map<
      string,
      {
        productId: string;
        productName: string;
        deficitThreshold: number;
        totalPendingDeficit: number;
        pendingRecordCount: number;
        latestDeficitDate: Date;
        records: Array<{
          deficitId: string;
          outletName: string;
          quantity: number;
          linkedInvoiceId?: string;
          createdAt: Date;
        }>;
      }
    >();

    for (const deficit of allDeficits) {
      const productId = deficit.productId._id.toString();
      const productName = (deficit.productId as any).name || 'Unknown';
      const deficitThreshold = (deficit.productId as any).deficitThreshold || 0;

      if (!grouped.has(productId)) {
        grouped.set(productId, {
          productId,
          productName,
          deficitThreshold,
          totalPendingDeficit: 0,
          pendingRecordCount: 0,
          latestDeficitDate: new Date(),
          records: [],
        });
      }

      const group = grouped.get(productId)!;
      group.totalPendingDeficit += deficit.quantity;
      group.pendingRecordCount += 1;
      group.latestDeficitDate = new Date(
        Math.max(
          group.latestDeficitDate.getTime(),
          deficit.createdAt.getTime(),
        ),
      );

      const outletName = (deficit.outletId as any)?.outletName || 'Unknown';
      group.records.push({
        deficitId: deficit._id.toString(),
        outletName,
        quantity: deficit.quantity,
        linkedInvoiceId: deficit.linkedInvoiceId?.toString(),
        createdAt: deficit.createdAt,
      });
    }

    // Convert to array and sort by latest deficit date
    const groupedArray = Array.from(grouped.values()).sort(
      (a, b) => b.latestDeficitDate.getTime() - a.latestDeficitDate.getTime(),
    );

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedData = groupedArray.slice(skip, skip + limit);

    return {
      data: paginatedData,
      total: groupedArray.length,
      page,
      limit,
    };
  }

  /**
   * Resolve deficit by stock addition
   */
  async resolveByStockAddition(
    tenantId: string,
    productId: string,
    outletId: string | null,
    quantity: number,
  ): Promise<DeficitRecord[]> {
    // Find all pending deficits for this product (optionally at specific outlet)
    const query: any = {
      tenantId: new Types.ObjectId(tenantId),
      productId: new Types.ObjectId(productId),
      status: DeficitStatus.PENDING,
    };

    if (outletId) {
      query.outletId = new Types.ObjectId(outletId);
    }

    const deficits = await this.deficitModel.find(query).sort({ createdAt: 1 });

    if (deficits.length === 0) {
      throw new NotFoundException('No pending deficits found for this product');
    }

    let remainingQuantity = quantity;
    const resolved: DeficitRecord[] = [];

    // Resolve deficits in FIFO order until quantity is consumed
    for (const deficit of deficits) {
      if (remainingQuantity <= 0) break;

      const quantityToResolve = Math.min(deficit.quantity, remainingQuantity);

      if (quantityToResolve === deficit.quantity) {
        // Fully resolve this deficit
        const updated = await this.deficitModel.findByIdAndUpdate(
          deficit._id,
          {
            status: DeficitStatus.RESOLVED,
            resolutionMethod: ResolutionMethod.STOCK_ADDITION,
            resolvedAt: new Date(),
          },
          { new: true },
        );
        if (updated) {
          // Create audit log for deficit resolution
          await this.stockAuditLogService.create(
            tenantId,
            productId,
            deficit.outletId.toString(),
            0,
            quantityToResolve,
            ChangeType.MANUAL_UPDATE,
            deficit._id,
          );
          resolved.push(updated);
        }
      } else {
        // Partially resolve - create resolved record and update original
        await this.deficitModel.findByIdAndUpdate(
          deficit._id,
          {
            quantity: deficit.quantity - quantityToResolve,
          },
          { new: true },
        );

        // Create a historical record of the resolved portion
        const resolvedRecord = new this.deficitModel({
          tenantId: deficit.tenantId,
          productId: deficit.productId,
          outletId: deficit.outletId,
          quantity: quantityToResolve,
          linkedInvoiceId: deficit.linkedInvoiceId,
          status: DeficitStatus.RESOLVED,
          resolutionMethod: ResolutionMethod.STOCK_ADDITION,
          resolvedAt: new Date(),
        });
        const saved = await resolvedRecord.save();
        // Create audit log for partial deficit resolution
        await this.stockAuditLogService.create(
          tenantId,
          productId,
          deficit.outletId.toString(),
          0,
          quantityToResolve,
          ChangeType.MANUAL_UPDATE,
          saved._id,
        );
        resolved.push(saved);
      }

      remainingQuantity -= quantityToResolve;
    }

    return resolved;
  }

  /**
   * Resolve deficit by adjustment (damage, loss, correction)
   */
  async resolveByAdjustment(
    tenantId: string,
    productId: string,
    outletId: string | null,
    reason: AdjustmentReason,
  ): Promise<DeficitRecord[]> {
    // Find all pending deficits for this product (optionally at specific outlet)
    const query: any = {
      tenantId: new Types.ObjectId(tenantId),
      productId: new Types.ObjectId(productId),
      status: DeficitStatus.PENDING,
    };

    if (outletId) {
      query.outletId = new Types.ObjectId(outletId);
    }

    // Find all pending deficits before updating
    const pendingDeficits = await this.deficitModel.find(query).exec();

    // Find and update all matching deficits
    const updateResult = await this.deficitModel.updateMany(query, {
      status: DeficitStatus.RESOLVED,
      resolutionMethod: ResolutionMethod.ADJUSTMENT,
      adjustmentReason: reason,
      resolvedAt: new Date(),
    });

    if (updateResult.modifiedCount === 0) {
      throw new NotFoundException('No pending deficits found for this product');
    }

    // Create audit logs for each resolved deficit (adjustment/write-off)
    for (const deficit of pendingDeficits) {
      await this.stockAuditLogService.create(
        tenantId,
        productId,
        deficit.outletId.toString(),
        deficit.quantity,
        0,
        ChangeType.MANUAL_UPDATE,
        deficit._id,
      );
    }

    // Fetch and return the updated records
    return this.deficitModel.find(query).exec();
  }

  /**
   * Find all deficits (pending and resolved) for a tenant with pagination
   */
  async findAllWithStatus(
    tenantId: string,
    status?: DeficitStatus,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: DeficitRecord[]; total: number }> {
    const skip = (page - 1) * limit;
    const query: any = { tenantId: new Types.ObjectId(tenantId) };

    if (status) {
      query.status = status;
    }

    const data = await this.deficitModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await this.deficitModel.countDocuments(query);

    return { data, total };
  }

  /**
   * Find deficits by product and status (for product deletion validation)
   */
  async findByProductAndStatus(
    tenantId: string,
    productId: string,
    status: DeficitStatus,
  ): Promise<DeficitRecord[]> {
    return this.deficitModel.find({
      tenantId: new Types.ObjectId(tenantId),
      productId: new Types.ObjectId(productId),
      status,
    });
  }
}
