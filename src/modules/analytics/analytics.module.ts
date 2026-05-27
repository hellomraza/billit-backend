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
import { Stock, StockSchema } from '../stock/stock.schema';
import { Product, ProductSchema } from '../product/product.schema';
import { DeficitRecord, DeficitRecordSchema } from '../deficit/deficit.schema';
import { OutletModule } from '../outlet/outlet.module';
import { AnalyticsComputeService } from './analytics-compute.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsCronController } from './analytics-cron.controller';
import { AnalyticsAdminController } from './analytics-admin.controller';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DailyProductSales.name, schema: DailyProductSalesSchema },
      { name: DailyRevenueSummary.name, schema: DailyRevenueSummarySchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Stock.name, schema: StockSchema },
      { name: Product.name, schema: ProductSchema },
      { name: DeficitRecord.name, schema: DeficitRecordSchema },
    ]),
    OutletModule,
  ],
  providers: [AnalyticsComputeService, AnalyticsService],
  controllers: [
    AnalyticsCronController,
    AnalyticsAdminController,
    AnalyticsController,
  ],
  exports: [AnalyticsComputeService, AnalyticsService],
})
export class AnalyticsModule {}
