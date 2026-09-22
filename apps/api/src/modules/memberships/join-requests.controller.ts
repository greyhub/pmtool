import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateJoinRequestInput,
  createJoinRequestSchema,
  DecideJoinRequestInput,
  decideJoinRequestSchema,
  JoinRequestDto,
  MembershipDto,
} from '@pmtool/shared-types';
import { JoinRequestsService } from './join-requests.service';
import { toJoinRequestDto } from './join-request.mapper';
import { toMembershipDto } from './membership.mapper';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';

@ApiTags('join-requests')
@Controller({ path: 'organizations/:orgSlug/join-requests', version: '1' })
export class JoinRequestsController {
  constructor(private readonly joinRequestsService: JoinRequestsService) {}

  /** Deliberately no OrgMembershipGuard: the whole point is that the caller is not a member yet. */
  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({
    name: 'join-request-create',
    limit: 10,
    windowSec: 3600,
    by: 'user',
  })
  async create(
    @Param('orgSlug') orgSlug: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createJoinRequestSchema))
    body: CreateJoinRequestInput,
  ): Promise<{ data: JoinRequestDto }> {
    const request = await this.joinRequestsService.create(
      orgSlug,
      user.id,
      body,
    );
    return { data: toJoinRequestDto(request) };
  }

  @Get()
  @UseGuards(OrgMembershipGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
  ): Promise<{ data: JoinRequestDto[] }> {
    const requests = await this.joinRequestsService.listPending(
      ctx.organization.id,
    );
    return { data: requests.map(toJoinRequestDto) };
  }

  @Post(':requestId/approve')
  @UseGuards(OrgMembershipGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async approve(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(decideJoinRequestSchema))
    body: DecideJoinRequestInput,
  ): Promise<{ data: MembershipDto }> {
    const membership = await this.joinRequestsService.approve(
      ctx.organization.id,
      requestId,
      body.role,
      user.id,
    );
    return { data: toMembershipDto(membership) };
  }

  @Post(':requestId/decline')
  @UseGuards(OrgMembershipGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async decline(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: JoinRequestDto }> {
    const request = await this.joinRequestsService.decline(
      ctx.organization.id,
      requestId,
      user.id,
    );
    return { data: toJoinRequestDto(request) };
  }
}

/** The requester's own view, across every organization — used by onboarding to avoid re-showing the request form. */
@ApiTags('join-requests')
@Controller({ path: 'join-requests', version: '1' })
export class MyJoinRequestsController {
  constructor(private readonly joinRequestsService: JoinRequestsService) {}

  @Get('mine')
  async mine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: JoinRequestDto[] }> {
    const requests = await this.joinRequestsService.listMine(user.id);
    return { data: requests.map(toJoinRequestDto) };
  }
}
