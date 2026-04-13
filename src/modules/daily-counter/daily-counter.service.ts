import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

  async incrementAndGet(
    outletId: Types.ObjectId,
    tenantId: Types.ObjectId,
  ): Promise<string> {
    const today = this.getTodayDate();
    const outletAbbr = await this.getOutletAbbr(outletId);

    const counter = await this.counterModel.findOneAndUpdate(
      { outletId, date: today },
      { $inc: { lastCounter: 1 } },
      { new: true, upsert: true },
    );

    // Format: OUTLETABBR-DDMMYYYY-COUNTER
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

  private async getOutletAbbr(outletId: Types.ObjectId): Promise<string> {
    // This will be injected from OutletService later
    // For now, return a placeholder
    return 'OUT';
  }
}
