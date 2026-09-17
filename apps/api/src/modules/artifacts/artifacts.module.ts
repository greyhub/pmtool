import { Module } from '@nestjs/common';
import { ArtifactsController } from './artifacts.controller';
import { ArtifactsService } from './artifacts.service';
import { ProjectGuard } from '../../common/guards/project.guard';

@Module({
  controllers: [ArtifactsController],
  providers: [ArtifactsService, ProjectGuard],
  exports: [ArtifactsService],
})
export class ArtifactsModule {}
