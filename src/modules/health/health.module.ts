import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Health Module
 * Provides health check endpoints for monitoring and orchestration
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
