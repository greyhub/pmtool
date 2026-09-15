import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AcceptInviteInput,
  acceptInviteSchema,
  MembershipDto,
} from '@pmtool/shared-types';
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
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(acceptInviteSchema)) body: AcceptInviteInput,
  ): Promise<{ data: MembershipDto }> {
    const membership = await this.membershipsService.acceptInvite(
      body.token,
      user.id,
      user.email,
    );
    return { data: toMembershipDto(membership) };
  }
}
