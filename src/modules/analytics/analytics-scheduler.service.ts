import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as cron from 'node-cron';
import { AnalyticsComputeService, yesterdayIST } from './analytics-compute.service';

/**
 * ST-01.3.6 — Nightly analytics job scheduler.
 *
 * Runs every day at 00:01 IST = 18:31 UTC (cron: "31 18 * * *").
 *
 * Also registers an hourly retry job that re-runs for dates that the nightly
 * job may have missed (failure handling per ST-01.3.5).
 */
@Injectable()
export class AnalyticsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsSchedulerService.name);

  /** Track the last date the nightly job successfully completed */
  private lastSuccessfulDate: string | null = null;

  constructor(
    private readonly analyticsComputeService: AnalyticsComputeService,
  ) {}

  onModuleInit() {
    this.registerNightlyJob();
    this.registerHourlyRetryJob();
    this.logger.log(
      '[Scheduler] Analytics jobs registered. Nightly: 18:31 UTC (00:01 IST). Retry: every hour.',
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ST-01.3.6 — Primary nightly cron: 31 18 * * * (00:01 IST)
  // ─────────────────────────────────────────────────────────────────────────────
  private registerNightlyJob() {
    cron.schedule('31 18 * * *', async () => {
      const targetDate = yesterdayIST();
      this.logger.log(
        `[Scheduler] Nightly job triggered for date: ${targetDate}`,
      );

      try {
        await this.analyticsComputeService.runNightlyJob(targetDate);
        this.lastSuccessfulDate = targetDate;
        this.logger.log(
          `[Scheduler] Nightly job succeeded for date: ${targetDate}`,
        );
      } catch (err) {
        this.logger.error(
          `[Scheduler] Nightly job FAILED for date: ${targetDate} — ${err?.message}`,
          err?.stack,
        );
        // Retry will pick this up in the hourly job below
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ST-01.3.5 — Hourly retry: runs if the nightly job missed yesterday
  // ─────────────────────────────────────────────────────────────────────────────
  private registerHourlyRetryJob() {
    cron.schedule('0 * * * *', async () => {
      const targetDate = yesterdayIST();

      // Skip if the nightly job already succeeded for this date
      if (this.lastSuccessfulDate === targetDate) {
        return;
      }

      this.logger.warn(
        `[Scheduler] Retry job: nightly job had not succeeded for ${targetDate}. Retrying...`,
      );

      try {
        await this.analyticsComputeService.runNightlyJob(targetDate);
        this.lastSuccessfulDate = targetDate;
        this.logger.log(
          `[Scheduler] Retry job succeeded for date: ${targetDate}`,
        );
      } catch (err) {
        this.logger.error(
          `[Scheduler] Retry job also FAILED for date: ${targetDate} — ${err?.message}`,
          err?.stack,
        );
      }
    });
  }

  /**
   * Manual trigger for testing purposes.
   * Can be called from the admin controller.
   */
  async triggerManually(targetDate?: string): Promise<void> {
    const date = targetDate ?? yesterdayIST();
    this.logger.log(`[Scheduler] Manual trigger for date: ${date}`);
    await this.analyticsComputeService.runNightlyJob(date);
    this.lastSuccessfulDate = date;
  }
}
