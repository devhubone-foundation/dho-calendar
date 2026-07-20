import { HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { ApiEnv } from "@dho/config";
import type { AuthenticatedUser } from "@dho/contracts";

import { AppError } from "../common/errors/app-error";
import { APP_ENV } from "../config/config.tokens";
import { PrismaService } from "../prisma/prisma.service";
import { msFromDuration } from "./duration.util";
import { isLockedOut, recordFailedAttempt, resetLockout } from "./lockout.util";
import { hashPassword, verifyPassword } from "./password.util";
import { TokenService } from "./token.service";

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

interface SessionResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: AuthenticatedUser;
}

interface UserRecord {
  id: string;
  email: string;
  role: AuthenticatedUser["role"];
  isActive: boolean;
  mustChangePassword: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    @Inject(APP_ENV) private readonly env: ApiEnv,
  ) {}

  async login(email: string, password: string, meta: RequestMeta): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new AppError(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid email or password");
    }

    const now = new Date();

    if (isLockedOut({ lockedUntil: user.lockedUntil }, now)) {
      throw new AppError(
        HttpStatus.TOO_MANY_REQUESTS,
        "RATE_LIMITED",
        "Too many failed login attempts. Try again later.",
      );
    }

    if (!user.isActive) {
      throw new AppError(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid email or password");
    }

    const passwordValid = await verifyPassword(user.passwordHash, password);

    if (!passwordValid) {
      const nextState = recordFailedAttempt(
        {
          failedLoginAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil,
          lastFailedLoginAt: user.lastFailedLoginAt,
        },
        {
          maxAttempts: this.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
          windowMs: this.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60_000,
          lockoutMs: this.env.LOGIN_RATE_LIMIT_LOCKOUT_MINUTES * 60_000,
        },
        now,
      );

      await this.prisma.user.update({ where: { id: user.id }, data: nextState });

      if (nextState.lockedUntil) {
        throw new AppError(
          HttpStatus.TOO_MANY_REQUESTS,
          "RATE_LIMITED",
          "Too many failed login attempts. Account temporarily locked.",
        );
      }
      throw new AppError(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid email or password");
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({ where: { id: user.id }, data: resetLockout() });
    }

    return this.issueSession(user, meta);
  }

  async refresh(rawToken: string, meta: RequestMeta): Promise<SessionResult> {
    const payload = this.verifyRefreshTokenOrThrow(rawToken);

    const existing = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!existing || existing.userId !== payload.sub) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (existing.revokedAt) {
      // Reuse of an already-rotated token: treat as possible theft and
      // revoke every active session for this user as a defensive measure.
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Refresh token already used");
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    const user = await this.loadActiveUserOrThrow(existing.userId);

    return this.issueSession(user, meta, existing.id);
  }

  async logout(rawToken: string | null): Promise<void> {
    if (!rawToken) {
      return;
    }
    try {
      const payload = this.tokenService.verifyRefreshToken(rawToken);
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Already invalid/expired: nothing to revoke, logout still succeeds.
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta,
  ): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException("Account not found");
    }

    const valid = await verifyPassword(user.passwordHash, currentPassword);
    if (!valid) {
      throw new AppError(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Current password is incorrect");
    }

    const passwordHash = await hashPassword(newPassword);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    // Revoke every existing session; the client re-establishes trust with the
    // new password rather than keeping tokens issued under the old one alive.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(updated, meta);
  }

  /** Shared by the access-token guard and the refresh flow: always re-reads
   * isActive/role/mustChangePassword from the database so deactivation and
   * password-change state take effect immediately, not at token expiry. */
  async loadActiveUserOrThrow(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Account is not active");
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private verifyRefreshTokenOrThrow(rawToken: string) {
    try {
      return this.tokenService.verifyRefreshToken(rawToken);
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  private async issueSession(
    user: UserRecord,
    meta: RequestMeta,
    replacesTokenId?: string,
  ): Promise<SessionResult> {
    const expiresAt = new Date(Date.now() + msFromDuration(this.env.REFRESH_TOKEN_TTL));

    const refreshTokenRow = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    if (replacesTokenId) {
      await this.prisma.refreshToken.update({
        where: { id: replacesTokenId },
        data: { revokedAt: new Date(), replacedById: refreshTokenRow.id },
      });
    }

    const accessToken = this.tokenService.signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = this.tokenService.signRefreshToken({
      sub: user.id,
      jti: refreshTokenRow.id,
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }
}
