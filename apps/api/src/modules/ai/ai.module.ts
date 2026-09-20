import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiQuotaService } from './ai-quota.service';
import { AnthropicProviderService } from './anthropic-provider.service';
import { TasksModule } from '../tasks/tasks.module';
import { ProjectGuard } from '../../common/guards/project.guard';

@Module({
  imports: [TasksModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiQuotaService,
    AnthropicProviderService,
    ProjectGuard,
  ],
})
export class AiModule {}
