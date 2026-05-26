import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
import { AnalyticsCronController } from './analytics-cron.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DailyProductSales.name, schema: DailyProductSalesSchema },
      { name: DailyRevenueSummary.name, schema: DailyRevenueSummarySchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
  ],
  providers: [AnalyticsComputeService],
  controllers: [AnalyticsCronController],
  exports: [AnalyticsComputeService],
})
export class AnalyticsModule {}
