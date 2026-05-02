import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Stock extends Document {
  @Prop({ required: true, type: Types.ObjectId })
  tenantId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  productId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  outletId: Types.ObjectId;

  @Prop({ required: true, default: 0, type: Number })
  quantity: number;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const StockSchema = SchemaFactory.createForClass(Stock);

// Indexes
StockSchema.index({ productId: 1, outletId: 1 }, { unique: true });
StockSchema.index({ tenantId: 1 });
