import { useQuery } from '@tanstack/react-query';
import type { LoginEventDto } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

export const presenceKeys = {
  myLoginHistory: ['users', 'me', 'login-history'] as const,
  orgLoginHistory: (slug: string) => ['organizations', slug, 'audit', 'logins'] as const,
};

/** My own recent sign-ins — a personal security view. */
export function useMyLoginHistory() {
  return useQuery({
    queryKey: presenceKeys.myLoginHistory,
    queryFn: () => apiRequest<LoginEventDto[]>('/api/v1/users/me/login-history'),
  });
}

/** Every login by every current member of the org — OWNER/ADMIN only; a 403 for anyone else. */
export function useOrgLoginHistory(orgSlug: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: presenceKeys.orgLoginHistory(orgSlug ?? ''),
    queryFn: () => apiRequest<LoginEventDto[]>(`/api/v1/organizations/${orgSlug}/audit/logins`),
    enabled: Boolean(orgSlug) && enabled,
  });
}
