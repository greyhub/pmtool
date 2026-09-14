/**
 * Access token lives in memory only — never localStorage/sessionStorage —
 * to limit exposure if the page is ever compromised by XSS. It's naturally
 * lost on full page reload; the caller should re-derive it via POST
 * /auth/refresh (which reads the httpOnly refresh cookie) on app bootstrap.
 */
let accessToken: string | null = null;
const unauthenticatedListeners = new Set<() => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function onUnauthenticated(listener: () => void): () => void {
  unauthenticatedListeners.add(listener);
  return () => unauthenticatedListeners.delete(listener);
}

export function notifyUnauthenticated(): void {
  accessToken = null;
  for (const listener of unauthenticatedListeners) listener();
}
