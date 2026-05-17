import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StockAuditModule } from '../stock-audit/stock-audit.module';
import { DeficitController } from './deficit.controller';
import { DeficitRecord, DeficitRecordSchema } from './deficit.schema';
import { DeficitService } from './deficit.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeficitRecord.name, schema: DeficitRecordSchema },
    ]),
    StockAuditModule,
  ],
  providers: [DeficitService],
  controllers: [DeficitController],
  exports: [DeficitService],
})
export class DeficitModule {}
