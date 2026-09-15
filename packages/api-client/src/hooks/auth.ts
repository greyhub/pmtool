import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import type { AuthTokens, LoginInput, RegisterInput, UpdateUserPreferencesInput, UserDto } from '@pmtool/shared-types';
import { apiRequest, refreshSession } from '../http-client';
import { setAccessToken } from '../access-token-store';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

async function afterAuth(tokens: AuthTokens): Promise<AuthTokens> {
  setAccessToken(tokens.accessToken);
  return tokens;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => apiRequest<AuthTokens>('/api/v1/auth/login', { method: 'POST', body: input }),
    onSuccess: async (tokens) => {
      await afterAuth(tokens);
      queryClient.setQueryData(authKeys.me, tokens.user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => apiRequest<AuthTokens>('/api/v1/auth/register', { method: 'POST', body: input }),
    onSuccess: async (tokens) => {
      await afterAuth(tokens);
      queryClient.setQueryData(authKeys.me, tokens.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<void>('/api/v1/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      setAccessToken(null);
      queryClient.clear();
    },
  });
}

/** Call once on app bootstrap to silently exchange the httpOnly refresh cookie for an access token, if a session exists. */
export function useBootstrapSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => refreshSession(),
    onSuccess: async (tokens) => {
      await afterAuth(tokens);
      queryClient.setQueryData(authKeys.me, tokens.user);
    },
  });
}

export function useMe(options?: Partial<UseQueryOptions<UserDto>>) {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: () => apiRequest<UserDto>('/api/v1/auth/me'),
    retry: false,
    ...options,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserPreferencesInput) =>
      apiRequest<UserDto>('/api/v1/users/me/preferences', { method: 'PATCH', body: input }),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}
