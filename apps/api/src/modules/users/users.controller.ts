import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  UpdateUserPreferencesInput,
  updateUserPreferencesSchema,
  LoginEventDto,
  TakenCharacterDto,
  UserDto,
} from '@pmtool/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { toUserDto } from '../auth/user.mapper';
import { UsersService } from './users.service';
import { PresenceService } from '../presence/presence.service';
import { toLoginEventDto } from '../presence/login-event.mapper';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly presence: PresenceService,
  ) {}

  /** My own recent sign-ins — a personal security view. */
  @Get('me/login-history')
  async myLoginHistory(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: LoginEventDto[] }> {
    const events = await this.presence.myLoginHistory(user.id);
    return { data: events.map(toLoginEventDto) };
  }

  @Get('me/taken-characters')
  async takenCharacters(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: TakenCharacterDto[] }> {
    const taken = await this.usersService.takenCharacters(user.id);
    return { data: taken as TakenCharacterDto[] };
  }

  @Patch('me/preferences')
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateUserPreferencesSchema))
    body: UpdateUserPreferencesInput,
  ): Promise<{ data: UserDto }> {
    const updated = await this.usersService.updatePreferences(user.id, body);
    return { data: toUserDto(updated) };
  }
}
