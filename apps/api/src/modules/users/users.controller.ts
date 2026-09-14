import { Body, Controller, Patch, UsePipes } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  UpdateUserPreferencesInput,
  updateUserPreferencesSchema,
  UserDto,
} from '@pmtool/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { toUserDto } from '../auth/user.mapper';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me/preferences')
  @UsePipes(new ZodValidationPipe(updateUserPreferencesSchema))
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateUserPreferencesInput,
  ): Promise<{ data: UserDto }> {
    const updated = await this.usersService.updatePreferences(user.id, body);
    return { data: toUserDto(updated) };
  }
}
