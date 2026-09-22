import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { FeedbackAdminGuard } from '../../common/guards/feedback-admin.guard';

@Module({
  controllers: [FeedbackController],
  providers: [FeedbackService, FeedbackAdminGuard],
})
export class FeedbackModule {}
