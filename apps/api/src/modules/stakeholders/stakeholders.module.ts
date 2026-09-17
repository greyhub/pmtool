import { Module } from '@nestjs/common';
import { StakeholdersController } from './stakeholders.controller';
import { StakeholdersService } from './stakeholders.service';
import { ProjectGuard } from '../../common/guards/project.guard';

@Module({
  controllers: [StakeholdersController],
  providers: [StakeholdersService, ProjectGuard],
  exports: [StakeholdersService],
})
export class StakeholdersModule {}
