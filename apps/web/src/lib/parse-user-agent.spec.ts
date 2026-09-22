import { describe, expect, it } from 'vitest';
import { parseUserAgent } from './parse-user-agent';

describe('parseUserAgent', () => {
  it('returns nulls for a missing user agent', () => {
    expect(parseUserAgent(null)).toEqual({ browser: null, os: null });
  });

  it('detects Chrome on macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
    expect(parseUserAgent(ua)).toEqual({ browser: 'Chrome', os: 'macOS' });
  });

  it('detects Safari on macOS, not Chrome', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    expect(parseUserAgent(ua)).toEqual({ browser: 'Safari', os: 'macOS' });
  });

  it('detects Edge, not Chrome, even though the UA string contains "Chrome"', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0';
    expect(parseUserAgent(ua)).toEqual({ browser: 'Edge', os: 'Windows' });
  });

  it('detects Safari on iOS', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    expect(parseUserAgent(ua)).toEqual({ browser: 'Safari', os: 'iOS' });
  });

  it('falls back to nulls for an unrecognized user agent', () => {
    expect(parseUserAgent('curl/8.4.0')).toEqual({ browser: null, os: null });
  });
});
