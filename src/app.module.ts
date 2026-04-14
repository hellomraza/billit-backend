import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { DailyCounterModule } from './modules/daily-counter/daily-counter.module';
import { DeficitModule } from './modules/deficit/deficit.module';
import { HealthModule } from './modules/health/health.module';
import { ImportModule } from './modules/import/import.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { OutletModule } from './modules/outlet/outlet.module';
import { PasswordResetModule } from './modules/password-reset/password-reset.module';
import { ProductModule } from './modules/product/product.module';
import { SettingsModule } from './modules/settings/settings.module';
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
    AuthModule,
    OnboardingModule,
    SettingsModule,
    ImportModule,
    TenantModule,
    OutletModule,
    ProductModule,
    StockModule,
    InvoiceModule,
    DeficitModule,
    StockAuditModule,
    DailyCounterModule,
    PasswordResetModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply request logging middleware first (for all requests)
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');

    // Apply rate limiting middleware to all routes
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}
