import {
  TelegramNotificationsService,
  buildDigestMessage,
} from './telegram-notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramProviderService } from './telegram-provider.service';

describe('buildDigestMessage', () => {
  it('renders every task when under the display cap', () => {
    const message = buildDigestMessage([
      { humanKey: 'PRJ-1', title: 'Viết tài liệu', dueDate: null },
      {
        humanKey: 'PRJ-2',
        title: 'Sửa lỗi đăng nhập',
        dueDate: new Date('2026-03-15T00:00:00.000Z'),
      },
    ]);
    expect(message).toContain('Bạn còn 2 công việc chưa hoàn thành');
    expect(message).toContain('• PRJ-1 — Viết tài liệu');
    expect(message).toContain('• PRJ-2 — Sửa lỗi đăng nhập (hạn 15/03)');
    expect(message).not.toContain('công việc khác');
  });

  it('truncates to 15 tasks with a "+N more" tail beyond the cap', () => {
    const tasks = Array.from({ length: 18 }, (_, i) => ({
      humanKey: `PRJ-${i + 1}`,
      title: `Việc ${i + 1}`,
      dueDate: null,
    }));
    const message = buildDigestMessage(tasks);
    const lines = message.split('\n');
    expect(lines.filter((l) => l.startsWith('•'))).toHaveLength(15);
    expect(message).toContain('… và 3 công việc khác');
  });
});

describe('TelegramNotificationsService.sendDailyDigests', () => {
  let prisma: {
    db: {
      user: {
        findMany: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
      };
      task: { findMany: ReturnType<typeof vi.fn> };
    };
  };
  let telegramProvider: {
    isConfigured: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
  };
  let service: TelegramNotificationsService;

  beforeEach(() => {
    // 2026-03-11T10:00:00Z == 2026-03-11T17:00 +07:00 (VN hour 17, the default digest hour).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T10:00:00.000Z'));

    prisma = {
      db: {
        user: {
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn().mockResolvedValue({}),
        },
        task: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };
    telegramProvider = {
      isConfigured: vi.fn().mockReturnValue(true),
      sendMessage: vi.fn().mockResolvedValue(undefined),
    };
    service = new TelegramNotificationsService(
      prisma as unknown as PrismaService,
      telegramProvider as unknown as TelegramProviderService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when Telegram is not configured', async () => {
    telegramProvider.isConfigured.mockReturnValue(false);

    await service.sendDailyDigests();

    expect(prisma.db.user.findMany).not.toHaveBeenCalled();
  });

  it('queries users matching the current VN hour and not yet sent today', async () => {
    await service.sendDailyDigests();

    expect(prisma.db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          telegramChatId: { not: null },
          dailyDigestEnabled: true,
          dailyDigestHour: 17,
          OR: [
            { dailyDigestLastSentDate: null },
            {
              dailyDigestLastSentDate: {
                not: new Date('2026-03-11T00:00:00.000Z'),
              },
            },
          ],
        }),
      }),
    );
  });

  it('sends a message and stamps the send date for a user with active tasks', async () => {
    prisma.db.user.findMany.mockResolvedValue([
      { id: 'user_1', telegramChatId: 'chat_1' },
    ]);
    prisma.db.task.findMany.mockResolvedValue([
      { humanKey: 'PRJ-1', title: 'Việc 1', dueDate: null },
    ]);

    await service.sendDailyDigests();

    expect(telegramProvider.sendMessage).toHaveBeenCalledWith(
      'chat_1',
      expect.stringContaining('PRJ-1'),
    );
    expect(prisma.db.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { dailyDigestLastSentDate: new Date('2026-03-11T00:00:00.000Z') },
    });
  });

  it('skips sending but still stamps the date for a user with zero active tasks', async () => {
    prisma.db.user.findMany.mockResolvedValue([
      { id: 'user_1', telegramChatId: 'chat_1' },
    ]);
    prisma.db.task.findMany.mockResolvedValue([]);

    await service.sendDailyDigests();

    expect(telegramProvider.sendMessage).not.toHaveBeenCalled();
    expect(prisma.db.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { dailyDigestLastSentDate: new Date('2026-03-11T00:00:00.000Z') },
    });
  });

  it("scopes the task query to only that user's assignments across all their orgs", async () => {
    prisma.db.user.findMany.mockResolvedValue([
      { id: 'user_1', telegramChatId: 'chat_1' },
    ]);

    await service.sendDailyDigests();

    expect(prisma.db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { not: 'DONE' },
          assignees: { some: { userId: 'user_1' } },
        },
      }),
    );
  });
});
