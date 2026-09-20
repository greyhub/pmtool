import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { EnvConfig } from '../../config/env.schema';
import { GoogleAuthService } from './google-auth.service';
import { GoogleClient } from './google-client';

const STATE_COOKIE = 'oauth_state';
const STATE_COOKIE_PATH = '/api/v1/auth/google';
const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

/** Only a same-site, locale-relative path may be followed after sign-in (never a full or `//` URL). */
function safePath(value: unknown): string {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//')
    ? value
    : '';
}

@ApiTags('auth')
@Controller({ path: 'auth/google', version: '1' })
export class GoogleAuthController {
  constructor(
    private readonly google: GoogleClient,
    private readonly googleAuth: GoogleAuthService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  private webUrl(path: string): string {
    return `${String(this.config.get('WEB_PUBLIC_URL', { infer: true })).replace(/\/+$/, '')}${path}`;
  }

  private get secureCookies(): boolean {
    return this.config.get('NODE_ENV', { infer: true }) === 'production';
  }

  /** Lets the sign-in pages decide whether to show the Google button. */
  @Public()
  @Get('config')
  config_(): { data: { enabled: boolean } } {
    return { data: { enabled: this.google.enabled } };
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'google-start', limit: 30, windowSec: 600, by: 'ip' })
  @Get('start')
  start(
    @Query('redirect') redirect: string | undefined,
    @Query('locale') locale: string | undefined,
    @Res() res: Response,
  ): void {
    if (!this.google.enabled)
      throw new NotFoundException('Đăng nhập bằng Google chưa được bật');
    const state = randomBytes(24).toString('hex');
    // The state (and where to go afterwards) rides in a short-lived cookie, and must come back unchanged.
    res.cookie(
      STATE_COOKIE,
      JSON.stringify({
        state,
        redirect: safePath(redirect),
        locale: locale === 'en' ? 'en' : 'vi',
      }),
      {
        httpOnly: true,
        secure: this.secureCookies,
        sameSite: 'lax',
        path: STATE_COOKIE_PATH,
        maxAge: 10 * 60 * 1000,
      },
    );
    res.redirect(HttpStatus.FOUND, this.google.authUrl(state));
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'google-callback', limit: 30, windowSec: 600, by: 'ip' })
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.google.enabled)
      throw new NotFoundException('Đăng nhập bằng Google chưa được bật');
    let saved: { state?: string; redirect?: string; locale?: string } = {};
    try {
      saved = JSON.parse(req.cookies?.[STATE_COOKIE] ?? '{}');
    } catch {
      saved = {};
    }
    res.clearCookie(STATE_COOKIE, { path: STATE_COOKIE_PATH });
    const locale = saved.locale === 'en' ? 'en' : 'vi';
    const fail = () =>
      res.redirect(
        HttpStatus.FOUND,
        this.webUrl(`/${locale}/login?error=google`),
      );

    if (error || !code || !state || !saved.state || state !== saved.state)
      return fail();
    try {
      const profile = await this.google.exchange(code);
      const { refreshToken } = await this.googleAuth.signIn(
        profile,
        req.headers['user-agent'],
      );
      res.cookie(REFRESH_COOKIE_NAME, refreshToken.rawToken, {
        httpOnly: true,
        secure: this.secureCookies,
        sameSite: 'lax',
        path: REFRESH_COOKIE_PATH,
        expires: refreshToken.expiresAt,
      });
      const target = saved.redirect
        ? `?redirect=${encodeURIComponent(saved.redirect)}`
        : '';
      res.redirect(
        HttpStatus.FOUND,
        this.webUrl(`/${locale}/auth/google-done${target}`),
      );
    } catch {
      fail();
    }
  }
}
