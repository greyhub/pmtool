import { Module } from '@nestjs/common';
import { RisksController } from './risks.controller';
import { RisksService } from './risks.service';
import { ProjectGuard } from '../../common/guards/project.guard';

@Module({
  controllers: [RisksController],
  providers: [RisksService, ProjectGuard],
  exports: [RisksService],
})
export class RisksModule {}
