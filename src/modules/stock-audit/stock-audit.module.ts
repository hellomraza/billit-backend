import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StockAuditController } from './stock-audit.controller';
import { StockAuditLog, StockAuditLogSchema } from './stock-audit.schema';
import { StockAuditLogService } from './stock-audit.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StockAuditLog.name, schema: StockAuditLogSchema },
    ]),
  ],
  providers: [StockAuditLogService],
  controllers: [StockAuditController],
  exports: [StockAuditLogService],
})
export class StockAuditModule {}
