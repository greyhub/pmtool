import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateOrganizationInput, MembershipDto, OrganizationDto } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

export const organizationKeys = {
  list: ['organizations'] as const,
  detail: (slug: string) => ['organizations', slug] as const,
  members: (slug: string) => ['organizations', slug, 'members'] as const,
};

export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.list,
    queryFn: () => apiRequest<OrganizationDto[]>('/api/v1/organizations'),
  });
}

export function useOrganization(slug: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.detail(slug ?? ''),
    queryFn: () => apiRequest<OrganizationDto>(`/api/v1/organizations/${slug}`),
    enabled: Boolean(slug),
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrganizationInput) =>
      apiRequest<OrganizationDto>('/api/v1/organizations', { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.list });
    },
  });
}

export function useOrganizationMembers(slug: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.members(slug ?? ''),
    queryFn: () => apiRequest<MembershipDto[]>(`/api/v1/organizations/${slug}/members`),
    enabled: Boolean(slug),
  });
}
