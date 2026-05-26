import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DailyRevenueSummaryDocument = DailyRevenueSummary & Document;

@Schema({ timestamps: false })
export class DailyRevenueSummary {
  @Prop({ required: true, type: Types.ObjectId })
  tenantId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  outletId: Types.ObjectId;

  /**
   * Date in YYYY-MM-DD format (IST calendar day). Stored as a plain string
   * so that the date portion is never affected by timezone conversions.
   */
  @Prop({ required: true })
  date: string;

  /** Count of SALE invoices (not REFUND) on this date */
  @Prop({ required: true, min: 0, default: 0 })
  totalInvoices: number;

  /** Count of REFUND invoices on this date */
  @Prop({ required: true, min: 0, default: 0 })
  totalRefunds: number;

  /** SUM of subtotals before discounts across all SALE invoices */
  @Prop({ required: true, type: 'Decimal128', default: 0 })
  grossRevenue: any;

  /** SUM of all discount amounts (item + bill) across all SALE invoices */
  @Prop({ required: true, type: 'Decimal128', default: 0 })
  totalDiscounts: any;

  /** grossRevenue - totalDiscounts */
  @Prop({ required: true, type: 'Decimal128', default: 0 })
  netRevenue: any;

  /** SUM of totalGstAmount across all SALE invoices */
  @Prop({ required: true, type: 'Decimal128', default: 0 })
  totalGstAmount: any;

  /** netRevenue + totalGstAmount */
  @Prop({ required: true, type: 'Decimal128', default: 0 })
  grandTotal: any;
}

export const DailyRevenueSummarySchema =
  SchemaFactory.createForClass(DailyRevenueSummary);

// --- ST-01.2.1: Unique constraint on (outletId, date) ---
// One row per outlet per day.
DailyRevenueSummarySchema.index(
  { outletId: 1, date: 1 },
  { unique: true },
);

// --- ST-01.2.1: Composite index for date-range queries ---
DailyRevenueSummarySchema.index({ tenantId: 1, outletId: 1, date: 1 });
