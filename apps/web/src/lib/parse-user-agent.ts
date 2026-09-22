/**
 * A rough {browser, os} guess from a raw User-Agent string — good enough for a login-history list, not meant
 * to be a precise device fingerprint. Order matters: Edge and Chrome UAs both contain "Safari", and Edge also
 * contains "Chrome", so the more specific match must be checked first.
 */
export function parseUserAgent(userAgent: string | null): {
  browser: string | null;
  os: string | null;
} {
  if (!userAgent) return { browser: null, os: null };

  let os: string | null = null;
  if (/Windows/.test(userAgent)) os = 'Windows';
  else if (/iPhone|iPad|iPod/.test(userAgent)) os = 'iOS';
  else if (/Mac OS X/.test(userAgent)) os = 'macOS';
  else if (/Android/.test(userAgent)) os = 'Android';
  else if (/Linux/.test(userAgent)) os = 'Linux';

  let browser: string | null = null;
  if (/Edg\//.test(userAgent)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(userAgent)) browser = 'Opera';
  else if (/Chrome\//.test(userAgent)) browser = 'Chrome';
  else if (/Firefox\//.test(userAgent)) browser = 'Firefox';
  else if (/Safari\//.test(userAgent)) browser = 'Safari';

  return { browser, os };
}
