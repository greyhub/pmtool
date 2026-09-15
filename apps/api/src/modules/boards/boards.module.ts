import { Module } from '@nestjs/common';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { ProjectGuard } from '../../common/guards/project.guard';

@Module({
  controllers: [BoardsController],
  providers: [BoardsService, ProjectGuard],
  exports: [BoardsService],
})
export class BoardsModule {}
