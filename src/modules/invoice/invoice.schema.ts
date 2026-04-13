import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
}

export interface InvoiceItem {
  productId: Types.ObjectId;
  productName: string;
  quantity: number;
  unitPrice: any;
  gstRate: number;
  gstAmount: any;
  lineTotal: any;
}

export type InvoiceDocument = Invoice & Document;

@Schema({ timestamps: true })
export class Invoice {
  _id?: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  tenantId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  outletId: Types.ObjectId;

  @Prop({ required: true })
  invoiceNumber: string;

  @Prop({ required: true })
  clientGeneratedId: string;

  @Prop({ required: true, type: [Object] })
  items: InvoiceItem[];

  @Prop({ required: true, type: 'Decimal128' })
  subtotal: any;

  @Prop({ required: true, type: 'Decimal128' })
  totalGstAmount: any;

  @Prop({ required: true, type: 'Decimal128' })
  grandTotal: any;

  @Prop({ required: true, enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Prop()
  customerName: string;

  @Prop()
  customerPhone: string;

  @Prop({ default: false })
  isGstInvoice: boolean;

  @Prop()
  tenantGstNumber: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

// Indexes
InvoiceSchema.index({ tenantId: 1, createdAt: -1 });
InvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ tenantId: 1, clientGeneratedId: 1 }, { unique: true });
InvoiceSchema.index({ tenantId: 1, paymentMethod: 1 });
InvoiceSchema.index({ tenantId: 1, isGstInvoice: 1 });
