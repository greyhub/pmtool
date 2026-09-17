import { ConfigService } from '@nestjs/config';
import { TelegramProviderService } from './telegram-provider.service';

describe('TelegramProviderService', () => {
  let configService: { get: ReturnType<typeof vi.fn> };
  let service: TelegramProviderService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'TELEGRAM_BOT_TOKEN') return 'test-token';
        if (key === 'API_PUBLIC_URL') return 'https://example.com';
        if (key === 'TELEGRAM_WEBHOOK_SECRET') return 'test-secret';
        return undefined;
      }),
    };
    service = new TelegramProviderService(
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isConfigured', () => {
    it('is true when a bot token is set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('is false when no bot token is set', () => {
      configService.get.mockReturnValue(undefined);
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('no-ops without calling fetch when unconfigured', async () => {
      configService.get.mockReturnValue(undefined);
      await service.sendMessage('123', 'hello');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('posts the expected request shape when configured', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });
      await service.sendMessage('123', 'hello');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ chat_id: '123', text: 'hello' }),
        }),
      );
    });

    it('swallows a fetch failure rather than throwing', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));
      await expect(
        service.sendMessage('123', 'hello'),
      ).resolves.toBeUndefined();
    });
  });

  describe('getBotUsername', () => {
    it('returns null when unconfigured, without calling fetch', async () => {
      configService.get.mockReturnValue(undefined);
      const result = await service.getBotUsername();
      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns and caches the username from getMe', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { username: 'pmtool_bot' } }),
      });

      const first = await service.getBotUsername();
      const second = await service.getBotUsername();

      expect(first).toBe('pmtool_bot');
      expect(second).toBe('pmtool_bot');
      expect(fetchMock).toHaveBeenCalledTimes(1); // cached after first call
    });

    it('returns null when the API call fails', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));
      const result = await service.getBotUsername();
      expect(result).toBeNull();
    });
  });

  describe('onModuleInit', () => {
    it('does nothing when unconfigured', async () => {
      configService.get.mockReturnValue(undefined);
      await service.onModuleInit();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('registers the webhook with the configured public URL and secret', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await service.onModuleInit();

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-token/setWebhook',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            url: 'https://example.com/api/v1/integrations/telegram/webhook',
            secret_token: 'test-secret',
          }),
        }),
      );
    });

    it('does not throw when webhook registration fails (must never block app bootstrap)', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));
      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
  });
});
