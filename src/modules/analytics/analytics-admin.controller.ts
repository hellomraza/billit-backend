import {
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Headers,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AnalyticsComputeService } from './analytics-compute.service';

/**
 * ST-01.4.2 — Admin endpoint to trigger the historical backfill.
 *
 * Protected by a shared secret header: X-Admin-Secret.
 * The backfill runs asynchronously — the endpoint returns 202 immediately.
 * Running the backfill multiple times is safe (upsert behaviour).
 */
@ApiTags('Admin')
@Controller('admin/analytics')
export class AnalyticsAdminController {
  private readonly logger = new Logger(AnalyticsAdminController.name);

  constructor(
    private readonly analyticsComputeService: AnalyticsComputeService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({
    summary: 'Trigger historical analytics backfill (admin only)',
    description:
      'One-time job that computes DailyProductSales and DailyRevenueSummary for all historical dates. ' +
      'Protected by X-Admin-Secret header. Runs asynchronously — returns 202 immediately.',
  })
  @ApiHeader({
    name: 'X-Admin-Secret',
    description: 'Admin secret key from ADMIN_SECRET env variable',
    required: true,
  })
  @ApiResponse({ status: 202, description: 'Backfill started' })
  @ApiResponse({ status: 403, description: 'Forbidden — invalid secret' })
  @Post('backfill')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerBackfill(
    @Headers('x-admin-secret') secret: string,
  ): Promise<{ message: string }> {
    const expectedSecret = this.configService.get<string>('ADMIN_SECRET');

    if (!expectedSecret || secret !== expectedSecret) {
      throw new ForbiddenException('Invalid or missing admin secret');
    }

    // Fire and forget — run in background
    this.analyticsComputeService
      .runBackfill()
      .catch((err) =>
        this.logger.error(
          `[Backfill] Unhandled error: ${err?.message}`,
          err?.stack,
        ),
      );

    return { message: 'Backfill started' };
  }
}
