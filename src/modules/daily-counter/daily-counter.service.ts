import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { DatabaseService } from '../../database/database.service';
import { DailyInvoiceCounter } from './daily-counter.schema';

@Injectable()
export class DailyCounterService {
  constructor(
    @InjectModel(DailyInvoiceCounter.name)
    private counterModel: Model<DailyInvoiceCounter>,
    private databaseService: DatabaseService,
  ) {}

  private getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  /**
   * Increment daily counter and return formatted invoice number
   * IMPORTANT: When called within a transaction, must pass session to ensure atomicity
   *
   * @param outletId - The outlet ID
   * @param tenantId - The tenant ID (for reference, not used in formatting)
   * @param outletAbbr - The outlet abbreviation for invoice number formatting
   * @param session - Optional MongoDB session for transaction support
   * @returns Formatted invoice number: {OUTLETABBR}-{DDMMYYYY}-{NNNNN}
   *
   * Transaction Safety:
   * - If session provided, all database operations use the session (atomic within transaction)
   * - If no session, operation is atomic at document level but outside transaction
   * - Counter uses findOneAndUpdate with $inc (atomic increment)
   * - Unique index on (outletId, date) prevents duplicate counters
   */
  async incrementAndGet(
    outletId: Types.ObjectId,
    tenantId: Types.ObjectId,
    outletAbbr: string,
    session?: ClientSession,
  ): Promise<string> {
    const today = this.getTodayDate();

    const counter = await this.counterModel.findOneAndUpdate(
      { outletId, date: today },
      { $inc: { lastCounter: 1 } },
      { new: true, upsert: true, session },
    );

    // Format: OUTLETABBR-DDMMYYYY-COUNTER (zero-padded to 5 digits)
    const day = today.split('-')[2];
    const month = today.split('-')[1];
    const year = today.split('-')[0];
    const invoiceNumber = `${outletAbbr}-${day}${month}${year}-${counter.lastCounter.toString().padStart(5, '0')}`;

    return invoiceNumber;
  }

  async getCounterByDate(
    outletId: string,
    date: string,
  ): Promise<DailyInvoiceCounter> {
    const counter = await this.counterModel.findOne({
      outletId: new Types.ObjectId(outletId),
      date,
    });

    if (!counter) {
      throw new NotFoundException('Counter not found for this date');
    }

    return counter;
  }

  async getCurrentCounter(outletId: string): Promise<DailyInvoiceCounter> {
    const today = this.getTodayDate();
    return this.getCounterByDate(outletId, today);
  }

  async resetCounter(
    outletId: string,
    date: string,
  ): Promise<DailyInvoiceCounter> {
    const counter = await this.counterModel.findOneAndUpdate(
      { outletId: new Types.ObjectId(outletId), date },
      { lastCounter: 0 },
      { new: true },
    );

    if (!counter) {
      throw new NotFoundException('Counter not found');
    }

    return counter;
  }
}
