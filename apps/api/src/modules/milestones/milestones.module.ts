import { Module } from '@nestjs/common';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';
import { ProjectGuard } from '../../common/guards/project.guard';

@Module({
  controllers: [MilestonesController],
  providers: [MilestonesService, ProjectGuard],
})
export class MilestonesModule {}
