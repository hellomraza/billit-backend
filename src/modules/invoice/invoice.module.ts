import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyCounterModule } from '../daily-counter/daily-counter.module';
import { DeficitModule } from '../deficit/deficit.module';
import { DeficitRecord, DeficitRecordSchema } from '../deficit/deficit.schema';
import { DraftModule } from '../draft/draft.module';
import { OutletModule } from '../outlet/outlet.module';
import { ProductModule } from '../product/product.module';
import { StockAuditModule } from '../stock-audit/stock-audit.module';
import { StockModule } from '../stock/stock.module';
import { TenantModule } from '../tenant/tenant.module';
import { InvoiceController } from './invoice.controller';
import { Invoice, InvoiceSchema } from './invoice.schema';
import { InvoiceService } from './invoice.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: DeficitRecord.name, schema: DeficitRecordSchema },
    ]),
    forwardRef(() => StockModule),
    forwardRef(() => DeficitModule),
    forwardRef(() => StockAuditModule),
    forwardRef(() => DailyCounterModule),
    forwardRef(() => TenantModule),
    forwardRef(() => OutletModule),
    forwardRef(() => ProductModule),
    DraftModule,
  ],
  providers: [InvoiceService],
  controllers: [InvoiceController],
  exports: [InvoiceService],
})
export class InvoiceModule {}
