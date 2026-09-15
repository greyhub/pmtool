import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BoardColumnDto, CreateBoardColumnInput } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

function base(orgSlug: string, projectKey: string) {
  return `/api/v1/organizations/${orgSlug}/projects/${projectKey}`;
}

export const boardKeys = {
  columns: (orgSlug: string, projectKey: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'board-columns'] as const,
};

export function useBoardColumns(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: boardKeys.columns(orgSlug ?? '', projectKey ?? ''),
    queryFn: () => apiRequest<BoardColumnDto[]>(`${base(orgSlug!, projectKey!)}/board-columns`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}

export function useCreateBoardColumn(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBoardColumnInput) =>
      apiRequest<BoardColumnDto>(`${base(orgSlug!, projectKey!)}/board-columns`, { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.columns(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

export function useDeleteBoardColumn(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (columnId: string) =>
      apiRequest<void>(`${base(orgSlug!, projectKey!)}/board-columns/${columnId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.columns(orgSlug ?? '', projectKey ?? '') });
      queryClient.invalidateQueries({ queryKey: ['organizations', orgSlug, 'projects', projectKey, 'tasks'] });
    },
  });
}
