import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { ChangeType, StockAuditLog } from './stock-audit.schema';

@Injectable()
export class StockAuditLogService {
  constructor(
    @InjectModel(StockAuditLog.name)
    private auditLogModel: Model<StockAuditLog>,
  ) {}

  async create(
    tenantId: string,
    productId: string,
    outletId: string,
    previousQuantity: number,
    newQuantity: number,
    changeType: ChangeType,
    referenceId?: Types.ObjectId,
    session?: ClientSession,
  ): Promise<StockAuditLog> {
    const auditLog = new this.auditLogModel({
      tenantId: new Types.ObjectId(tenantId),
      productId: new Types.ObjectId(productId),
      outletId: new Types.ObjectId(outletId),
      previousQuantity,
      newQuantity,
      changeType,
      referenceId,
      changedAt: new Date(),
    });

    return auditLog.save({ session });
  }

  async findByProduct(
    tenantId: string,
    productId: string,
  ): Promise<StockAuditLog[]> {
    return this.auditLogModel.find({
      tenantId: new Types.ObjectId(tenantId),
      productId: new Types.ObjectId(productId),
    });
  }

  async findByOutlet(
    tenantId: string,
    outletId: string,
  ): Promise<StockAuditLog[]> {
    return this.auditLogModel.find({
      tenantId: new Types.ObjectId(tenantId),
      outletId: new Types.ObjectId(outletId),
    });
  }

  async findAll(
    tenantId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: StockAuditLog[]; total: number }> {
    const skip = (page - 1) * limit;
    const query = { tenantId: new Types.ObjectId(tenantId) };

    const data = await this.auditLogModel
      .find(query)
      .sort({ changedAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await this.auditLogModel.countDocuments(query);

    return { data, total };
  }

  async findByProductAndOutlet(
    tenantId: string,
    productId: string,
    outletId: string,
  ): Promise<StockAuditLog[]> {
    return this.auditLogModel.find({
      tenantId: new Types.ObjectId(tenantId),
      productId: new Types.ObjectId(productId),
      outletId: new Types.ObjectId(outletId),
    });
  }

  async findByChangeType(
    tenantId: string,
    changeType: ChangeType,
  ): Promise<StockAuditLog[]> {
    return this.auditLogModel.find({
      tenantId: new Types.ObjectId(tenantId),
      changeType,
    });
  }

  async getSalesHistory(
    tenantId: string,
    outletId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<StockAuditLog[]> {
    return this.auditLogModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        outletId: new Types.ObjectId(outletId),
        changeType: ChangeType.SALE,
        changedAt: { $gte: startDate, $lte: endDate },
      })
      .sort({ changedAt: -1 });
  }
}
