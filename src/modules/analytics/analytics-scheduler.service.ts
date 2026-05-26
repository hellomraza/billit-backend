import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AnalyticsComputeService,
  yesterdayIST,
} from './analytics-compute.service';

/**
 * ST-01.3.6 — Nightly analytics job scheduler.
 *
 * Uses @nestjs/schedule (@Cron decorator) instead of a manual cron setup.
 *
 * Primary job  : runs at 00:01 IST = 18:31 UTC  →  cron "31 18 * * *"
 * Hourly retry : runs every hour to re-process yesterday if the nightly
 *                job had failed (ST-01.3.5 failure handling).
 */
@Injectable()
export class AnalyticsSchedulerService {
  private readonly logger = new Logger(AnalyticsSchedulerService.name);

  /** Track the last date the nightly job successfully completed */
  private lastSuccessfulDate: string | null = null;

  constructor(
    private readonly analyticsComputeService: AnalyticsComputeService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST — Heartbeat cron: runs every minute to confirm scheduler is alive
  // Remove this in production once crons are verified.
  // ─────────────────────────────────────────────────────────────────────────────
  @Cron('* * * * *', { name: 'analytics-heartbeat' })
  handleHeartbeat(): void {
    this.logger.log('[Heartbeat] ✅ Cron scheduler is alive — ' + new Date().toISOString());
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ST-01.3.6 — Primary nightly cron: 31 18 * * * (00:01 IST)
  // ─────────────────────────────────────────────────────────────────────────────
  @Cron('31 18 * * *', { name: 'analytics-nightly', timeZone: 'UTC' })
  async handleNightlyJob(): Promise<void> {
    const targetDate = yesterdayIST();
    this.logger.log(`[NightlyJob] Triggered for date: ${targetDate}`);

    try {
      await this.analyticsComputeService.runNightlyJob(targetDate);
      this.lastSuccessfulDate = targetDate;
      this.logger.log(`[NightlyJob] Succeeded for date: ${targetDate}`);
    } catch (err) {
      this.logger.error(
        `[NightlyJob] FAILED for date: ${targetDate} — ${err?.message}`,
        err?.stack,
      );
      // Hourly retry job below will pick this up
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ST-01.3.5 — Hourly retry: re-runs if the nightly job missed yesterday
  // ─────────────────────────────────────────────────────────────────────────────
  @Cron('0 * * * *', { name: 'analytics-hourly-retry', timeZone: 'UTC' })
  async handleHourlyRetry(): Promise<void> {
    const targetDate = yesterdayIST();

    // Skip if the nightly job already succeeded for this date
    if (this.lastSuccessfulDate === targetDate) {
      return;
    }

    this.logger.warn(
      `[HourlyRetry] Nightly job had not succeeded for ${targetDate}. Retrying...`,
    );

    try {
      await this.analyticsComputeService.runNightlyJob(targetDate);
      this.lastSuccessfulDate = targetDate;
      this.logger.log(`[HourlyRetry] Succeeded for date: ${targetDate}`);
    } catch (err) {
      this.logger.error(
        `[HourlyRetry] Also FAILED for date: ${targetDate} — ${err?.message}`,
        err?.stack,
      );
    }
  }

  /**
   * Manual trigger — exposed via the admin controller for testing.
   */
  async triggerManually(targetDate?: string): Promise<void> {
    const date = targetDate ?? yesterdayIST();
    this.logger.log(`[ManualTrigger] Running nightly job for date: ${date}`);
    await this.analyticsComputeService.runNightlyJob(date);
    this.lastSuccessfulDate = date;
  }
}
