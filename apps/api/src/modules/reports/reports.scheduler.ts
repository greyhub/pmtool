import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { vnHour } from '../telegram/daily-digest.util';
import { SprintsService } from '../sprints/sprints.service';
import { ReportsService } from './reports.service';

/** All times are Asia/Ho_Chi_Minh, the same fixed assumption the daily digest and streaks use. */
@Injectable()
export class ReportsScheduler {
  private readonly logger = new Logger(ReportsScheduler.name);

  constructor(
    private readonly reports: ReportsService,
    private readonly sprints: SprintsService,
  ) {}

  /** Close the day: fix every project's snapshot just before midnight. */
  @Cron('55 23 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async closeDay(): Promise<void> {
    try {
      await this.reports.snapshotAll();
      await this.sprints.snapshotActive();
    } catch (err) {
      this.logger.error(`Nightly snapshot failed: ${(err as Error).message}`);
    }
  }

  /**
   * Hourly from 08:00: send yesterday's summary once. Hourly rather than a single 08:00 job so a server
   * that was off at 08:00 still delivers when it comes back.
   */
  @Cron('10 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async morningSummary(): Promise<void> {
    if (vnHour() < 8) return;
    try {
      await this.reports.notifyPending();
    } catch (err) {
      this.logger.error(`Morning summary failed: ${(err as Error).message}`);
    }
  }
}
