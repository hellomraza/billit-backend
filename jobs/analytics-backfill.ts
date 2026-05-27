import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AnalyticsComputeService } from '../src/modules/analytics/analytics-compute.service';

async function bootstrap() {
  console.log('[Backfill Script] Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const computeService = app.get(AnalyticsComputeService);

  console.log('[Backfill Script] Starting historical analytics backfill...');
  try {
    await computeService.runBackfill();
    console.log('[Backfill Script] Historical analytics backfill completed successfully.');
  } catch (error) {
    console.error('[Backfill Script] Historical analytics backfill failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
