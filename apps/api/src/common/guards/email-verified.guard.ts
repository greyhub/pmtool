import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Blocks the abuse/cost vectors (AI, sending invitations) for accounts whose
 * email is unverified, when EMAIL_VERIFICATION_REQUIRED is on. Runs after JwtAuthGuard.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      String(
        this.config.get('EMAIL_VERIFICATION_REQUIRED', { infer: true }),
      ) !== 'true'
    )
      return true;
    const userId: string | undefined = context.switchToHttp().getRequest()
      .user?.id;
    if (!userId) return true;
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });
    if (!user?.emailVerifiedAt) {
      throw new ForbiddenException(
        'Vui lòng xác minh email của bạn để dùng tính năng này (kiểm tra hộp thư hoặc gửi lại email xác minh).',
      );
    }
    return true;
  }
}
