import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Outlet extends Document {
  @Prop({ required: true, type: Types.ObjectId })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  outletName: string;

  @Prop({ required: true, minlength: 3, maxlength: 6 })
  outletAbbr: string;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ default: false })
  abbrLocked: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const OutletSchema = SchemaFactory.createForClass(Outlet);

// Indexes
OutletSchema.index({ tenantId: 1 });
