import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { EnvConfig } from '../../../config/env.schema';
import { AccessTokenPayload } from '../token.types';
import { PresenceService } from '../../presence/presence.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<EnvConfig, true>,
    private readonly presence: PresenceService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedUser {
    // Fire-and-forget, throttled internally — must never delay the request this token is authenticating.
    this.presence.touch(payload.sub);
    return { id: payload.sub, email: payload.email };
  }
}
