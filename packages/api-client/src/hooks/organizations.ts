import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AcceptInviteInput,
  CreateInviteInput,
  CreateJoinRequestInput,
  CreateOrganizationInput,
  DecideJoinRequestInput,
  JoinRequestDto,
  MembershipDto,
  OrganizationDto,
  UpdateMembershipRoleInput,
  UpdateOrganizationInput,
} from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

interface InviteDto {
  id: string;
  email: string;
  role: string;
  rawToken: string;
  expiresAt: string;
  /** True when the invitation email was actually sent. */
  emailed?: boolean;
}

interface PendingInviteDto {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

export const organizationKeys = {
  list: ['organizations'] as const,
  detail: (slug: string) => ['organizations', slug] as const,
  members: (slug: string) => ['organizations', slug, 'members'] as const,
  invites: (slug: string) => ['organizations', slug, 'invites'] as const,
  joinRequests: (slug: string) => ['organizations', slug, 'join-requests'] as const,
  myJoinRequests: ['join-requests', 'mine'] as const,
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

export function useUpdateOrganizationName(slug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOrganizationInput) =>
      apiRequest<OrganizationDto>(`/api/v1/organizations/${slug}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: (org) => {
      queryClient.setQueryData(organizationKeys.detail(slug ?? ''), org);
      queryClient.invalidateQueries({ queryKey: organizationKeys.list });
    },
  });
}

export function useArchiveOrganization(slug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<OrganizationDto>(`/api/v1/organizations/${slug}/archive`, { method: 'POST' }),
    onSuccess: (org) => {
      queryClient.setQueryData(organizationKeys.detail(slug ?? ''), org);
      queryClient.invalidateQueries({ queryKey: organizationKeys.list });
    },
  });
}

export function useUnarchiveOrganization(slug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<OrganizationDto>(`/api/v1/organizations/${slug}/unarchive`, { method: 'POST' }),
    onSuccess: (org) => {
      queryClient.setQueryData(organizationKeys.detail(slug ?? ''), org);
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

export function useOrganizationInvites(slug: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.invites(slug ?? ''),
    queryFn: () => apiRequest<PendingInviteDto[]>(`/api/v1/organizations/${slug}/invites`),
    enabled: Boolean(slug),
  });
}

export function useCreateInvite(slug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInviteInput) =>
      apiRequest<InviteDto>(`/api/v1/organizations/${slug}/invites`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.invites(slug ?? '') });
    },
  });
}

export function useCancelInvite(slug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiRequest<void>(`/api/v1/organizations/${slug}/invites/${inviteId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.invites(slug ?? '') });
    },
  });
}

export function useUpdateMembershipRole(slug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      membershipId,
      ...input
    }: UpdateMembershipRoleInput & { membershipId: string }) =>
      apiRequest<MembershipDto>(`/api/v1/organizations/${slug}/members/${membershipId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(slug ?? '') });
    },
  });
}

export function useRemoveMember(slug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) =>
      apiRequest<void>(`/api/v1/organizations/${slug}/members/${membershipId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(slug ?? '') });
    },
  });
}

/** Requests to join an org by slug — usable by anyone signed in, member or not. The slug is typed by the user, so it travels with the mutation call rather than being fixed on the hook. */
export function useCreateJoinRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, ...input }: CreateJoinRequestInput & { slug: string }) =>
      apiRequest<JoinRequestDto>(`/api/v1/organizations/${slug}/join-requests`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.myJoinRequests });
    },
  });
}

/** The current user's own join requests, across every organization. */
export function useMyJoinRequests() {
  return useQuery({
    queryKey: organizationKeys.myJoinRequests,
    queryFn: () => apiRequest<JoinRequestDto[]>('/api/v1/join-requests/mine'),
  });
}

/** Pending join requests for an org — OWNER/ADMIN only; a 403 for anyone else, left for the caller to handle. */
export function useJoinRequests(slug: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: organizationKeys.joinRequests(slug ?? ''),
    queryFn: () => apiRequest<JoinRequestDto[]>(`/api/v1/organizations/${slug}/join-requests`),
    enabled: Boolean(slug) && enabled,
  });
}

export function useApproveJoinRequest(slug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, ...input }: DecideJoinRequestInput & { requestId: string }) =>
      apiRequest<MembershipDto>(
        `/api/v1/organizations/${slug}/join-requests/${requestId}/approve`,
        {
          method: 'POST',
          body: input,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.joinRequests(slug ?? '') });
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(slug ?? '') });
    },
  });
}

export function useDeclineJoinRequest(slug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      apiRequest<JoinRequestDto>(
        `/api/v1/organizations/${slug}/join-requests/${requestId}/decline`,
        {
          method: 'POST',
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.joinRequests(slug ?? '') });
    },
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AcceptInviteInput) =>
      apiRequest<MembershipDto>('/api/v1/invites/accept', { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.list });
    },
  });
}
