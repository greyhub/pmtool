import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  TelegramStatusDto,
  UpdateTelegramDigestPreferencesInput,
} from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramProviderService } from './telegram-provider.service';
import { generateLinkCodeRaw, hashLinkCode } from './link-code.util';

const LINK_CODE_TTL_MS = 10 * 60 * 1000;

export interface GeneratedLinkCode {
  code: string;
  deepLink: string;
  expiresAt: Date;
}

@Injectable()
export class TelegramLinkingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramProvider: TelegramProviderService,
  ) {}

  async generateLinkCode(userId: string): Promise<GeneratedLinkCode> {
    if (!this.telegramProvider.isConfigured()) {
      throw new ServiceUnavailableException(
        'Tính năng Telegram chưa được cấu hình trên máy chủ.',
      );
    }
    const botUsername = await this.telegramProvider.getBotUsername();
    if (!botUsername) {
      throw new ServiceUnavailableException(
        'Không thể kết nối tới Telegram. Vui lòng thử lại.',
      );
    }

    const rawCode = generateLinkCodeRaw();
    const codeHash = hashLinkCode(rawCode);
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);

    // Invalidate-then-create in one transaction so two concurrent requests
    // can't both succeed and leave two valid codes outstanding.
    await this.prisma.db.$transaction([
      this.prisma.db.telegramLinkCode.deleteMany({ where: { userId } }),
      this.prisma.db.telegramLinkCode.create({
        data: { userId, codeHash, expiresAt },
      }),
    ]);

    return {
      code: rawCode,
      deepLink: `https://t.me/${botUsername}?start=${rawCode}`,
      expiresAt,
    };
  }

  /** Called from the webhook handler. Hard-deletes the code on use — unlike RefreshToken/MembershipInvite's revoke-and-retain pattern, a consumed one-time link code has no audit value. */
  async consumeLinkCode(rawCode: string, chatId: string): Promise<boolean> {
    const codeHash = hashLinkCode(rawCode);
    const linkCode = await this.prisma.db.telegramLinkCode.findUnique({
      where: { codeHash },
    });
    if (!linkCode || linkCode.expiresAt < new Date()) {
      return false;
    }

    await this.prisma.db.$transaction([
      this.prisma.db.user.update({
        where: { id: linkCode.userId },
        data: { telegramChatId: chatId },
      }),
      this.prisma.db.telegramLinkCode.delete({ where: { id: linkCode.id } }),
    ]);
    return true;
  }

  async unlink(userId: string): Promise<void> {
    await this.prisma.db.user.update({
      where: { id: userId },
      data: { telegramChatId: null },
    });
  }

  async getStatus(userId: string): Promise<TelegramStatusDto> {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: {
        telegramChatId: true,
        dailyDigestEnabled: true,
        dailyDigestHour: true,
      },
    });
    return {
      linked: Boolean(user?.telegramChatId),
      dailyDigestEnabled: user?.dailyDigestEnabled ?? true,
      dailyDigestHour: user?.dailyDigestHour ?? 17,
    };
  }

  async updateDigestPreferences(
    userId: string,
    input: UpdateTelegramDigestPreferencesInput,
  ): Promise<void> {
    await this.prisma.db.user.update({ where: { id: userId }, data: input });
  }
}
