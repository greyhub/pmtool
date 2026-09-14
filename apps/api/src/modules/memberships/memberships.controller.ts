import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createInviteSchema,
  MembershipDto,
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
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @UsePipes(new ZodValidationPipe(createInviteSchema))
  async createInvite(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { email: string; role: 'ADMIN' | 'PM' | 'MEMBER' | 'VIEWER' },
  ) {
    return {
      data: await this.membershipsService.createInvite(
        ctx.organization.id,
        user.id,
        body,
      ),
    };
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

  @Patch('members/:membershipId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @UsePipes(new ZodValidationPipe(updateMembershipRoleSchema))
  async updateRole(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('membershipId') membershipId: string,
    @Body() body: { role: 'ADMIN' | 'PM' | 'MEMBER' | 'VIEWER' },
  ): Promise<{ data: MembershipDto }> {
    const updated = await this.membershipsService.updateRole(
      ctx.organization.id,
      membershipId,
      body.role,
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
    );
  }
}
