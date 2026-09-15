import { useQuery } from '@tanstack/react-query';
import type { ActivityLogDto } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

export const activityKeys = {
  org: (orgSlug: string) => ['organizations', orgSlug, 'activity'] as const,
};

export function useOrgActivity(orgSlug: string | undefined) {
  return useQuery({
    queryKey: activityKeys.org(orgSlug ?? ''),
    queryFn: () => apiRequest<ActivityLogDto[]>(`/api/v1/organizations/${orgSlug}/activity`),
    enabled: Boolean(orgSlug),
  });
}
