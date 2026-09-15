import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRiskIssueInput, RiskIssueDto, UpdateRiskIssueInput } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

function base(orgSlug: string, projectKey: string) {
  return `/api/v1/organizations/${orgSlug}/projects/${projectKey}`;
}

export const riskKeys = {
  list: (orgSlug: string, projectKey: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'risks'] as const,
};

export function useRiskIssues(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: riskKeys.list(orgSlug ?? '', projectKey ?? ''),
    queryFn: () => apiRequest<RiskIssueDto[]>(`${base(orgSlug!, projectKey!)}/risks`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}

export function useCreateRiskIssue(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRiskIssueInput) =>
      apiRequest<RiskIssueDto>(`${base(orgSlug!, projectKey!)}/risks`, { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riskKeys.list(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

export function useUpdateRiskIssue(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ riskId, input }: { riskId: string; input: UpdateRiskIssueInput }) =>
      apiRequest<RiskIssueDto>(`${base(orgSlug!, projectKey!)}/risks/${riskId}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riskKeys.list(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

export function useDeleteRiskIssue(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (riskId: string) =>
      apiRequest<void>(`${base(orgSlug!, projectKey!)}/risks/${riskId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riskKeys.list(orgSlug ?? '', projectKey ?? '') });
    },
  });
}
