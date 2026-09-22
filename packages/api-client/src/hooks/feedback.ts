import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateFeedbackInput, FeedbackDto, UpdateFeedbackInput } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

export const feedbackKeys = {
  list: () => ['feedback'] as const,
};

/** Any signed-in user can submit; a 403 here just means "not the operator", handled by the caller. */
export function useAllFeedback() {
  return useQuery({
    queryKey: feedbackKeys.list(),
    queryFn: () => apiRequest<FeedbackDto[]>('/api/v1/feedback'),
    retry: false,
  });
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFeedbackInput) =>
      apiRequest<FeedbackDto>('/api/v1/feedback', { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.list() });
    },
  });
}

export function useUpdateFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFeedbackInput }) =>
      apiRequest<FeedbackDto>(`/api/v1/feedback/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.list() });
    },
  });
}
