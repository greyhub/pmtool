import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { DependenciesController } from './dependencies.controller';
import { DependenciesService } from './dependencies.service';
import { CommentsService } from './comments.service';
import { MyTasksController } from './my-tasks.controller';
import { TaskCsvController } from './task-csv.controller';
import { TaskCsvService } from './task-csv.service';
import { ProjectGuard } from '../../common/guards/project.guard';
import { GamificationModule } from '../gamification/gamification.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [GamificationModule, TelegramModule, ActivityModule],
  controllers: [
    TasksController,
    DependenciesController,
    TaskCsvController,
    MyTasksController,
  ],
  providers: [
    TasksService,
    DependenciesService,
    CommentsService,
    TaskCsvService,
    ProjectGuard,
  ],
  exports: [TasksService],
})
export class TasksModule {}
