import {
  Body,
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
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CronAuthGuard } from '../../common/guards/cron-auth.guard';
import {
  AnalyticsComputeService,
  yesterdayIST,
} from './analytics-compute.service';
import { IsDateString, IsOptional } from 'class-validator';

export class NightlyJobBodyDto {
  @ApiProperty({
    description:
      'Target date in YYYY-MM-DD (IST). Defaults to yesterday IST if omitted. ' +
      'Use for testing or retrying a specific date.',
    example: '2026-05-24',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  targetDate?: string;
}

/**
 * HTTP endpoints called by cron-job.org on a schedule.
 *
 * Security:
 *   - CronAuthGuard: IP allowlist + Authorization: Bearer <CRON_SECRET>
 *   - Throttler: strict per-endpoint limits
 *   - POST only — no accidental GET triggers by browsers/crawlers
 *   - Secrets NEVER in URL query params
 *
 * Idempotency:
 *   - All computation uses upsert — safe to call multiple times for same date.
 *
 * Logging:
 *   - Every execution logs: timestamp, IP, success/failure, duration (ms).
 */
@ApiTags('Cron Jobs')
@ApiBearerAuth('CRON_SECRET')
@ApiHeader({
  name: 'Authorization',
  description: 'Bearer <CRON_SECRET>',
  required: true,
})
@UseGuards(CronAuthGuard)
@Controller('cron/analytics')
export class AnalyticsCronController {
  private readonly logger = new Logger(AnalyticsCronController.name);

  constructor(
    private readonly analyticsComputeService: AnalyticsComputeService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /cron/analytics/nightly
  // Called by cron-job.org at 00:01 IST (18:31 UTC) every day.
  // Optionally accepts { targetDate } body for retry/testing scenarios.
  // ─────────────────────────────────────────────────────────────────────────────
  @ApiOperation({
    summary: 'Nightly analytics computation (cron-job.org trigger)',
    description:
      'Computes DailyProductSales and DailyRevenueSummary for yesterday IST. ' +
      'Pass optional { targetDate: "YYYY-MM-DD" } to reprocess a specific date. ' +
      'Idempotent — safe to call multiple times. Protected by IP allowlist + Bearer token.',
  })
  @ApiBody({ type: NightlyJobBodyDto, required: false })
  @ApiResponse({
    status: 200,
    description: 'Job completed successfully',
    schema: {
      example: {
        success: true,
        targetDate: '2026-05-24',
        durationMs: 32,
        message: 'Nightly job completed for 2026-05-24',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — bad/missing token' })
  @ApiResponse({ status: 403, description: 'Forbidden — IP not in allowlist' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('nightly')
  @HttpCode(HttpStatus.OK)
  async runNightlyJob(
    @Req() req: Request,
    @Body() body: NightlyJobBodyDto = {},
  ): Promise<{
    success: boolean;
    targetDate: string;
    durationMs: number;
    message: string;
  }> {
    const ip = this.extractIp(req);
    const targetDate = body?.targetDate ?? yesterdayIST();
    const startedAt = Date.now();

    this.logger.log(
      `[Nightly] START | ip=${ip} | targetDate=${targetDate} | timestamp=${new Date().toISOString()}`,
    );

    try {
      await this.analyticsComputeService.runNightlyJob(targetDate);

      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `[Nightly] SUCCESS | ip=${ip} | targetDate=${targetDate} | durationMs=${durationMs}`,
      );

      return {
        success: true,
        targetDate,
        durationMs,
        message: `Nightly job completed for ${targetDate}`,
      };
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      this.logger.error(
        `[Nightly] FAILURE | ip=${ip} | targetDate=${targetDate} | durationMs=${durationMs} | error=${err?.message}`,
        err?.stack,
      );
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /cron/analytics/backfill
  // One-time backfill — async fire-and-forget, returns 202 immediately.
  // ─────────────────────────────────────────────────────────────────────────────
  @ApiOperation({
    summary: 'Trigger historical analytics backfill (admin / one-time)',
    description:
      'Backfills DailyProductSales and DailyRevenueSummary for all dates since MVP 1 launch. ' +
      'Runs asynchronously — returns 202 immediately. Idempotent (upsert). ' +
      'Protected by IP allowlist + Bearer token.',
  })
  @ApiResponse({ status: 202, description: 'Backfill started in background' })
  @ApiResponse({ status: 401, description: 'Unauthorized — bad/missing token' })
  @ApiResponse({ status: 403, description: 'Forbidden — IP not in allowlist' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Post('backfill')
  @HttpCode(HttpStatus.ACCEPTED)
  async runBackfill(@Req() req: Request): Promise<{
    success: boolean;
    message: string;
    startedAt: string;
  }> {
    const ip = this.extractIp(req);
    const startedAt = new Date().toISOString();

    this.logger.log(
      `[Backfill] START (async) | ip=${ip} | timestamp=${startedAt}`,
    );

    this.analyticsComputeService
      .runBackfill()
      .then(() => {
        this.logger.log(
          `[Backfill] COMPLETED | ip=${ip} | startedAt=${startedAt}`,
        );
      })
      .catch((err) => {
        this.logger.error(
          `[Backfill] FAILURE | ip=${ip} | startedAt=${startedAt} | error=${err?.message}`,
          err?.stack,
        );
      });

    return {
      success: true,
      message: 'Backfill started in background',
      startedAt,
    };
  }

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return first.split(',')[0].trim();
    }
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }
}
