import { Module } from '@nestjs/common';
import { CharterController } from './charter.controller';
import { CharterService } from './charter.service';
import { ProjectGuard } from '../../common/guards/project.guard';

@Module({
  controllers: [CharterController],
  providers: [CharterService, ProjectGuard],
  exports: [CharterService],
})
export class CharterModule {}
