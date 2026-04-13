import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum DeficitStatus {
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
}

export enum ResolutionMethod {
  STOCK_ADDITION = 'STOCK_ADDITION',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum AdjustmentReason {
  DAMAGE = 'DAMAGE',
  LOSS = 'LOSS',
  CORRECTION = 'CORRECTION',
}

@Schema({ timestamps: true })
export class DeficitRecord extends Document {
  @Prop({ required: true, type: Types.ObjectId })
  tenantId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  productId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  outletId: Types.ObjectId;

  @Prop({ required: true })
  quantity: number;

  @Prop({ type: Types.ObjectId })
  linkedInvoiceId: Types.ObjectId;

  @Prop({ required: true, enum: DeficitStatus, default: DeficitStatus.PENDING })
  status: DeficitStatus;

  @Prop({ enum: ResolutionMethod })
  resolutionMethod: ResolutionMethod;

  @Prop({ enum: AdjustmentReason })
  adjustmentReason: AdjustmentReason;

  @Prop()
  resolvedAt: Date;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const DeficitRecordSchema = SchemaFactory.createForClass(DeficitRecord);

// Indexes
DeficitRecordSchema.index({
  tenantId: 1,
  productId: 1,
  outletId: 1,
  status: 1,
});
DeficitRecordSchema.index({ tenantId: 1, createdAt: -1 });
