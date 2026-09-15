import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { DependenciesController } from './dependencies.controller';
import { DependenciesService } from './dependencies.service';
import { CommentsService } from './comments.service';
import { ProjectGuard } from '../../common/guards/project.guard';

@Module({
  controllers: [TasksController, DependenciesController],
  providers: [TasksService, DependenciesService, CommentsService, ProjectGuard],
  exports: [TasksService],
})
export class TasksModule {}
