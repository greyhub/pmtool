import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  LeaderboardEntryDto,
  MyGamificationStatsDto,
  QuestDto,
} from '@pmtool/shared-types';
import { GamificationService } from './gamification.service';
import {
  toLeaderboardEntryDto,
  toMyGamificationStatsDto,
} from './gamification.mapper';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('gamification')
@Controller({ path: 'organizations/:orgSlug/gamification', version: '1' })
@UseGuards(OrgMembershipGuard)
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('leaderboard')
  async leaderboard(
    @CurrentOrg() ctx: CurrentOrgContext,
  ): Promise<{ data: LeaderboardEntryDto[] }> {
    const rows = await this.gamificationService.getLeaderboard(
      ctx.organization.id,
    );
    return { data: rows.map(toLeaderboardEntryDto) };
  }

  @Get('me')
  async me(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: MyGamificationStatsDto }> {
    const { score, badges } = await this.gamificationService.getMyStats(
      ctx.organization.id,
      user.id,
    );
    return { data: toMyGamificationStatsDto(score, badges) };
  }

  @Get('quests')
  async quests(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: QuestDto[] }> {
    const quests = await this.gamificationService.getMyQuests(
      ctx.organization.id,
      user.id,
    );
    return { data: quests };
  }
}
