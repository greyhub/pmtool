import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { deleteAccountSchema, DeleteAccountInput } from '@pmtool/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { PrivacyService } from './privacy.service';

@ApiTags('privacy')
@Controller({ version: '1' })
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('users/me/export')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'export-user', limit: 10, windowSec: 3600, by: 'user' })
  async exportMe(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.privacy.exportUser(user.id) };
  }

  @Delete('users/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'delete-account', limit: 5, windowSec: 3600, by: 'user' })
  async deleteMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: DeleteAccountInput,
  ): Promise<void> {
    await this.privacy.deleteAccount(user.id, body);
  }

  @Get('organizations/:orgSlug/export')
  @UseGuards(OrgMembershipGuard, RolesGuard, RateLimitGuard)
  @Roles('OWNER', 'ADMIN')
  @RateLimit({ name: 'export-org', limit: 10, windowSec: 3600, by: 'user' })
  async exportOrganization(@CurrentOrg() ctx: CurrentOrgContext) {
    return { data: await this.privacy.exportOrganization(ctx.organization.id) };
  }

  @Delete('organizations/:orgSlug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OrgMembershipGuard, RolesGuard, RateLimitGuard)
  @Roles('OWNER')
  @RateLimit({ name: 'delete-org', limit: 5, windowSec: 3600, by: 'user' })
  async deleteOrganization(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: DeleteAccountInput,
  ): Promise<void> {
    await this.privacy.deleteOrganization(ctx.organization.id, user.id, body);
  }
}
