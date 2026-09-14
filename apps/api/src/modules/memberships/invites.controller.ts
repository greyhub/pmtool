import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { acceptInviteSchema, MembershipDto } from '@pmtool/shared-types';
import { MembershipsService } from './memberships.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { toMembershipDto } from './membership.mapper';

@ApiTags('invites')
@Controller({ path: 'invites', version: '1' })
export class InvitesController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(acceptInviteSchema))
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { token: string },
  ): Promise<{ data: MembershipDto }> {
    const membership = await this.membershipsService.acceptInvite(
      body.token,
      user.id,
      user.email,
    );
    return { data: toMembershipDto(membership) };
  }
}
