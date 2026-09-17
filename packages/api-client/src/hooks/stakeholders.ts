import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateStakeholderInput, StakeholderDto, UpdateStakeholderInput } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

function base(orgSlug: string, projectKey: string) {
  return `/api/v1/organizations/${orgSlug}/projects/${projectKey}`;
}

export const stakeholderKeys = {
  list: (orgSlug: string, projectKey: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'stakeholders'] as const,
};

export function useStakeholders(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: stakeholderKeys.list(orgSlug ?? '', projectKey ?? ''),
    queryFn: () => apiRequest<StakeholderDto[]>(`${base(orgSlug!, projectKey!)}/stakeholders`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}

export function useCreateStakeholder(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStakeholderInput) =>
      apiRequest<StakeholderDto>(`${base(orgSlug!, projectKey!)}/stakeholders`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stakeholderKeys.list(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

export function useUpdateStakeholder(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stakeholderId, input }: { stakeholderId: string; input: UpdateStakeholderInput }) =>
      apiRequest<StakeholderDto>(`${base(orgSlug!, projectKey!)}/stakeholders/${stakeholderId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stakeholderKeys.list(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

export function useDeleteStakeholder(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stakeholderId: string) =>
      apiRequest<void>(`${base(orgSlug!, projectKey!)}/stakeholders/${stakeholderId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stakeholderKeys.list(orgSlug ?? '', projectKey ?? '') });
    },
  });
}
