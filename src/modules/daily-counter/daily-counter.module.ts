import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DailyInvoiceCounter,
  DailyInvoiceCounterSchema,
} from './daily-counter.schema';
import { DailyCounterService } from './daily-counter.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DailyInvoiceCounter.name, schema: DailyInvoiceCounterSchema },
    ]),
  ],
  providers: [DailyCounterService],
  exports: [DailyCounterService],
})
export class DailyCounterModule {}
