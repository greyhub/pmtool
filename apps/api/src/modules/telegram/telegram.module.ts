import { Module } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramProviderService } from './telegram-provider.service';
import { TelegramLinkingService } from './telegram-linking.service';
import { TelegramNotificationsService } from './telegram-notifications.service';

// Hard rule (same as GamificationModule): never import TasksModule here,
// even for a future "show my linked tasks"-type feature. TasksModule
// already imports this module — that edge would create a cycle.
@Module({
  controllers: [TelegramController],
  providers: [
    TelegramProviderService,
    TelegramLinkingService,
    TelegramNotificationsService,
  ],
  exports: [TelegramNotificationsService],
})
export class TelegramModule {}
