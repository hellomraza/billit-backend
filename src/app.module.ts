import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { RequestTimingMiddleware } from './common/middleware/request-timing.middleware';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { DailyCounterModule } from './modules/daily-counter/daily-counter.module';
import { DeficitModule } from './modules/deficit/deficit.module';
import { DraftModule } from './modules/draft/draft.module';
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
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Global rate limiting — cron endpoints add stricter per-route @Throttle overrides
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    DatabaseModule,
    AuthModule,
    DraftModule,
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
    AnalyticsModule,
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

    // Apply request timing middleware to all routes
    consumer.apply(RequestTimingMiddleware).forRoutes('*');
  }
}
