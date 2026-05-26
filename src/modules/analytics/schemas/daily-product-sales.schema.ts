import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DailyProductSalesDocument = DailyProductSales & Document;

@Schema({ timestamps: false })
export class DailyProductSales {
  @Prop({ required: true, type: Types.ObjectId })
  tenantId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  outletId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  productId: Types.ObjectId;

  /**
   * Date in YYYY-MM-DD format (IST calendar day). Stored as a plain string
   * so that the date portion is never affected by timezone conversions.
   */
  @Prop({ required: true })
  date: string;

  /** Total units sold across all SALE invoices on this date for this product */
  @Prop({ required: true, min: 0, default: 0 })
  unitsSold: number;

  /** Total units returned via REFUND invoices on this date for this product */
  @Prop({ required: true, min: 0, default: 0 })
  refundedUnits: number;

  /** MAX(0, unitsSold - refundedUnits) — never negative */
  @Prop({ required: true, min: 0, default: 0 })
  netUnitsSold: number;

  /** SUM of (unitPrice × quantity) before any discounts — SALE invoices only */
  @Prop({ required: true, type: 'Decimal128', default: 0 })
  grossRevenue: any;

  /**
   * SUM of itemDiscountAmount for this product + proportional share of
   * billDiscountAmount across all SALE invoices on this date.
   */
  @Prop({ required: true, type: 'Decimal128', default: 0 })
  discountAmount: any;

  /** grossRevenue - discountAmount */
  @Prop({ required: true, type: 'Decimal128', default: 0 })
  netRevenue: any;

  /** SUM of gstAmount for this product across all SALE invoices that day */
  @Prop({ required: true, type: 'Decimal128', default: 0 })
  gstAmount: any;
}

export const DailyProductSalesSchema =
  SchemaFactory.createForClass(DailyProductSales);

// --- ST-01.1.2: Unique constraint on (outletId, productId, date) ---
// One row per product per outlet per day.
DailyProductSalesSchema.index(
  { outletId: 1, productId: 1, date: 1 },
  { unique: true },
);

// --- ST-01.1.3: Composite indexes for efficient querying ---
// For date-range queries scoped to a tenant + outlet
DailyProductSalesSchema.index({ tenantId: 1, outletId: 1, date: 1 });

// For per-product queries scoped to a tenant + outlet
DailyProductSalesSchema.index({ tenantId: 1, outletId: 1, productId: 1 });
