import { LoginEvent, User } from '@prisma/client';
import { LoginEventDto } from '@pmtool/shared-types';

type WithUser = LoginEvent & {
  user?: Pick<User, 'id' | 'fullName' | 'email'>;
};

export function toLoginEventDto(event: WithUser): LoginEventDto {
  return {
    id: event.id,
    method: event.method,
    ip: event.ip,
    userAgent: event.userAgent,
    createdAt: event.createdAt.toISOString(),
    user: event.user,
  };
}
