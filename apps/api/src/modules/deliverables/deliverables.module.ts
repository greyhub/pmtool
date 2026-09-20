import { Module } from '@nestjs/common';
import { DeliverablesController } from './deliverables.controller';
import { DeliverablesService } from './deliverables.service';
import { ProjectGuard } from '../../common/guards/project.guard';

@Module({
  controllers: [DeliverablesController],
  providers: [DeliverablesService, ProjectGuard],
  exports: [DeliverablesService],
})
export class DeliverablesModule {}
