import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { DailyCounterModule } from './modules/daily-counter/daily-counter.module';
import { DeficitModule } from './modules/deficit/deficit.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { OutletModule } from './modules/outlet/outlet.module';
import { PasswordResetModule } from './modules/password-reset/password-reset.module';
import { ProductModule } from './modules/product/product.module';
import { StockAuditModule } from './modules/stock-audit/stock-audit.module';
import { StockModule } from './modules/stock/stock.module';
import { TenantModule } from './modules/tenant/tenant.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/billit',
      {
        serverSelectionTimeoutMS: 5000,
      },
    ),
    DatabaseModule,
    TenantModule,
    OutletModule,
    ProductModule,
    StockModule,
    InvoiceModule,
    DeficitModule,
    StockAuditModule,
    DailyCounterModule,
    PasswordResetModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
