import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from '../../database/database.module';
import { StockAuditModule } from '../stock-audit/stock-audit.module';
import { DeficitController } from './deficit.controller';
import { DeficitRecord, DeficitRecordSchema } from './deficit.schema';
import { DeficitService } from './deficit.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeficitRecord.name, schema: DeficitRecordSchema },
    ]),
    DatabaseModule,
    StockAuditModule,
  ],
  providers: [DeficitService],
  controllers: [DeficitController],
  exports: [DeficitService],
})
export class DeficitModule {}
