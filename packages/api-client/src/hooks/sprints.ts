import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BurndownDto,
  CloseSprintInput,
  CreateSprintInput,
  SprintDto,
  UpdateSprintInput,
} from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

function base(orgSlug: string, projectKey: string) {
  return `/api/v1/organizations/${orgSlug}/projects/${projectKey}/sprints`;
}

export const sprintKeys = {
  list: (orgSlug: string, projectKey: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'sprints'] as const,
};

export function useSprints(
  orgSlug: string | undefined,
  projectKey: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: sprintKeys.list(orgSlug ?? '', projectKey ?? ''),
    queryFn: () => apiRequest<SprintDto[]>(base(orgSlug!, projectKey!)),
    enabled: enabled && Boolean(orgSlug) && Boolean(projectKey),
  });
}

/** Sprint totals are derived from tasks, so any change to either must refresh both. */
function refresh(
  queryClient: ReturnType<typeof useQueryClient>,
  orgSlug: string,
  projectKey: string,
) {
  queryClient.invalidateQueries({ queryKey: sprintKeys.list(orgSlug, projectKey) });
  queryClient.invalidateQueries({
    queryKey: ['organizations', orgSlug, 'projects', projectKey, 'tasks'],
  });
}

export function useCreateSprint(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSprintInput) =>
      apiRequest<SprintDto>(base(orgSlug!, projectKey!), { method: 'POST', body: input }),
    onSuccess: () => refresh(queryClient, orgSlug ?? '', projectKey ?? ''),
  });
}

export function useUpdateSprint(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sprintId, input }: { sprintId: string; input: UpdateSprintInput }) =>
      apiRequest<SprintDto>(`${base(orgSlug!, projectKey!)}/${sprintId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => refresh(queryClient, orgSlug ?? '', projectKey ?? ''),
  });
}

export function useStartSprint(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sprintId: string) =>
      apiRequest<SprintDto>(`${base(orgSlug!, projectKey!)}/${sprintId}/start`, { method: 'POST' }),
    onSuccess: () => refresh(queryClient, orgSlug ?? '', projectKey ?? ''),
  });
}

export function useCloseSprint(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sprintId, input }: { sprintId: string; input: CloseSprintInput }) =>
      apiRequest<SprintDto>(`${base(orgSlug!, projectKey!)}/${sprintId}/close`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => refresh(queryClient, orgSlug ?? '', projectKey ?? ''),
  });
}

export function useDeleteSprint(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sprintId: string) =>
      apiRequest<void>(`${base(orgSlug!, projectKey!)}/${sprintId}`, { method: 'DELETE' }),
    onSuccess: () => refresh(queryClient, orgSlug ?? '', projectKey ?? ''),
  });
}

export function useSprintBurndown(
  orgSlug: string | undefined,
  projectKey: string | undefined,
  sprintId: string | undefined,
) {
  return useQuery({
    // Under the sprints prefix so any sprint or task change refreshes it.
    queryKey: [...sprintKeys.list(orgSlug ?? '', projectKey ?? ''), 'burndown', sprintId ?? ''] as const,
    queryFn: () => apiRequest<BurndownDto>(`${base(orgSlug!, projectKey!)}/${sprintId}/burndown`),
    enabled: Boolean(orgSlug) && Boolean(projectKey) && Boolean(sprintId),
  });
}
