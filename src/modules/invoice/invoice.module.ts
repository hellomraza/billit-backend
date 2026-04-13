import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from '../../database/database.module';
import { DailyCounterModule } from '../daily-counter/daily-counter.module';
import { DeficitModule } from '../deficit/deficit.module';
import { StockAuditModule } from '../stock-audit/stock-audit.module';
import { StockModule } from '../stock/stock.module';
import { InvoiceController } from './invoice.controller';
import { Invoice, InvoiceSchema } from './invoice.schema';
import { InvoiceService } from './invoice.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Invoice.name, schema: InvoiceSchema }]),
    DatabaseModule,
    forwardRef(() => StockModule),
    forwardRef(() => DeficitModule),
    forwardRef(() => StockAuditModule),
    forwardRef(() => DailyCounterModule),
  ],
  providers: [InvoiceService],
  controllers: [InvoiceController],
  exports: [InvoiceService],
})
export class InvoiceModule {}
