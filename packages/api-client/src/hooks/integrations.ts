import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TelegramLinkCodeDto, TelegramStatusDto } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

export const telegramKeys = {
  status: ['integrations', 'telegram', 'status'] as const,
};

export function useTelegramStatus() {
  return useQuery({
    queryKey: telegramKeys.status,
    queryFn: () => apiRequest<TelegramStatusDto>('/api/v1/integrations/telegram/status'),
  });
}

export function useGenerateTelegramLinkCode() {
  return useMutation({
    mutationFn: () =>
      apiRequest<TelegramLinkCodeDto>('/api/v1/integrations/telegram/link-code', { method: 'POST' }),
  });
}

export function useUnlinkTelegram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<void>('/api/v1/integrations/telegram/unlink', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(telegramKeys.status, { linked: false } satisfies TelegramStatusDto);
    },
  });
}
