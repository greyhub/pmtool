import { useQuery } from '@tanstack/react-query';
import type { DailyReportDto } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

export function useDailyReport(
  orgSlug: string | undefined,
  projectKey: string | undefined,
  date?: string,
  compareTo?: string,
) {
  const query = new URLSearchParams();
  if (date) query.set('date', date);
  if (compareTo) query.set('compareTo', compareTo);
  const qs = query.toString();
  return useQuery({
    queryKey: ['organizations', orgSlug ?? '', 'projects', projectKey ?? '', 'reports', 'daily', date ?? 'today', compareTo ?? 'prev'],
    queryFn: () =>
      apiRequest<DailyReportDto>(
        `/api/v1/organizations/${orgSlug}/projects/${projectKey}/reports/daily${qs ? `?${qs}` : ''}`,
      ),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
    // Today's report is live: refresh it while the page is open.
    refetchInterval: date ? false : 60_000,
  });
}
