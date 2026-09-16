import { z } from 'zod';
import { TASK_PRIORITIES } from '../common/enums';

export const taskSuggestionSchema = z.object({
  title: z.string().min(1).max(300),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: z.string().datetime().optional(),
  estimateHours: z.number().min(0).max(1000).optional(),
});
export type TaskSuggestionDto = z.infer<typeof taskSuggestionSchema>;

/** What the LLM is asked to produce for both suggest-subtasks and parse-nl — validated server-side before it ever reaches a client. */
export const taskSuggestionListSchema = z.array(taskSuggestionSchema).max(20);

export const summarizeTaskResponseSchema = z.object({ summary: z.string() });
export type SummarizeTaskResponseDto = z.infer<typeof summarizeTaskResponseSchema>;

export const suggestSubtasksResponseSchema = z.object({ suggestions: z.array(taskSuggestionSchema) });
export type SuggestSubtasksResponseDto = z.infer<typeof suggestSubtasksResponseSchema>;

export const parseNlTasksInputSchema = z.object({ text: z.string().min(1).max(2000) });
export type ParseNlTasksInput = z.infer<typeof parseNlTasksInputSchema>;

export const parseNlTasksResponseSchema = z.object({ suggestions: z.array(taskSuggestionSchema) });
export type ParseNlTasksResponseDto = z.infer<typeof parseNlTasksResponseSchema>;
