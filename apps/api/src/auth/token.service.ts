import { Inject, Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";
import type { ApiEnv } from "@dho/config";
import type { UserRole } from "@dho/contracts";

import { APP_ENV } from "../config/config.tokens";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class TokenService {
  constructor(@Inject(APP_ENV) private readonly env: ApiEnv) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, this.env.JWT_ACCESS_SECRET, {
      expiresIn: this.env.ACCESS_TOKEN_TTL,
    } as jwt.SignOptions);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, this.env.JWT_ACCESS_SECRET) as unknown as AccessTokenPayload;
  }

  signRefreshToken(payload: RefreshTokenPayload): string {
    return jwt.sign(payload, this.env.JWT_REFRESH_SECRET, {
      expiresIn: this.env.REFRESH_TOKEN_TTL,
    } as jwt.SignOptions);
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return jwt.verify(token, this.env.JWT_REFRESH_SECRET) as unknown as RefreshTokenPayload;
  }
}
