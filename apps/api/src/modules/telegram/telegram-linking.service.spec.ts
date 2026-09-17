import { ServiceUnavailableException } from '@nestjs/common';
import { TelegramLinkingService } from './telegram-linking.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramProviderService } from './telegram-provider.service';
import { hashLinkCode } from './link-code.util';

describe('TelegramLinkingService', () => {
  let prisma: {
    db: {
      $transaction: ReturnType<typeof vi.fn>;
      telegramLinkCode: {
        deleteMany: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        findUnique: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
      };
      user: {
        update: ReturnType<typeof vi.fn>;
        findUnique: ReturnType<typeof vi.fn>;
      };
    };
  };
  let telegramProvider: {
    isConfigured: ReturnType<typeof vi.fn>;
    getBotUsername: ReturnType<typeof vi.fn>;
  };
  let service: TelegramLinkingService;

  beforeEach(() => {
    prisma = {
      db: {
        $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
        telegramLinkCode: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn(),
          delete: vi.fn().mockResolvedValue({}),
        },
        user: {
          update: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn(),
        },
      },
    };
    telegramProvider = {
      isConfigured: vi.fn().mockReturnValue(true),
      getBotUsername: vi.fn().mockResolvedValue('pmtool_bot'),
    };
    service = new TelegramLinkingService(
      prisma as unknown as PrismaService,
      telegramProvider as unknown as TelegramProviderService,
    );
  });

  describe('generateLinkCode', () => {
    it('throws when Telegram is not configured, without touching the database', async () => {
      telegramProvider.isConfigured.mockReturnValue(false);

      await expect(service.generateLinkCode('user_1')).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(prisma.db.$transaction).not.toHaveBeenCalled();
    });

    it('throws when the bot username cannot be fetched', async () => {
      telegramProvider.getBotUsername.mockResolvedValue(null);

      await expect(service.generateLinkCode('user_1')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('invalidates any previous code and creates a new one in a single transaction', async () => {
      const result = await service.generateLinkCode('user_1');

      expect(prisma.db.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.db.telegramLinkCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user_1' },
      });
      expect(prisma.db.telegramLinkCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user_1' }),
        }),
      );
      expect(result.deepLink).toBe(
        `https://t.me/pmtool_bot?start=${result.code}`,
      );
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('consumeLinkCode', () => {
    it('returns false and makes no changes for an unknown code', async () => {
      prisma.db.telegramLinkCode.findUnique.mockResolvedValue(null);

      const result = await service.consumeLinkCode('bogus', 'chat_1');

      expect(result).toBe(false);
      expect(prisma.db.$transaction).not.toHaveBeenCalled();
    });

    it('returns false and makes no changes for an expired code', async () => {
      prisma.db.telegramLinkCode.findUnique.mockResolvedValue({
        id: 'code_1',
        userId: 'user_1',
        codeHash: hashLinkCode('raw'),
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await service.consumeLinkCode('raw', 'chat_1');

      expect(result).toBe(false);
      expect(prisma.db.$transaction).not.toHaveBeenCalled();
    });

    it('links the chat id and deletes the code for a valid, unexpired code', async () => {
      prisma.db.telegramLinkCode.findUnique.mockResolvedValue({
        id: 'code_1',
        userId: 'user_1',
        codeHash: hashLinkCode('raw'),
        expiresAt: new Date(Date.now() + 1000 * 60),
      });

      const result = await service.consumeLinkCode('raw', 'chat_1');

      expect(result).toBe(true);
      expect(prisma.db.user.update).toHaveBeenCalledWith({
        where: { id: 'user_1' },
        data: { telegramChatId: 'chat_1' },
      });
      expect(prisma.db.telegramLinkCode.delete).toHaveBeenCalledWith({
        where: { id: 'code_1' },
      });
    });
  });

  describe('getStatus', () => {
    it('reports linked: true when a chat id is set', async () => {
      prisma.db.user.findUnique.mockResolvedValue({ telegramChatId: 'chat_1' });
      await expect(service.getStatus('user_1')).resolves.toEqual({
        linked: true,
      });
    });

    it('reports linked: false when no chat id is set', async () => {
      prisma.db.user.findUnique.mockResolvedValue({ telegramChatId: null });
      await expect(service.getStatus('user_1')).resolves.toEqual({
        linked: false,
      });
    });
  });
});
