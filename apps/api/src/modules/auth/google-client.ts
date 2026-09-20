import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../../config/env.schema';

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/** Talks to Google's OAuth endpoints. A separate class so tests can replace it with a fake. */
@Injectable()
export class GoogleClient {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  private get clientId(): string | undefined {
    return this.config.get('GOOGLE_CLIENT_ID', { infer: true });
  }

  get enabled(): boolean {
    return Boolean(
      this.clientId && this.config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
    );
  }

  /** Where Google sends the browser back to (must be registered in Google Cloud Console). */
  get redirectUri(): string {
    const base = String(
      this.config.get('API_PUBLIC_URL', { infer: true }),
    ).replace(/\/+$/, '');
    return `${base}/api/v1/auth/google/callback`;
  }

  authUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId ?? '',
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges the one-time code for the person's identity. The tokens come
   * straight from Google's token endpoint over TLS using our client secret, so
   * asking Google's userinfo endpoint with them is a trustworthy source of the profile.
   */
  async exchange(code: string): Promise<GoogleProfile> {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId ?? '',
        client_secret:
          this.config.get('GOOGLE_CLIENT_SECRET', { infer: true }) ?? '',
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok)
      throw new Error(`Google token exchange failed (${tokenRes.status})`);
    const { access_token: accessToken } = (await tokenRes.json()) as {
      access_token?: string;
    };
    if (!accessToken) throw new Error('Google returned no access token');

    const infoRes = await fetch(
      'https://openidconnect.googleapis.com/v1/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!infoRes.ok)
      throw new Error(`Google userinfo failed (${infoRes.status})`);
    const info = (await infoRes.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!info.sub || !info.email)
      throw new Error('Google profile has no email');
    return {
      sub: info.sub,
      email: info.email.toLowerCase(),
      emailVerified: info.email_verified === true,
      name: info.name ?? null,
      picture: info.picture ?? null,
    };
  }
}
