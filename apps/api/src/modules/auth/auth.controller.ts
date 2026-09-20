import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import {
  AuthTokens,
  LoginInput,
  loginSchema,
  ForgotPasswordInput,
  forgotPasswordSchema,
  RegisterInput,
  registerSchema,
  ResetPasswordInput,
  resetPasswordSchema,
  VerifyEmailInput,
  verifyEmailSchema,
  UserDto,
} from '@pmtool/shared-types';
import { AuthService, IssuedRefreshToken } from './auth.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from './strategies/jwt.strategy';
import { EnvConfig } from '../../config/env.schema';
import { UsersService } from '../users/users.service';
import { toUserDto } from './user.mapper';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { AccountService } from './account.service';

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountService: AccountService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'register', limit: 10, windowSec: 3600, by: 'ip' })
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: AuthTokens }> {
    const { tokens, refreshToken } = await this.authService.register(
      body,
      req.headers['user-agent'],
    );
    // Verification email goes out after the account exists; a mail outage must not fail sign-up.
    void this.accountService
      .sendVerification(tokens.user.id)
      .catch(() => undefined);
    this.setRefreshCookie(res, refreshToken);
    return { data: tokens };
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit(
    { name: 'login-account', limit: 10, windowSec: 900, by: 'ipEmail' },
    { name: 'login-ip', limit: 60, windowSec: 900, by: 'ip' },
  )
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: AuthTokens }> {
    const { tokens, refreshToken } = await this.authService.login(
      body,
      req.headers['user-agent'],
    );
    this.setRefreshCookie(res, refreshToken);
    return { data: tokens };
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'refresh', limit: 120, windowSec: 60, by: 'ip' })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: AuthTokens }> {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) {
      throw new UnauthorizedException('Thiếu refresh token');
    }
    const { tokens, refreshToken } = await this.authService.refresh(
      rawToken,
      req.headers['user-agent'],
    );
    this.setRefreshCookie(res, refreshToken);
    return { data: tokens };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logoutAll(user.id);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit(
    { name: 'forgot-account', limit: 5, windowSec: 3600, by: 'ipEmail' },
    { name: 'forgot-ip', limit: 30, windowSec: 3600, by: 'ip' },
  )
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema))
    body: ForgotPasswordInput,
  ): Promise<{ data: { ok: true } }> {
    await this.accountService.forgotPassword(body.email);
    return { data: { ok: true } };
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'reset-password', limit: 20, windowSec: 3600, by: 'ip' })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
  ): Promise<{ data: { ok: true } }> {
    await this.accountService.resetPassword(body.token, body.password);
    return { data: { ok: true } };
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'verify-email', limit: 30, windowSec: 3600, by: 'ip' })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
  ): Promise<{ data: { ok: true } }> {
    await this.accountService.verifyEmail(body.token);
    return { data: { ok: true } };
  }

  @UseGuards(RateLimitGuard)
  @RateLimit({
    name: 'resend-verification',
    limit: 5,
    windowSec: 3600,
    by: 'user',
  })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: { alreadyVerified: boolean } }> {
    return { data: await this.accountService.sendVerification(user.id) };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<{ data: UserDto }> {
    const fullUser = await this.usersService.findByIdOrThrow(user.id);
    return { data: toUserDto(fullUser) };
  }

  private setRefreshCookie(
    res: Response,
    refreshToken: IssuedRefreshToken,
  ): void {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken.rawToken, {
      httpOnly: true,
      secure:
        this.configService.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      expires: refreshToken.expiresAt,
    });
  }
}
