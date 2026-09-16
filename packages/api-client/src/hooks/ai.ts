import { useMutation } from '@tanstack/react-query';
import type {
  ParseNlTasksInput,
  ParseNlTasksResponseDto,
  SuggestSubtasksResponseDto,
  SummarizeTaskResponseDto,
} from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

function base(orgSlug: string, projectKey: string) {
  return `/api/v1/organizations/${orgSlug}/projects/${projectKey}`;
}

export function useSummarizeTask(orgSlug: string | undefined, projectKey: string | undefined) {
  return useMutation({
    mutationFn: (taskId: string) =>
      apiRequest<SummarizeTaskResponseDto>(`${base(orgSlug!, projectKey!)}/tasks/${taskId}/summarize`, {
        method: 'POST',
      }),
  });
}

export function useSuggestSubtasks(orgSlug: string | undefined, projectKey: string | undefined) {
  return useMutation({
    mutationFn: (taskId: string) =>
      apiRequest<SuggestSubtasksResponseDto>(`${base(orgSlug!, projectKey!)}/tasks/${taskId}/suggest-subtasks`, {
        method: 'POST',
      }),
  });
}

export function useParseNlTasks(orgSlug: string | undefined, projectKey: string | undefined) {
  return useMutation({
    mutationFn: (input: ParseNlTasksInput) =>
      apiRequest<ParseNlTasksResponseDto>(`${base(orgSlug!, projectKey!)}/tasks/parse-nl`, {
        method: 'POST',
        body: input,
      }),
  });
}
