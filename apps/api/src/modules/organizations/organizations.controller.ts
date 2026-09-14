import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createOrganizationSchema,
  OrganizationDto,
} from '@pmtool/shared-types';
import { OrganizationsService } from './organizations.service';
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
import { toOrganizationDto } from './organization.mapper';

@ApiTags('organizations')
@Controller({ path: 'organizations', version: '1' })
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createOrganizationSchema))
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { name: string; slug: string },
  ): Promise<{ data: OrganizationDto }> {
    const org = await this.organizationsService.create(user.id, body);
    return { data: toOrganizationDto(org) };
  }

  @Get()
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: OrganizationDto[] }> {
    const orgs = await this.organizationsService.listForUser(user.id);
    return { data: orgs.map(toOrganizationDto) };
  }

  @Get(':orgSlug')
  @UseGuards(OrgMembershipGuard)
  async getOne(
    @CurrentOrg() ctx: CurrentOrgContext,
  ): Promise<{ data: OrganizationDto }> {
    return { data: toOrganizationDto(ctx.organization) };
  }

  @Patch(':orgSlug')
  @UseGuards(OrgMembershipGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async updateName(
    @Param('orgSlug') _orgSlug: string,
    @CurrentOrg() ctx: CurrentOrgContext,
    @Body() body: { name: string },
  ): Promise<{ data: OrganizationDto }> {
    const org = await this.organizationsService.updateName(
      ctx.organization.id,
      body.name,
    );
    return { data: toOrganizationDto(org) };
  }
}
