import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectCharterDto, UpsertCharterInput } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

function base(orgSlug: string, projectKey: string) {
  return `/api/v1/organizations/${orgSlug}/projects/${projectKey}`;
}

export const charterKeys = {
  detail: (orgSlug: string, projectKey: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'charter'] as const,
};

export function useCharter(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: charterKeys.detail(orgSlug ?? '', projectKey ?? ''),
    queryFn: () => apiRequest<ProjectCharterDto | null>(`${base(orgSlug!, projectKey!)}/charter`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}

export function useUpsertCharter(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertCharterInput) =>
      apiRequest<ProjectCharterDto>(`${base(orgSlug!, projectKey!)}/charter`, {
        method: 'PUT',
        body: input,
      }),
    onSuccess: (charter) => {
      queryClient.setQueryData(charterKeys.detail(orgSlug ?? '', projectKey ?? ''), charter);
    },
  });
}

export function useApproveCharter(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<ProjectCharterDto>(`${base(orgSlug!, projectKey!)}/charter/approve`, {
        method: 'POST',
      }),
    onSuccess: (charter) => {
      queryClient.setQueryData(charterKeys.detail(orgSlug ?? '', projectKey ?? ''), charter);
    },
  });
}
