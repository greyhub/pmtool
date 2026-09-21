import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BulkNodeTypeInput,
  BulkNodeTypeResultDto,
  ProjectScopeDto,
  ScopeMapDto,
  UpsertScopeInput,
  UpsertWbsDictionaryInput,
  WbsDictionaryDto,
} from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

function base(orgSlug: string, projectKey: string) {
  return `/api/v1/organizations/${orgSlug}/projects/${projectKey}`;
}

const prefix = (orgSlug: string, projectKey: string) => ['organizations', orgSlug, 'projects', projectKey] as const;

export const scopeKeys = {
  scope: (orgSlug: string, projectKey: string) => [...prefix(orgSlug, projectKey), 'scope'] as const,
  // Nested under the tasks prefix on purpose: the map is derived from tasks, so
  // any task mutation (which invalidates that prefix) refreshes it too.
  map: (orgSlug: string, projectKey: string) => [...prefix(orgSlug, projectKey), 'tasks', 'scope-map'] as const,
  dictionary: (orgSlug: string, projectKey: string, taskId: string) =>
    [...prefix(orgSlug, projectKey), 'wbs-dictionary', taskId] as const,
};

export function useProjectScope(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: scopeKeys.scope(orgSlug ?? '', projectKey ?? ''),
    queryFn: () => apiRequest<ProjectScopeDto | null>(`${base(orgSlug!, projectKey!)}/scope`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}

export function useSaveScope(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertScopeInput) =>
      apiRequest<ProjectScopeDto>(`${base(orgSlug!, projectKey!)}/scope`, { method: 'PUT', body: input }),
    onSuccess: (scope) => {
      queryClient.setQueryData(scopeKeys.scope(orgSlug ?? '', projectKey ?? ''), scope);
      queryClient.invalidateQueries({ queryKey: scopeKeys.map(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

export function useApproveScope(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<ProjectScopeDto>(`${base(orgSlug!, projectKey!)}/scope/approve`, { method: 'POST' }),
    onSuccess: (scope) => {
      queryClient.setQueryData(scopeKeys.scope(orgSlug ?? '', projectKey ?? ''), scope);
      queryClient.invalidateQueries({ queryKey: scopeKeys.map(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

export function useScopeMap(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: scopeKeys.map(orgSlug ?? '', projectKey ?? ''),
    queryFn: () => apiRequest<ScopeMapDto>(`${base(orgSlug!, projectKey!)}/scope-map`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}

export function useWbsDictionary(
  orgSlug: string | undefined,
  projectKey: string | undefined,
  taskId: string | undefined,
) {
  return useQuery({
    queryKey: scopeKeys.dictionary(orgSlug ?? '', projectKey ?? '', taskId ?? ''),
    queryFn: () => apiRequest<WbsDictionaryDto | null>(`${base(orgSlug!, projectKey!)}/wbs/${taskId}/dictionary`),
    enabled: Boolean(orgSlug) && Boolean(projectKey) && Boolean(taskId),
  });
}

export function useSaveWbsDictionary(orgSlug: string | undefined, projectKey: string | undefined, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertWbsDictionaryInput) =>
      apiRequest<WbsDictionaryDto>(`${base(orgSlug!, projectKey!)}/wbs/${taskId}/dictionary`, {
        method: 'PUT',
        body: input,
      }),
    onSuccess: (entry) => {
      queryClient.setQueryData(scopeKeys.dictionary(orgSlug ?? '', projectKey ?? '', taskId), entry);
      queryClient.invalidateQueries({ queryKey: scopeKeys.map(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

/** Change the WBS level of many tasks at once (or set every level from tree depth). */
export function useBulkNodeType(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkNodeTypeInput) =>
      apiRequest<BulkNodeTypeResultDto>(`${base(orgSlug!, projectKey!)}/task-bulk/node-type`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (result) => {
      if (result.committed) {
        queryClient.invalidateQueries({ queryKey: [...prefix(orgSlug ?? '', projectKey ?? ''), 'tasks'] });
      }
    },
  });
}
