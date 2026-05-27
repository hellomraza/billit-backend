import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { AnalyticsComputeService } from './analytics-compute.service';

@ApiTags('Admin Analytics')
@ApiHeader({
  name: 'X-Admin-Secret',
  description: 'Secret admin key',
  required: true,
})
@UseGuards(AdminAuthGuard)
@Controller('admin/analytics')
export class AnalyticsAdminController {
  private readonly logger = new Logger(AnalyticsAdminController.name);

  constructor(
    private readonly analyticsComputeService: AnalyticsComputeService,
  ) {}

  @ApiOperation({
    summary: 'Trigger historical analytics backfill',
    description:
      'Backfills DailyProductSales and DailyRevenueSummary for all dates since MVP 1 launch. ' +
      'Runs asynchronously — returns 202 immediately. Idempotent (upsert). ' +
      'Protected by X-Admin-Secret header.',
  })
  @ApiResponse({ status: 202, description: 'Backfill started' })
  @ApiResponse({ status: 403, description: 'Forbidden — bad or missing secret header' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Post('backfill')
  @HttpCode(HttpStatus.ACCEPTED)
  async runBackfill(@Req() req: Request): Promise<{
    message: string;
  }> {
    const startedAt = new Date().toISOString();
    this.logger.log(`[AdminBackfill] Received backfill trigger`);

    // Asynchronous trigger (fire and forget)
    this.analyticsComputeService
      .runBackfill()
      .then(() => {
        this.logger.log(`[AdminBackfill] Completed historical backfill successfully.`);
      })
      .catch((err) => {
        this.logger.error(
          `[AdminBackfill] Historical backfill failed: ${err?.message}`,
          err?.stack,
        );
      });

    return {
      message: 'Backfill started',
    };
  }
}
