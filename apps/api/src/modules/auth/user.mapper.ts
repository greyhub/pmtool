import { User } from '@prisma/client';
import { UserDto } from '@pmtool/shared-types';

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    locale: user.locale as UserDto['locale'],
    themePref: user.themePref as UserDto['themePref'],
    mascotCharacter: user.mascotCharacter as UserDto['mascotCharacter'],
    createdAt: user.createdAt.toISOString(),
  };
}
