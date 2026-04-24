import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: false })
export class DailyInvoiceCounter extends Document {
  @Prop({ required: true, type: Types.ObjectId })
  outletId: Types.ObjectId;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD format

  @Prop({ required: true, default: 0 })
  lastCounter: number;

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}

export const DailyInvoiceCounterSchema =
  SchemaFactory.createForClass(DailyInvoiceCounter);

// Indexes
DailyInvoiceCounterSchema.index({ outletId: 1, date: 1 }, { unique: true });
