import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  TelegramLinkCodeDto,
  TelegramStatusDto,
  UpdateTelegramDigestPreferencesInput,
  updateTelegramDigestPreferencesSchema,
} from '@pmtool/shared-types';
import { TelegramLinkingService } from './telegram-linking.service';
import { TelegramProviderService } from './telegram-provider.service';
import { telegramUpdateSchema, TelegramUpdate } from './telegram-update.schema';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { EnvConfig } from '../../config/env.schema';

@ApiTags('integrations')
@Controller({ path: 'integrations/telegram', version: '1' })
export class TelegramController {
  constructor(
    private readonly linkingService: TelegramLinkingService,
    private readonly telegramProvider: TelegramProviderService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  @Public()
  @Post('webhook')
  async webhook(
    @Headers('x-telegram-bot-api-secret-token')
    secretHeader: string | undefined,
    @Body(new ZodValidationPipe(telegramUpdateSchema)) update: TelegramUpdate,
  ): Promise<{ ok: true }> {
    const expectedSecret = this.configService.get('TELEGRAM_WEBHOOK_SECRET', {
      infer: true,
    });
    if (expectedSecret && !this.secretMatches(secretHeader, expectedSecret)) {
      throw new UnauthorizedException();
    }

    const message = update.message;
    const match = message?.text?.match(/^\/start\s+(\S+)/);
    if (!message || !match) {
      return { ok: true };
    }

    const chatId = String(message.chat.id);
    const linked = await this.linkingService.consumeLinkCode(match[1]!, chatId);
    await this.telegramProvider.sendMessage(
      chatId,
      linked
        ? '✅ Đã liên kết thành công với PMTool! Bạn sẽ nhận được thông báo tại đây.'
        : '⚠️ Mã liên kết không hợp lệ hoặc đã hết hạn. Vui lòng thử lại từ trang Cài đặt trong PMTool.',
    );
    return { ok: true };
  }

  @Post('link-code')
  async generateLinkCode(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: TelegramLinkCodeDto }> {
    const result = await this.linkingService.generateLinkCode(user.id);
    return {
      data: {
        code: result.code,
        deepLink: result.deepLink,
        expiresAt: result.expiresAt.toISOString(),
      },
    };
  }

  @Post('unlink')
  async unlink(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.linkingService.unlink(user.id);
  }

  @Get('status')
  async status(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: TelegramStatusDto }> {
    const data = await this.linkingService.getStatus(user.id);
    return { data };
  }

  @Patch('digest-preferences')
  async updateDigestPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateTelegramDigestPreferencesSchema))
    body: UpdateTelegramDigestPreferencesInput,
  ): Promise<{ data: TelegramStatusDto }> {
    await this.linkingService.updateDigestPreferences(user.id, body);
    const data = await this.linkingService.getStatus(user.id);
    return { data };
  }

  private secretMatches(
    received: string | undefined,
    expected: string,
  ): boolean {
    if (!received) return false;
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
