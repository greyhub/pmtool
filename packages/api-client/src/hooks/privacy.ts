import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeleteAccountInput } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';
import { setAccessToken } from '../access-token-store';

/** A full export is a large JSON document the caller saves as a file. */
type ExportDocument = Record<string, unknown>;

export function useExportMyData() {
  return useMutation({
    mutationFn: () => apiRequest<ExportDocument>('/api/v1/users/me/export'),
  });
}

export function useExportOrganization(orgSlug: string | undefined) {
  return useMutation({
    mutationFn: () => apiRequest<ExportDocument>(`/api/v1/organizations/${orgSlug}/export`),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteAccountInput) =>
      apiRequest<void>('/api/v1/users/me', { method: 'DELETE', body: input }),
    onSuccess: () => {
      // The account is gone; drop the session and everything cached for it.
      setAccessToken(null);
      queryClient.clear();
    },
  });
}

export function useDeleteOrganization(orgSlug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteAccountInput) =>
      apiRequest<void>(`/api/v1/organizations/${orgSlug}`, { method: 'DELETE', body: input }),
    onSuccess: () => queryClient.clear(),
  });
}
