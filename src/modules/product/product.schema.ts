import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  _id?: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, type: 'Decimal128' })
  basePrice: any;

  @Prop({ required: true, enum: [0, 5, 12, 18, 28] })
  gstRate: number;

  @Prop({ required: true, min: 1 })
  deficitThreshold: number;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Indexes
ProductSchema.index({ tenantId: 1, isDeleted: 1 });
ProductSchema.index({ tenantId: 1, name: 'text' });
