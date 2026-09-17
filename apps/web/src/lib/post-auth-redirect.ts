/**
 * Only ever follow a same-origin, locale-relative path from a `redirect`
 * query param — never a full URL or a protocol-relative `//host/...` one,
 * which would turn this into an open redirect.
 */
export function safeRedirectTarget(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}
