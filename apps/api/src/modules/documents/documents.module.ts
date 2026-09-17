import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { ProjectGuard } from '../../common/guards/project.guard';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, ProjectGuard],
  exports: [DocumentsService],
})
export class DocumentsModule {}
