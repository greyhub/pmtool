import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MyTaskDto, NotificationListDto } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

const notificationsKey = (orgSlug: string) => ['organizations', orgSlug, 'notifications'] as const;

/** Polls gently so the bell stays current without a socket. */
export function useNotifications(orgSlug: string | undefined) {
  return useQuery({
    queryKey: notificationsKey(orgSlug ?? ''),
    queryFn: () => apiRequest<NotificationListDto>(`/api/v1/organizations/${orgSlug}/notifications`),
    enabled: Boolean(orgSlug),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead(orgSlug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/v1/organizations/${orgSlug}/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey(orgSlug ?? '') }),
  });
}

export function useMarkAllNotificationsRead(orgSlug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<void>(`/api/v1/organizations/${orgSlug}/notifications/read-all`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey(orgSlug ?? '') }),
  });
}

export function useMyTasks(orgSlug: string | undefined, includeDone = false) {
  return useQuery({
    // Under the org prefix and refreshed by task mutations elsewhere on the next visit.
    queryKey: ['organizations', orgSlug ?? '', 'my-tasks', includeDone] as const,
    queryFn: () =>
      apiRequest<MyTaskDto[]>(`/api/v1/organizations/${orgSlug}/my-tasks${includeDone ? '?includeDone=true' : ''}`),
    enabled: Boolean(orgSlug),
  });
}
