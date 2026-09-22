import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateFeedbackInput,
  createFeedbackSchema,
  FeedbackDto,
  UpdateFeedbackInput,
  updateFeedbackSchema,
} from '@pmtool/shared-types';
import { FeedbackService } from './feedback.service';
import { toFeedbackDto } from './feedback.mapper';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { FeedbackAdminGuard } from '../../common/guards/feedback-admin.guard';

@ApiTags('feedback')
@Controller({ path: 'feedback', version: '1' })
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createFeedbackSchema))
    body: CreateFeedbackInput,
  ): Promise<{ data: FeedbackDto }> {
    const feedback = await this.feedbackService.create(user.id, body);
    return { data: toFeedbackDto(feedback) };
  }

  @Get()
  @UseGuards(FeedbackAdminGuard)
  async list(
    @Query('status') status?: string,
  ): Promise<{ data: FeedbackDto[] }> {
    const feedback = await this.feedbackService.list(status);
    return { data: feedback.map(toFeedbackDto) };
  }

  @Patch(':feedbackId')
  @UseGuards(FeedbackAdminGuard)
  async update(
    @Param('feedbackId') feedbackId: string,
    @Body(new ZodValidationPipe(updateFeedbackSchema))
    body: UpdateFeedbackInput,
  ): Promise<{ data: FeedbackDto }> {
    const feedback = await this.feedbackService.update(feedbackId, body);
    return { data: toFeedbackDto(feedback) };
  }
}
