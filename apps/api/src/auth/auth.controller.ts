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
} from "@nestjs/common";
import type { Response } from "express";
import {
  type AuthenticatedUser,
  type ChangePasswordRequest,
  changePasswordRequestSchema,
  type LoginRequest,
  loginRequestSchema,
  type LoginResponse,
  type MeResponse,
  type RefreshResponse,
} from "@dho/contracts";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { AllowWhilePasswordChangeRequired } from "../common/decorators/skip-password-check.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { AuthService } from "./auth.service";

const REFRESH_COOKIE_NAME = "dho_refresh_token";
const REFRESH_COOKIE_PATH = "/api/auth";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const result = await this.authService.login(body.email, body.password, {
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip,
    });
    this.setRefreshCookie(response, result.refreshToken, result.refreshTokenExpiresAt);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponse> {
    const token = this.readRefreshCookie(request);
    const result = await this.authService.refresh(token, {
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip,
    });
    this.setRefreshCookie(response, result.refreshToken, result.refreshTokenExpiresAt);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    const token = this.readOptionalRefreshCookie(request);
    await this.authService.logout(token);
    response.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    return { success: true };
  }

  @AllowWhilePasswordChangeRequired()
  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordRequestSchema)) body: ChangePasswordRequest,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const result = await this.authService.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
      { userAgent: request.headers["user-agent"], ipAddress: request.ip },
    );
    this.setRefreshCookie(response, result.refreshToken, result.refreshTokenExpiresAt);
    return { accessToken: result.accessToken, user: result.user };
  }

  @AllowWhilePasswordChangeRequired()
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser): MeResponse {
    return user;
  }

  private setRefreshCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: REFRESH_COOKIE_PATH,
      expires: expiresAt,
    });
  }

  private readRefreshCookie(request: AuthenticatedRequest): string {
    const token = this.readOptionalRefreshCookie(request);
    if (!token) {
      throw new UnauthorizedException("Missing refresh token");
    }
    return token;
  }

  private readOptionalRefreshCookie(request: AuthenticatedRequest): string | null {
    const cookies = (request as unknown as { cookies?: Record<string, string> }).cookies;
    return cookies?.[REFRESH_COOKIE_NAME] ?? null;
  }
}
