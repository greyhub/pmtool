import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../../config/env.schema';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * The only place any code talks to the Telegram Bot API — keeps the
 * provider swappable and isolates the raw HTTP calls (native fetch, no
 * dependency added — same choice Phase 2's AnthropicProviderService relies
 * on transitively). Unlike AnthropicProviderService.generateJson (which
 * throws when unconfigured, since it answers a direct user action),
 * sendMessage() silently no-ops and swallows failures — notifications are
 * a fire-and-forget side effect of some other action (assigning a task)
 * and must never fail or block that action.
 */
@Injectable()
export class TelegramProviderService implements OnModuleInit {
  private readonly logger = new Logger(TelegramProviderService.name);
  private cachedBotUsername: string | null = null;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  isConfigured(): boolean {
    return Boolean(this.getToken());
  }

  async onModuleInit(): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      await this.registerWebhook();
    } catch (err) {
      // Never fail app bootstrap over a Telegram API hiccup.
      this.logger.warn(
        `Failed to register Telegram webhook: ${(err as Error).message}`,
      );
    }
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    const token = this.getToken();
    if (!token) return;
    try {
      await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch (err) {
      this.logger.warn(
        `Failed to send Telegram message: ${(err as Error).message}`,
      );
    }
  }

  /** Cached after the first successful call — avoids a separate TELEGRAM_BOT_USERNAME env var. */
  async getBotUsername(): Promise<string | null> {
    if (this.cachedBotUsername) return this.cachedBotUsername;
    const token = this.getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getMe`);
      const data = (await res.json()) as {
        ok: boolean;
        result?: { username?: string };
      };
      if (data.ok && data.result?.username) {
        this.cachedBotUsername = data.result.username;
        return this.cachedBotUsername;
      }
    } catch (err) {
      this.logger.warn(
        `Failed to fetch Telegram bot username: ${(err as Error).message}`,
      );
    }
    return null;
  }

  private async registerWebhook(): Promise<void> {
    const token = this.getToken();
    if (!token) return;
    const publicUrl = this.configService.get('API_PUBLIC_URL', { infer: true });
    const webhookSecret = this.configService.get('TELEGRAM_WEBHOOK_SECRET', {
      infer: true,
    });
    const url = `${publicUrl}/api/v1/integrations/telegram/webhook`;

    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, secret_token: webhookSecret || undefined }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      throw new Error(data.description ?? 'setWebhook failed');
    }
    this.logger.log(`Telegram webhook registered at ${url}`);
  }

  private getToken(): string | undefined {
    return this.configService.get('TELEGRAM_BOT_TOKEN', { infer: true });
  }
}
