import { Module } from '@nestjs/common';
import {
  OrgDashboardController,
  ProjectDashboardController,
} from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ProjectGuard } from '../../common/guards/project.guard';

@Module({
  controllers: [OrgDashboardController, ProjectDashboardController],
  providers: [DashboardService, ProjectGuard],
})
export class DashboardModule {}
