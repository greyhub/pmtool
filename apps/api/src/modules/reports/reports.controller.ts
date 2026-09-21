import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import {
  DailyReportDto,
  DailyReportQuery,
  dailyReportQuerySchema,
} from '@pmtool/shared-types';
import { CurrentProject } from '../../common/decorators/current-project.decorator';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { ProjectGuard } from '../../common/guards/project.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/reports',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Anyone who can see the project can read its report. */
  @Get('daily')
  async daily(
    @CurrentProject() project: Project,
    @Query(new ZodValidationPipe(dailyReportQuerySchema))
    query: DailyReportQuery,
  ): Promise<{ data: DailyReportDto }> {
    return {
      data: await this.reports.dailyReport(
        project,
        query.date,
        query.compareTo,
      ),
    };
  }
}
