import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DatabaseService } from '../../database/database.service';
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
  ) {}

  async create(
    tenantId: string,
    productId: string,
    outletId: string,
    quantity: number,
    linkedInvoiceId?: Types.ObjectId,
  ): Promise<DeficitRecord> {
    const deficit = new this.deficitModel({
      tenantId: new Types.ObjectId(tenantId),
      productId: new Types.ObjectId(productId),
      outletId: new Types.ObjectId(outletId),
      quantity,
      linkedInvoiceId,
      status: DeficitStatus.PENDING,
    });

    return deficit.save();
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
}
