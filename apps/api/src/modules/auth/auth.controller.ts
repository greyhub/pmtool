import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UsePipes,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import {
  AuthTokens,
  loginSchema,
  registerSchema,
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

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  @Public()
  @Post('register')
  @UsePipes(new ZodValidationPipe(registerSchema))
  async register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: AuthTokens }> {
    const { tokens, refreshToken } = await this.authService.register(
      body as never,
      req.headers['user-agent'],
    );
    this.setRefreshCookie(res, refreshToken);
    return { data: tokens };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: AuthTokens }> {
    const { tokens, refreshToken } = await this.authService.login(
      body as never,
      req.headers['user-agent'],
    );
    this.setRefreshCookie(res, refreshToken);
    return { data: tokens };
  }

  @Public()
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
