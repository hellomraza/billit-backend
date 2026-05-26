import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import {
  DailyProductSales,
  DailyProductSalesSchema,
} from './schemas/daily-product-sales.schema';
import {
  DailyRevenueSummary,
  DailyRevenueSummarySchema,
} from './schemas/daily-revenue-summary.schema';
import { Invoice, InvoiceSchema } from '../invoice/invoice.schema';
import { AnalyticsComputeService } from './analytics-compute.service';
import { AnalyticsSchedulerService } from './analytics-scheduler.service';
import { AnalyticsAdminController } from './analytics-admin.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: DailyProductSales.name, schema: DailyProductSalesSchema },
      { name: DailyRevenueSummary.name, schema: DailyRevenueSummarySchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
  ],
  providers: [AnalyticsComputeService, AnalyticsSchedulerService],
  controllers: [AnalyticsAdminController],
  exports: [AnalyticsComputeService],
})
export class AnalyticsModule {}
