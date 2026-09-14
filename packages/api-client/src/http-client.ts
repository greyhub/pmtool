import type { ApiErrorBody, ApiSuccess, AuthTokens } from '@pmtool/shared-types';
import { getAccessToken, notifyUnauthenticated, setAccessToken } from './access-token-store';

let baseUrl = '';

export function configureApiClient(options: { baseUrl: string }): void {
  baseUrl = options.baseUrl.replace(/\/$/, '');
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  skipAuthRetry?: boolean;
}

async function rawRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const accessToken = getAccessToken();
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json().catch(() => undefined);

  if (!res.ok) {
    const errorBody = json as ApiErrorBody | undefined;
    throw new ApiError(
      res.status,
      errorBody?.error.code ?? 'UNKNOWN_ERROR',
      errorBody?.error.message ?? res.statusText,
      errorBody?.error.details,
    );
  }

  return (json as ApiSuccess<T>).data;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (err) {
    const isRefreshEndpoint = path === '/api/v1/auth/refresh';
    if (err instanceof ApiError && err.status === 401 && !options.skipAuthRetry && !isRefreshEndpoint) {
      try {
        const refreshed = await rawRequest<AuthTokens>('/api/v1/auth/refresh', { method: 'POST' });
        setAccessToken(refreshed.accessToken);
        return await rawRequest<T>(path, { ...options, skipAuthRetry: true });
      } catch {
        notifyUnauthenticated();
        throw err;
      }
    }
    throw err;
  }
}
