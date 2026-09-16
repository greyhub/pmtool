import { Injectable } from '@nestjs/common';
import {
  ParseNlTasksResponseDto,
  SuggestSubtasksResponseDto,
  SummarizeTaskResponseDto,
  summarizeTaskResponseSchema,
  taskSuggestionListSchema,
} from '@pmtool/shared-types';
import { AnthropicProviderService } from './anthropic-provider.service';
import { TasksService } from '../tasks/tasks.service';
import { fromRichText } from '../tasks/rich-text.util';

const PRIORITY_HINT =
  '"priority" là một trong LOW, MEDIUM, HIGH, CRITICAL (tuỳ chọn, chỉ đưa vào nếu rõ ràng)';

@Injectable()
export class AiService {
  constructor(
    private readonly anthropic: AnthropicProviderService,
    private readonly tasksService: TasksService,
  ) {}

  async summarizeTask(
    organizationId: string,
    taskId: string,
  ): Promise<SummarizeTaskResponseDto> {
    const task = await this.tasksService.findByIdOrThrow(
      organizationId,
      taskId,
    );
    const description = fromRichText(task.description) ?? '(không có mô tả)';

    const prompt = [
      'Tóm tắt ngắn gọn (2-3 câu, tiếng Việt) công việc quản lý dự án sau.',
      'Trả về JSON đúng dạng {"summary": "..."}.',
      `Tiêu đề: ${task.title}`,
      `Mô tả: ${description}`,
    ].join('\n');

    return this.anthropic.generateJson(prompt, summarizeTaskResponseSchema);
  }

  async suggestSubtasks(
    organizationId: string,
    taskId: string,
  ): Promise<SuggestSubtasksResponseDto> {
    const task = await this.tasksService.findByIdOrThrow(
      organizationId,
      taskId,
    );
    const description = fromRichText(task.description) ?? '(không có mô tả)';

    const prompt = [
      'Bạn là trợ lý quản lý dự án. Đề xuất 3-6 công việc con (subtask) cụ thể, khả thi để hoàn thành công việc sau.',
      `Trả về JSON là một mảng, mỗi phần tử dạng {"title": "..."}. ${PRIORITY_HINT}`,
      `Tiêu đề công việc: ${task.title}`,
      `Mô tả: ${description}`,
    ].join('\n');

    const suggestions = await this.anthropic.generateJson(
      prompt,
      taskSuggestionListSchema,
    );
    return { suggestions };
  }

  async parseNlTasks(
    projectName: string,
    text: string,
  ): Promise<ParseNlTasksResponseDto> {
    const today = new Date().toISOString().slice(0, 10);
    const prompt = [
      `Bạn là trợ lý quản lý dự án cho dự án "${projectName}". Người dùng mô tả công việc cần làm bằng ngôn ngữ tự nhiên bên dưới.`,
      `Phân tích và trả về JSON là một mảng các công việc, mỗi phần tử dạng {"title": "..."}. ${PRIORITY_HINT}.`,
      '"dueDate" (tuỳ chọn, định dạng ISO 8601 đầy đủ như "2026-01-15T00:00:00.000Z") chỉ đưa vào nếu người dùng nêu thời hạn cụ thể.',
      `Hôm nay là ${today}.`,
      `Mô tả của người dùng: "${text}"`,
    ].join('\n');

    const suggestions = await this.anthropic.generateJson(
      prompt,
      taskSuggestionListSchema,
    );
    return { suggestions };
  }
}
