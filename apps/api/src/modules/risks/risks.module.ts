import { Module } from '@nestjs/common';
import { RisksController } from './risks.controller';
import { RisksService } from './risks.service';
import { ProjectGuard } from '../../common/guards/project.guard';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [GamificationModule],
  controllers: [RisksController],
  providers: [RisksService, ProjectGuard],
  exports: [RisksService],
})
export class RisksModule {}
