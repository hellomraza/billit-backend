import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DailyProductSales,
  DailyProductSalesDocument,
} from './schemas/daily-product-sales.schema';
import {
  DailyRevenueSummary,
  DailyRevenueSummaryDocument,
} from './schemas/daily-revenue-summary.schema';
import { Invoice, InvoiceDocument } from '../invoice/invoice.schema';
import { InvoiceType } from '../invoice/invoice.schema';

/** Helpers for IST date arithmetic */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Returns the current date string "YYYY-MM-DD" in IST */
export function todayIST(): string {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  return `${istNow.getUTCFullYear()}-${pad(istNow.getUTCMonth() + 1)}-${pad(istNow.getUTCDate())}`;
}

/** Returns yesterday's date string "YYYY-MM-DD" in IST */
export function yesterdayIST(): string {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const yesterday = new Date(istNow);
  yesterday.setUTCDate(istNow.getUTCDate() - 1);
  return `${yesterday.getUTCFullYear()}-${pad(yesterday.getUTCMonth() + 1)}-${pad(yesterday.getUTCDate())}`;
}

/** Returns start-of-day UTC Date for a given YYYY-MM-DD IST date string */
function istDateToUtcStart(dateStr: string): Date {
  // YYYY-MM-DD 00:00:00 IST = YYYY-MM-DD 00:00:00 - 05:30 UTC
  return new Date(`${dateStr}T00:00:00+05:30`);
}

