import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateInviteInput,
  createInviteSchema,
  MembershipDto,
  UpdateMembershipRoleInput,
  updateMembershipRoleSchema,
} from '@pmtool/shared-types';
import { MembershipsService } from './memberships.service';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { toMembershipDto } from './membership.mapper';
import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';

@ApiTags('memberships')
@Controller({ path: 'organizations/:orgSlug', version: '1' })
@UseGuards(OrgMembershipGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get('members')
  async listMembers(
    @CurrentOrg() ctx: CurrentOrgContext,
  ): Promise<{ data: MembershipDto[] }> {
    const members = await this.membershipsService.listMembers(
      ctx.organization.id,
    );
    return { data: members.map(toMembershipDto) };
  }

  @Post('invites')
  @UseGuards(EmailVerifiedGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async createInvite(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createInviteSchema)) body: CreateInviteInput,
  ) {
    if (ctx.organization.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Không thể mời thành viên mới vào tổ chức đã lưu trữ',
      );
    }
    const invite = await this.membershipsService.createInvite(
      ctx.organization.id,
      user.id,
      body,
    );
    const emailed = await this.membershipsService.emailInvite(
      invite,
      ctx.organization.name,
      user.id,
    );
    return { data: { ...invite, emailed } };
  }

  @Get('invites')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async listInvites(@CurrentOrg() ctx: CurrentOrgContext) {
    return {
      data: await this.membershipsService.listPendingInvites(
        ctx.organization.id,
      ),
    };
  }

  @Delete('invites/:inviteId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async cancelInvite(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('inviteId') inviteId: string,
  ): Promise<void> {
    await this.membershipsService.cancelInvite(ctx.organization.id, inviteId);
  }

  @Patch('members/:membershipId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async updateRole(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('membershipId') membershipId: string,
    @Body(new ZodValidationPipe(updateMembershipRoleSchema))
    body: UpdateMembershipRoleInput,
  ): Promise<{ data: MembershipDto }> {
    const updated = await this.membershipsService.updateRole(
      ctx.organization.id,
      membershipId,
      body.role,
      ctx.role,
    );
    return { data: toMembershipDto(updated) };
  }

  @Delete('members/:membershipId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async removeMember(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('membershipId') membershipId: string,
  ): Promise<void> {
    await this.membershipsService.removeMember(
      ctx.organization.id,
      membershipId,
      ctx.role,
    );
  }
}
