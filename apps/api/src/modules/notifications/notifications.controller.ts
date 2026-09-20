import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationListDto } from '@pmtool/shared-types';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { NotificationsService } from './notifications.service';

/** Each person sees only their own notifications — every query is keyed by the caller's id. */
@ApiTags('notifications')
@Controller({ path: 'organizations/:orgSlug/notifications', version: '1' })
@UseGuards(OrgMembershipGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ): Promise<{ data: NotificationListDto }> {
    const n = Number(limit);
    return {
      data: await this.notifications.list(
        ctx.organization.id,
        user.id,
        Number.isFinite(n) && n > 0 ? n : 30,
      ),
    };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async readAll(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.notifications.markAllRead(ctx.organization.id, user.id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async read(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.notifications.markRead(ctx.organization.id, user.id, id);
  }
}