/** Returns end-of-day UTC Date for a given YYYY-MM-DD IST date string */
function istDateToUtcEnd(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999+05:30`);
}

function parseDecimal(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return parseFloat(value.toString?.() || '0');
}

@Injectable()
export class AnalyticsComputeService {
  private readonly logger = new Logger(AnalyticsComputeService.name);

  constructor(
    @InjectModel(DailyProductSales.name)
    private readonly dailyProductSalesModel: Model<DailyProductSalesDocument>,
    @InjectModel(DailyRevenueSummary.name)
    private readonly dailyRevenueSummaryModel: Model<DailyRevenueSummaryDocument>,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // ST-01.3.1 — IST date helpers (above) + job entry point
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Main nightly job entry point.
   * Computes DailyProductSales and DailyRevenueSummary for the given targetDate.
   * Idempotent — running twice for the same date updates (upserts) existing rows.
   */
  async runNightlyJob(targetDate?: string): Promise<void> {
    const date = targetDate ?? yesterdayIST();
    this.logger.log(`[NightlyJob] Starting computation for date: ${date}`);

    // ST-01.3.2 — Find all (tenantId, outletId) pairs with invoice activity
    const pairs = await this.findActivePairs(date);

    if (pairs.length === 0) {
      this.logger.log(
        `[NightlyJob] No invoice activity on ${date}. Job complete.`,
      );
      return;
    }

    this.logger.log(
      `[NightlyJob] Found ${pairs.length} (tenantId, outletId) pair(s) to process.`,
    );

    let processed = 0;
    let errors = 0;

    for (const pair of pairs) {
      try {
        // ST-01.3.3
        await this.computeDailyProductSales(pair.tenantId, pair.outletId, date);
        // ST-01.3.4
        await this.computeDailyRevenueSummary(
          pair.tenantId,
          pair.outletId,
          date,
        );
        processed++;
      } catch (err) {
        // ST-01.3.5 — log per-pair errors but continue processing other pairs
        errors++;
        this.logger.error(
          `[NightlyJob] Error processing tenantId=${pair.tenantId} outletId=${pair.outletId} date=${date}: ${err?.message}`,
          err?.stack,
        );
      }
    }

    this.logger.log(
      `[NightlyJob] Done for ${date}. Processed: ${processed}, Errors: ${errors}.`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ST-01.3.2 — Find distinct (tenantId, outletId) pairs with activity
  // ─────────────────────────────────────────────────────────────────────────────

  async findActivePairs(
    date: string,
  ): Promise<Array<{ tenantId: string; outletId: string }>> {
    const utcStart = istDateToUtcStart(date);
    const utcEnd = istDateToUtcEnd(date);

    const results = await this.invoiceModel.aggregate([
      {
        $match: {
          createdAt: { $gte: utcStart, $lte: utcEnd },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: { tenantId: '$tenantId', outletId: '$outletId' },
        },
      },
      {
        $project: {
          _id: 0,
          tenantId: { $toString: '$_id.tenantId' },
          outletId: { $toString: '$_id.outletId' },
        },
      },
    ]);

    return results as Array<{ tenantId: string; outletId: string }>;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ST-01.3.3 — Compute DailyProductSales for one (tenantId, outletId, date)
  // ─────────────────────────────────────────────────────────────────────────────

  async computeDailyProductSales(
    tenantId: string,
    outletId: string,
    date: string,
  ): Promise<void> {
    const utcStart = istDateToUtcStart(date);
    const utcEnd = istDateToUtcEnd(date);

    const tenantObjId = new Types.ObjectId(tenantId);
    const outletObjId = new Types.ObjectId(outletId);

    // Fetch all non-deleted invoices for this (tenantId, outletId, date)
    const invoices = await this.invoiceModel
      .find({
        tenantId: tenantObjId,
        outletId: outletObjId,
        createdAt: { $gte: utcStart, $lte: utcEnd },
        isDeleted: false,
      })
      .lean();

    // Aggregate per productId
    const productMap = new Map<
      string,
      {
        unitsSold: number;
        refundedUnits: number;
        grossRevenue: number;
        discountAmount: number;
        gstAmount: number;
      }
    >();

    for (const invoice of invoices) {
      const isSale = invoice.invoiceType === InvoiceType.SALE;
      const isRefund = invoice.invoiceType === InvoiceType.REFUND;

      const subtotal = parseDecimal(invoice.subtotal);
      const billDiscountAmount = parseDecimal(invoice.billDiscountAmount);

      for (const item of invoice.items) {
        const productId = item.productId.toString();
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            unitsSold: 0,
            refundedUnits: 0,
            grossRevenue: 0,
            discountAmount: 0,
            gstAmount: 0,
          });
        }

        const entry = productMap.get(productId)!;
        const lineTotal = parseDecimal(item.lineTotal);
        const itemDiscountAmount = parseDecimal(item.itemDiscountAmount);
        const unitPrice = parseDecimal(item.unitPrice);
        const qty = item.quantity;
        const itemGst = parseDecimal(item.gstAmount);

        if (isSale) {
          entry.unitsSold += qty;
          entry.grossRevenue += unitPrice * qty;

          // Proportional share of bill-level discount
          const billDiscountShare =
            subtotal > 0 ? (lineTotal / subtotal) * billDiscountAmount : 0;
          // discountAmount = itemDiscount + proportional billDiscount
          entry.discountAmount += itemDiscountAmount + billDiscountShare;
          entry.gstAmount += itemGst;
        } else if (isRefund) {
          entry.refundedUnits += qty;
        }
      }
    }

    // Upsert one row per productId
    for (const [productId, data] of productMap.entries()) {
      const netUnitsSold = Math.max(0, data.unitsSold - data.refundedUnits);
      const netRevenue = Math.max(0, data.grossRevenue - data.discountAmount);

      await this.dailyProductSalesModel.findOneAndUpdate(
        {
          outletId: outletObjId,
          productId: new Types.ObjectId(productId),
          date,
        },
        {
          $set: {
            tenantId: tenantObjId,
            outletId: outletObjId,
            productId: new Types.ObjectId(productId),
            date,
            unitsSold: data.unitsSold,
            refundedUnits: data.refundedUnits,
            netUnitsSold,
            grossRevenue: data.grossRevenue,
            discountAmount: data.discountAmount,
            netRevenue,
            gstAmount: data.gstAmount,
          },
        },
        { upsert: true, new: true },
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ST-01.3.4 — Compute DailyRevenueSummary for one (tenantId, outletId, date)
  // ─────────────────────────────────────────────────────────────────────────────

  async computeDailyRevenueSummary(
    tenantId: string,
    outletId: string,
    date: string,
  ): Promise<void> {
    const utcStart = istDateToUtcStart(date);
    const utcEnd = istDateToUtcEnd(date);

    const tenantObjId = new Types.ObjectId(tenantId);
    const outletObjId = new Types.ObjectId(outletId);

    const invoices = await this.invoiceModel
      .find({
        tenantId: tenantObjId,
        outletId: outletObjId,
        createdAt: { $gte: utcStart, $lte: utcEnd },
        isDeleted: false,
      })
      .lean();

    let totalInvoices = 0;
    let totalRefunds = 0;
    let grossRevenue = 0;
    let totalDiscounts = 0;
    let totalGstAmount = 0;

    for (const invoice of invoices) {
      if (invoice.invoiceType === InvoiceType.SALE) {
        totalInvoices++;
        grossRevenue += parseDecimal(invoice.subtotal);
        totalGstAmount += parseDecimal(invoice.totalGstAmount);

        // Sum item discounts
        let itemDiscountTotal = 0;
        for (const item of invoice.items) {
          itemDiscountTotal += parseDecimal(item.itemDiscountAmount);
        }
        totalDiscounts +=
          itemDiscountTotal + parseDecimal(invoice.billDiscountAmount);
      } else if (invoice.invoiceType === InvoiceType.REFUND) {
        totalRefunds++;
      }
    }

    const netRevenue = Math.max(0, grossRevenue - totalDiscounts);
    const grandTotal = netRevenue + totalGstAmount;

    await this.dailyRevenueSummaryModel.findOneAndUpdate(
      { outletId: outletObjId, date },
      {
        $set: {
          tenantId: tenantObjId,
          outletId: outletObjId,
          date,
          totalInvoices,
          totalRefunds,
          grossRevenue,
          totalDiscounts,
          netRevenue,
          totalGstAmount,
          grandTotal,
        },
      },
      { upsert: true, new: true },
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ST-01.4.1 — Backfill: find earliest invoice date and process all dates
  // ─────────────────────────────────────────────────────────────────────────────

  async runBackfill(): Promise<void> {
    this.logger.log('[Backfill] Starting historical backfill...');

    // Find the earliest invoice
    const earliest = await this.invoiceModel
      .findOne({ isDeleted: false })
      .sort({ createdAt: 1 })
      .lean();

    if (!earliest) {
      this.logger.log('[Backfill] No invoices found. Nothing to backfill.');
      return;
    }

    // Convert to IST date string
    const startDate = new Date(earliest.createdAt.getTime() + IST_OFFSET_MS);
    const startDateStr = `${startDate.getUTCFullYear()}-${pad(startDate.getUTCMonth() + 1)}-${pad(startDate.getUTCDate())}`;
    const endDateStr = yesterdayIST();

    this.logger.log(
      `[Backfill] Processing dates from ${startDateStr} to ${endDateStr}`,
    );

    // Generate all dates in the range
    const allDates = this.generateDateRange(startDateStr, endDateStr);
    const total = allDates.length;
    this.logger.log(`[Backfill] Total dates to process: ${total}`);

    // Process in batches of 7
    const BATCH_SIZE = 7;
    const BATCH_DELAY_MS = 500;

    for (let i = 0; i < allDates.length; i += BATCH_SIZE) {
      const batch = allDates.slice(i, i + BATCH_SIZE);

      for (const date of batch) {
        try {
          const pairs = await this.findActivePairs(date);
          for (const pair of pairs) {
            try {
              await this.computeDailyProductSales(
                pair.tenantId,
                pair.outletId,
                date,
              );
              await this.computeDailyRevenueSummary(
                pair.tenantId,
                pair.outletId,
                date,
              );
            } catch (err) {
              this.logger.error(
                `[Backfill] Error for tenant=${pair.tenantId} outlet=${pair.outletId} date=${date}: ${err?.message}`,
              );
            }
          }
        } catch (err) {
          this.logger.error(
            `[Backfill] Error finding pairs for date=${date}: ${err?.message}`,
          );
        }
      }

      const processed = Math.min(i + BATCH_SIZE, total);
      this.logger.log(`[Backfill] Processed ${processed} of ${total} days`);

      // Delay between batches to avoid DB saturation
      if (i + BATCH_SIZE < allDates.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    this.logger.log('[Backfill] Historical backfill complete.');
  }

  private generateDateRange(startStr: string, endStr: string): string[] {
    const dates: string[] = [];
    const current = new Date(`${startStr}T00:00:00Z`);
    const end = new Date(`${endStr}T00:00:00Z`);

    while (current <= end) {
      const y = current.getUTCFullYear();
      const m = pad(current.getUTCMonth() + 1);
      const d = pad(current.getUTCDate());
      dates.push(`${y}-${m}-${d}`);
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  }
}
