import { Module } from '@nestjs/common';
import { ProjectGuard } from '../../common/guards/project.guard';
import { SprintsController } from './sprints.controller';
import { SprintsService } from './sprints.service';

@Module({
  controllers: [SprintsController],
  providers: [SprintsService, ProjectGuard],
  exports: [SprintsService],
})
export class SprintsModule {}
