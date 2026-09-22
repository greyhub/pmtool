import { Module } from '@nestjs/common';
import { ProjectGuard } from '../../common/guards/project.guard';
import { PresenceModule } from '../presence/presence.module';
import {
  AuditController,
  ProjectHistoryController,
} from './history.controller';
import { HistoryService } from './history.service';

@Module({
  imports: [PresenceModule],
  controllers: [ProjectHistoryController, AuditController],
  providers: [HistoryService, ProjectGuard],
})
export class HistoryModule {}
