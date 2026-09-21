import { Module } from '@nestjs/common';
import { ProjectGuard } from '../../common/guards/project.guard';
import { ReportsController } from './reports.controller';
import { ReportsScheduler } from './reports.scheduler';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportsScheduler, ProjectGuard],
})
export class ReportsModule {}
