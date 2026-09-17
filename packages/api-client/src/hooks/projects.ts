import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddProjectMemberInput,
  CreateProjectInput,
  ProjectDto,
  ProjectMemberDto,
  UpdateProjectInput,
  UpdateProjectMemberRoleInput,
} from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

export const projectKeys = {
  list: (orgSlug: string) => ['organizations', orgSlug, 'projects'] as const,
  detail: (orgSlug: string, projectKey: string) => ['organizations', orgSlug, 'projects', projectKey] as const,
  members: (orgSlug: string, projectKey: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'members'] as const,
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

export function useProjectMembers(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: projectKeys.members(orgSlug ?? '', projectKey ?? ''),
    queryFn: () =>
      apiRequest<ProjectMemberDto[]>(`/api/v1/organizations/${orgSlug}/projects/${projectKey}/members`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}

export function useAddProjectMember(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddProjectMemberInput) =>
      apiRequest<ProjectMemberDto>(`/api/v1/organizations/${orgSlug}/projects/${projectKey}/members`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.members(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

export function useUpdateProjectMemberRole(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectMemberId, ...input }: UpdateProjectMemberRoleInput & { projectMemberId: string }) =>
      apiRequest<ProjectMemberDto>(
        `/api/v1/organizations/${orgSlug}/projects/${projectKey}/members/${projectMemberId}`,
        { method: 'PATCH', body: input },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.members(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

export function useRemoveProjectMember(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectMemberId: string) =>
      apiRequest<void>(`/api/v1/organizations/${orgSlug}/projects/${projectKey}/members/${projectMemberId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.members(orgSlug ?? '', projectKey ?? '') });
    },
  });
}
