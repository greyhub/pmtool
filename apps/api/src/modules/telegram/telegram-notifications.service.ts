import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Task } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramProviderService } from './telegram-provider.service';
import { vnStartOfToday, vnStartOfTomorrow } from './due-date-window.util';

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
      const recipients = task.assignees.filter((a) => a.user.telegramChatId);
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
}
