import { Module } from '@nestjs/common';
import { ScopeController } from './scope.controller';
import { ScopeService } from './scope.service';
import { ProjectGuard } from '../../common/guards/project.guard';

@Module({
  controllers: [ScopeController],
  providers: [ScopeService, ProjectGuard],
})
export class ScopeModule {}
