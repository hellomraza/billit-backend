import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Outlet extends Document {
  @Prop({ required: true, type: Types.ObjectId })
  tenantId: Types.ObjectId;

  @Prop({ required: true, type: String })
  outletName: string;

  @Prop({ required: true, minlength: 3, maxlength: 6, type: String })
  outletAbbr: string;

  @Prop({ type: String })
  address?: string;

  @Prop({ type: String })
  city?: string;

  @Prop({ type: String })
  state?: string;

  @Prop({ type: String })
  pincode?: string;

  @Prop({ default: false, type: Boolean })
  isDefault: boolean;

  @Prop({ default: false, type: Boolean })
  abbrLocked: boolean;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const OutletSchema = SchemaFactory.createForClass(Outlet);

// Indexes
OutletSchema.index({ tenantId: 1 });
