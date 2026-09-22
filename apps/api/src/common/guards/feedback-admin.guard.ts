import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../../config/env.schema';
import { AuthenticatedUser } from '../../modules/auth/strategies/jwt.strategy';

/** Only the emails listed in FEEDBACK_ADMIN_EMAILS may read or triage submitted feedback. */
@Injectable()
export class FeedbackAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const raw = this.config.get('FEEDBACK_ADMIN_EMAILS', { infer: true }) ?? '';
    const admins = raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const user = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>().user;
    if (!admins.includes(user.email.toLowerCase())) {
      throw new ForbiddenException('Not authorized to manage feedback.');
    }
    return true;
  }
}
