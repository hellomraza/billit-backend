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

  @Prop({ required: true, type: Number })
  quantity: number;

  @Prop({ type: Types.ObjectId })
  linkedInvoiceId: Types.ObjectId;

  @Prop({
    required: true,
    enum: DeficitStatus,
    default: DeficitStatus.PENDING,
    type: String,
  })
  status: DeficitStatus;

  @Prop({ enum: ResolutionMethod, type: String })
  resolutionMethod: ResolutionMethod;

  @Prop({ enum: AdjustmentReason, type: String })
  adjustmentReason: AdjustmentReason;

  @Prop({ type: Date })
  resolvedAt: Date;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
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
