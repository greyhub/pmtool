import { Module } from '@nestjs/common';
import { ProjectGuard } from '../../common/guards/project.guard';
import {
  AuditController,
  ProjectHistoryController,
} from './history.controller';
import { HistoryService } from './history.service';

@Module({
  controllers: [ProjectHistoryController, AuditController],
  providers: [HistoryService, ProjectGuard],
})
export class HistoryModule {}
