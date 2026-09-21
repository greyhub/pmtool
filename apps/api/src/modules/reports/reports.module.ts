import { Module } from '@nestjs/common';
import { ProjectGuard } from '../../common/guards/project.guard';
import { SprintsModule } from '../sprints/sprints.module';
import { ReportsController } from './reports.controller';
import { ReportsScheduler } from './reports.scheduler';
import { ReportsService } from './reports.service';

@Module({
  imports: [SprintsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsScheduler, ProjectGuard],
})
export class ReportsModule {}
