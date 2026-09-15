import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProjectInput, ProjectDto, UpdateProjectInput } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

export const projectKeys = {
  list: (orgSlug: string) => ['organizations', orgSlug, 'projects'] as const,
  detail: (orgSlug: string, projectKey: string) => ['organizations', orgSlug, 'projects', projectKey] as const,
};

export function useProjects(orgSlug: string | undefined) {
  return useQuery({
    queryKey: projectKeys.list(orgSlug ?? ''),
    queryFn: () => apiRequest<ProjectDto[]>(`/api/v1/organizations/${orgSlug}/projects`),
    enabled: Boolean(orgSlug),
  });
}

export function useProject(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(orgSlug ?? '', projectKey ?? ''),
    queryFn: () => apiRequest<ProjectDto>(`/api/v1/organizations/${orgSlug}/projects/${projectKey}`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}

export function useCreateProject(orgSlug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      apiRequest<ProjectDto>(`/api/v1/organizations/${orgSlug}/projects`, { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.list(orgSlug ?? '') });
    },
  });
}

export function useUpdateProject(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) =>
      apiRequest<ProjectDto>(`/api/v1/organizations/${orgSlug}/projects/${projectKey}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.detail(orgSlug ?? '', projectKey ?? ''), project);
      queryClient.invalidateQueries({ queryKey: projectKeys.list(orgSlug ?? '') });
    },
  });
}
