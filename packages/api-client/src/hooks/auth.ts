import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import type {
  AuthTokens,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  TakenCharacterDto,
  UpdateUserPreferencesInput,
  UserDto,
  VerifyEmailInput,
} from '@pmtool/shared-types';
import { apiRequest, refreshSession } from '../http-client';
import { setAccessToken } from '../access-token-store';

export const authKeys = {
  me: ['auth', 'me'] as const,
  takenCharacters: ['auth', 'taken-characters'] as const,
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
      queryClient.invalidateQueries({ queryKey: authKeys.takenCharacters });
    },
  });
}

export function useTakenCharacters() {
  return useQuery({
    queryKey: authKeys.takenCharacters,
    queryFn: () => apiRequest<TakenCharacterDto[]>('/api/v1/users/me/taken-characters'),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      apiRequest<{ ok: true }>('/api/v1/auth/forgot-password', { method: 'POST', body: input }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      apiRequest<{ ok: true }>('/api/v1/auth/reset-password', { method: 'POST', body: input }),
  });
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VerifyEmailInput) =>
      apiRequest<{ ok: true }>('/api/v1/auth/verify-email', { method: 'POST', body: input }),
    // Someone verifying while signed in should see the banner disappear.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.me }),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: () =>
      apiRequest<{ alreadyVerified: boolean }>('/api/v1/auth/resend-verification', { method: 'POST' }),
  });
}

/** Whether "Sign in with Google" is configured on this server. */
export function useGoogleSignInEnabled() {
  return useQuery({
    queryKey: ['auth', 'google-config'] as const,
    queryFn: () => apiRequest<{ enabled: boolean }>('/api/v1/auth/google/config'),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** After the Google redirect the refresh cookie is set; trade it for an access token and load the user. */
export function useCompleteGoogleSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const tokens = await refreshSession();
      setAccessToken(tokens.accessToken);
      queryClient.setQueryData(authKeys.me, tokens.user);
      return tokens;
    },
  });
}
