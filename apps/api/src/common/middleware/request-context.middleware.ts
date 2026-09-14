import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import {
  requestContextStorage,
  RequestContextStore,
} from '../context/request-context';
import { EnvConfig } from '../../config/env.schema';
import { AccessTokenPayload } from '../../modules/auth/token.types';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const store: Partial<RequestContextStore> = {};

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice('Bearer '.length);
        const payload = this.jwtService.verify<AccessTokenPayload>(token, {
          secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
        });
        store.userId = payload.sub;
      } catch {
        // Invalid/expired token: leave userId unset. JwtAuthGuard is the
        // actual authority on rejecting the request with 401 — this
        // middleware only ever best-effort seeds context for tenant scoping.
      }
    }

    requestContextStorage.run(store as RequestContextStore, () => next());
  }
}
