import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Task } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramProviderService } from './telegram-provider.service';
import { vnStartOfToday, vnStartOfTomorrow } from './due-date-window.util';
import { vnDigestDateKey, vnHour } from './daily-digest.util';

const MAX_DIGEST_TASKS_SHOWN = 15;

type DigestTaskRow = Pick<Task, 'humanKey' | 'title' | 'dueDate'>;

/** Renders the daily-digest body. Exported for standalone unit testing. */
export function buildDigestMessage(tasks: DigestTaskRow[]): string {
  const header = `📝 Bạn còn ${tasks.length} công việc chưa hoàn thành:`;
  const shown = tasks.slice(0, MAX_DIGEST_TASKS_SHOWN);
  const lines = shown.map((t) => {
    // Built from vnDigestDateKey rather than Intl.DateTimeFormat: the
    // locale's day/month separator isn't guaranteed to be "/" (vi-VN
    // renders it as "-"), and this only needs DD/MM, not a full formatter.
    const due = t.dueDate
      ? ` (hạn ${vnDigestDateKey(t.dueDate).slice(8, 10)}/${vnDigestDateKey(t.dueDate).slice(5, 7)})`
      : '';
    return `• ${t.humanKey} — ${t.title}${due}`;
  });
  const tail =
    tasks.length > MAX_DIGEST_TASKS_SHOWN
      ? [`… và ${tasks.length - MAX_DIGEST_TASKS_SHOWN} công việc khác`]
      : [];
  return [header, ...lines, ...tail].join('\n');
}

/**
 * Called explicitly from TasksService at the point of assignment — same
 * shape as GamificationService.awardPoints, and for the same reason: the
 * generic AuditLogInterceptor's action strings are too coarse to express
 * "these specific users were just assigned." Reads Task directly via
 * this.prisma.db (never via TasksService) to avoid a module import cycle
 * back through TasksModule, which already imports this module.
 */
@Injectable()
export class TelegramNotificationsService {
  private readonly logger = new Logger(TelegramNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramProvider: TelegramProviderService,
  ) {}

  async notifyTaskAssigned(
    task: Pick<Task, 'humanKey' | 'title'>,
    newlyAssignedUserIds: string[],
  ): Promise<void> {
    if (
      newlyAssignedUserIds.length === 0 ||
      !this.telegramProvider.isConfigured()
    )
      return;

    const users = await this.prisma.db.user.findMany({
      where: {
        id: { in: newlyAssignedUserIds },
        telegramChatId: { not: null },
      },
      select: { telegramChatId: true },
    });

    await Promise.all(
      users.map((u) =>
        this.telegramProvider.sendMessage(
          u.telegramChatId!,
          `📋 Bạn được giao công việc: ${task.humanKey} — ${task.title}`,
        ),
      ),
    );
  }

  /**
   * Dedup is per-task (Task.telegramReminderSentAt), not per-(task, assignee)
   * — an assignee added after the reminder already fired for that due date
   * won't get one. No distributed lock either — fine for today's
   * single-instance deployment; REDIS_URL is already provisioned and would
   * be the natural tool for a SET-NX-style lock if that ever changes.
   * Both are deliberate v1 simplifications, not oversights.
   */
  @Cron('0 8 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async sendDueDateReminders(): Promise<void> {
    if (!this.telegramProvider.isConfigured()) return;

    const tasks = await this.prisma.db.task.findMany({
      where: {
        dueDate: { gte: vnStartOfToday(), lt: vnStartOfTomorrow() },
        status: { not: 'DONE' },
        telegramReminderSentAt: null,
      },
      include: {
        assignees: { include: { user: { select: { telegramChatId: true } } } },
      },
    });

    for (const task of tasks) {
      // Reminders go to whoever is accountable, not to supporters.
      const recipients = task.assignees.filter(
        (a) => a.role === 'PRIMARY' && a.user.telegramChatId,
      );
      if (recipients.length > 0) {
        await Promise.all(
          recipients.map((a) =>
            this.telegramProvider.sendMessage(
              a.user.telegramChatId!,
              `⏰ Công việc sắp đến hạn hôm nay: ${task.humanKey} — ${task.title}`,
            ),
          ),
        );
      }
      await this.prisma.db.task.update({
        where: { id: task.id },
        data: { telegramReminderSentAt: new Date() },
      });
    }

    if (tasks.length > 0) {
      this.logger.log(
        `Processed due-date reminders for ${tasks.length} task(s)`,
      );
    }
  }

  /**
   * Daily task-status digest, separate from the due-date sweep above: lists
   * ALL of a user's non-DONE assigned tasks (across every org they belong
   * to — see the unscoped-query note below), delivered at whatever VN hour
   * the user chose. Dedup is per-user-per-day (User.dailyDigestLastSentDate),
   * not per-task, since this isn't tied to any one task's due date. Same
   * single-instance/no-distributed-lock tradeoff as sendDueDateReminders
   * above: a missed tick (e.g. a restart) just means no digest that day,
   * never a duplicate.
   */
  @Cron('0 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async sendDailyDigests(): Promise<void> {
    if (!this.telegramProvider.isConfigured()) return;

    const currentHour = vnHour();
    const todayKey = vnDigestDateKey();
    const todayDate = new Date(`${todayKey}T00:00:00.000Z`);

    const users = await this.prisma.db.user.findMany({
      where: {
        telegramChatId: { not: null },
        dailyDigestEnabled: true,
        dailyDigestHour: currentHour,
        OR: [
          { dailyDigestLastSentDate: null },
          { dailyDigestLastSentDate: { not: todayDate } },
        ],
      },
      select: { id: true, telegramChatId: true },
    });

    for (const user of users) {
      // No organizationId filter: this runs outside any request context, so
      // the tenant-scoping extension passes it through unscoped — the same
      // mechanism sendDueDateReminders relies on — meaning this naturally
      // spans every org the user belongs to in one query.
      const tasks = await this.prisma.db.task.findMany({
        where: {
          status: { not: 'DONE' },
          assignees: { some: { userId: user.id, role: 'PRIMARY' } },
        },
        select: { humanKey: true, title: true, dueDate: true },
        orderBy: [
          { dueDate: { sort: 'asc', nulls: 'last' } },
          { title: 'asc' },
        ],
      });

      if (tasks.length > 0) {
        await this.telegramProvider.sendMessage(
          user.telegramChatId!,
          buildDigestMessage(tasks),
        );
      }
      // Stamp even when there are zero tasks, so this user isn't re-queried
      // every remaining hour of the day.
      await this.prisma.db.user.update({
        where: { id: user.id },
        data: { dailyDigestLastSentDate: todayDate },
      });
    }

    if (users.length > 0) {
      this.logger.log(`Processed daily digests for ${users.length} user(s)`);
    }
  }
}
