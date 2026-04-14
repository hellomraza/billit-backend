import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
  CHEQUE = 'CHEQUE',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export interface InvoiceItem {
  productId: Types.ObjectId;
  productName: string;
  quantity: number;
  unitPrice: any;
  gstRate: number;
  gstAmount: any;
  lineTotal: any;
  overridden?: boolean; // Whether this item was overridden due to insufficient stock
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

  @Prop({ required: true, unique: true })
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
  gstEnabled: boolean;

  @Prop()
  tenantGstNumber: string;

  // Snapshot fields for backward compatibility and audit trail
  @Prop()
  businessName: string;

  @Prop()
  businessAbbr: string;

  @Prop()
  outletName: string;

  @Prop()
  outletAbbr: string;

  // Track if abbreviations were locked on this invoice (first invoice)
  @Prop({ default: false })
  abbreviationsLocked: boolean;

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
InvoiceSchema.index({ tenantId: 1, outletId: 1, createdAt: -1 });
InvoiceSchema.index({ tenantId: 1, paymentMethod: 1 });
InvoiceSchema.index({ tenantId: 1, gstEnabled: 1 });
InvoiceSchema.index({ tenantId: 1, 'items.productId': 1 });
