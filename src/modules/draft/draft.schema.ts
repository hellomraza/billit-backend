import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum DraftPaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
}

export interface DraftItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: any;
  gstRate: number;
}

export type DraftDocument = Draft & Document;

@Schema({ timestamps: true })
export class Draft {
  _id?: Types.ObjectId;

  @Prop({ required: true })
  clientDraftId: string;

  @Prop({ required: true, type: Types.ObjectId })
  tenantId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  outletId: Types.ObjectId;

  @Prop({ maxlength: 50, default: null })
  tabLabel?: string | null;

  @Prop({ required: true, type: [Object], default: [] })
  items: DraftItem[];

  @Prop({ default: null })
  customerName?: string | null;

  @Prop({ default: null })
  customerPhone?: string | null;

  @Prop({ enum: DraftPaymentMethod, default: null })
  paymentMethod?: DraftPaymentMethod | null;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  syncedAt?: Date | null;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const DraftSchema = SchemaFactory.createForClass(Draft);
