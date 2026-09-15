import { useQuery } from '@tanstack/react-query';
import type { OrgDashboardDto, ProjectDashboardDto } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

export const dashboardKeys = {
  org: (orgSlug: string) => ['organizations', orgSlug, 'dashboard'] as const,
  project: (orgSlug: string, projectKey: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'dashboard'] as const,
};

export function useOrgDashboard(orgSlug: string | undefined) {
  return useQuery({
    queryKey: dashboardKeys.org(orgSlug ?? ''),
    queryFn: () => apiRequest<OrgDashboardDto>(`/api/v1/organizations/${orgSlug}/dashboard`),
    enabled: Boolean(orgSlug),
  });
}

export function useProjectDashboard(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: dashboardKeys.project(orgSlug ?? '', projectKey ?? ''),
    queryFn: () =>
      apiRequest<ProjectDashboardDto>(`/api/v1/organizations/${orgSlug}/projects/${projectKey}/dashboard`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}
