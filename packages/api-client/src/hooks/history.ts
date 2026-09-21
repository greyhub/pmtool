import { useInfiniteQuery } from '@tanstack/react-query';
import type { AuditQuery, HistoryPageDto, HistoryQuery } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

function qs(query: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** A project's change history, newest first, loaded a page at a time. Filters: one entity, an action, a person, a date range. */
export function useProjectHistory(
  orgSlug: string | undefined,
  projectKey: string | undefined,
  filters: Omit<HistoryQuery, 'cursor' | 'limit'> = {},
  enabled = true,
) {
  return useInfiniteQuery({
    // Under the project prefix so any change refreshes it.
    queryKey: ['organizations', orgSlug ?? '', 'projects', projectKey ?? '', 'history', filters] as const,
    queryFn: ({ pageParam }) =>
      apiRequest<HistoryPageDto>(
        `/api/v1/organizations/${orgSlug}/projects/${projectKey}/history${qs({ ...filters, cursor: pageParam, limit: 30 })}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: enabled && Boolean(orgSlug) && Boolean(projectKey),
  });
}

/** The organization-wide audit trail (owners and admins). */
export function useAuditTrail(
  orgSlug: string | undefined,
  filters: Omit<AuditQuery, 'cursor' | 'limit'> = {},
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: ['organizations', orgSlug ?? '', 'audit', filters] as const,
    queryFn: ({ pageParam }) =>
      apiRequest<HistoryPageDto>(`/api/v1/organizations/${orgSlug}/audit${qs({ ...filters, cursor: pageParam, limit: 30 })}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: enabled && Boolean(orgSlug),
  });
}
