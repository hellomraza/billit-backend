import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from '../../database/database.module';
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
    DatabaseModule,
  ],
  providers: [DailyCounterService],
  exports: [DailyCounterService],
})
export class DailyCounterModule {}
