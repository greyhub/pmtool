import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateProjectDocumentInput,
  ProjectDocumentDto,
  UpdateProjectDocumentInput,
} from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

function base(orgSlug: string, projectKey: string) {
  return `/api/v1/organizations/${orgSlug}/projects/${projectKey}`;
}

export const documentKeys = {
  list: (orgSlug: string, projectKey: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'documents'] as const,
};

export function useProjectDocuments(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: documentKeys.list(orgSlug ?? '', projectKey ?? ''),
    queryFn: () => apiRequest<ProjectDocumentDto[]>(`${base(orgSlug!, projectKey!)}/documents`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}

export function useCreateProjectDocument(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectDocumentInput) =>
      apiRequest<ProjectDocumentDto>(`${base(orgSlug!, projectKey!)}/documents`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.list(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

export function useUpdateProjectDocument(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, input }: { documentId: string; input: UpdateProjectDocumentInput }) =>
      apiRequest<ProjectDocumentDto>(`${base(orgSlug!, projectKey!)}/documents/${documentId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.list(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

export function useDeleteProjectDocument(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      apiRequest<void>(`${base(orgSlug!, projectKey!)}/documents/${documentId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.list(orgSlug ?? '', projectKey ?? '') });
    },
  });
}
