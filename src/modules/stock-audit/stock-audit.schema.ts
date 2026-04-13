import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ChangeType {
  SALE = 'SALE',
  MANUAL_UPDATE = 'MANUAL_UPDATE',
}

@Schema({ timestamps: false })
export class StockAuditLog extends Document {
  @Prop({ required: true, type: Types.ObjectId })
  tenantId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  productId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  outletId: Types.ObjectId;

  @Prop({ required: true })
  previousQuantity: number;

  @Prop({ required: true })
  newQuantity: number;

  @Prop({ required: true, enum: ChangeType })
  changeType: ChangeType;

  @Prop({ type: Types.ObjectId })
  referenceId: Types.ObjectId;

  @Prop({ required: true, default: () => new Date() })
  changedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const StockAuditLogSchema = SchemaFactory.createForClass(StockAuditLog);

// Indexes
StockAuditLogSchema.index({ tenantId: 1, changedAt: -1 });
StockAuditLogSchema.index({ productId: 1, outletId: 1 });
