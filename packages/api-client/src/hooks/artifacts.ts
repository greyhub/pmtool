import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ArtifactDetailDto,
  ArtifactSummaryDto,
  CreateArtifactInput,
  UpdateArtifactInput,
} from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

function base(orgSlug: string, projectKey: string) {
  return `/api/v1/organizations/${orgSlug}/projects/${projectKey}`;
}

export const artifactKeys = {
  list: (orgSlug: string, projectKey: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'artifacts'] as const,
  detail: (orgSlug: string, projectKey: string, artifactId: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'artifacts', artifactId] as const,
};

export function useArtifacts(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: artifactKeys.list(orgSlug ?? '', projectKey ?? ''),
    queryFn: () => apiRequest<ArtifactSummaryDto[]>(`${base(orgSlug!, projectKey!)}/artifacts`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}

export function useArtifact(
  orgSlug: string | undefined,
  projectKey: string | undefined,
  artifactId: string | undefined,
) {
  return useQuery({
    queryKey: artifactKeys.detail(orgSlug ?? '', projectKey ?? '', artifactId ?? ''),
    queryFn: () =>
      apiRequest<ArtifactDetailDto>(`${base(orgSlug!, projectKey!)}/artifacts/${artifactId}`),
    enabled: Boolean(orgSlug) && Boolean(projectKey) && Boolean(artifactId),
  });
}

export function useCreateArtifact(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateArtifactInput) =>
      apiRequest<ArtifactDetailDto>(`${base(orgSlug!, projectKey!)}/artifacts`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: artifactKeys.list(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

export function useUpdateArtifact(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artifactId, input }: { artifactId: string; input: UpdateArtifactInput }) =>
      apiRequest<ArtifactDetailDto>(`${base(orgSlug!, projectKey!)}/artifacts/${artifactId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: (_data, { artifactId }) => {
      queryClient.invalidateQueries({ queryKey: artifactKeys.list(orgSlug ?? '', projectKey ?? '') });
      queryClient.invalidateQueries({
        queryKey: artifactKeys.detail(orgSlug ?? '', projectKey ?? '', artifactId),
      });
    },
  });
}

export function useDeleteArtifact(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (artifactId: string) =>
      apiRequest<void>(`${base(orgSlug!, projectKey!)}/artifacts/${artifactId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: artifactKeys.list(orgSlug ?? '', projectKey ?? '') });
    },
  });
}
