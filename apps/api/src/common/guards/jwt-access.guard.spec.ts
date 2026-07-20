import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { AuthenticatedUser } from "@dho/contracts";

import type { AuthService } from "../../auth/auth.service";
import type { TokenService } from "../../auth/token.service";
import { JwtAccessGuard } from "./jwt-access.guard";

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

const activeUser: AuthenticatedUser = {
  id: "user-1",
  email: "member@devhubone.local",
  role: "MEMBER",
  isActive: true,
  mustChangePassword: false,
};

describe("JwtAccessGuard", () => {
  it("allows a public route without inspecting the request", async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    const tokenService = { verifyAccessToken: jest.fn() } as unknown as TokenService;
    const authService = { loadActiveUserOrThrow: jest.fn() } as unknown as AuthService;
    const guard = new JwtAccessGuard(reflector, tokenService, authService);

    await expect(guard.canActivate(buildContext({ headers: {} }))).resolves.toBe(true);
    expect(authService.loadActiveUserOrThrow).not.toHaveBeenCalled();
  });

  it("rejects a request with no Authorization header", async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const tokenService = { verifyAccessToken: jest.fn() } as unknown as TokenService;
    const authService = { loadActiveUserOrThrow: jest.fn() } as unknown as AuthService;
    const guard = new JwtAccessGuard(reflector, tokenService, authService);

    await expect(guard.canActivate(buildContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects an invalid or expired access token", async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const tokenService = {
      verifyAccessToken: jest.fn(() => {
        throw new Error("bad token");
      }),
    } as unknown as TokenService;
    const authService = { loadActiveUserOrThrow: jest.fn() } as unknown as AuthService;
    const guard = new JwtAccessGuard(reflector, tokenService, authService);

    const request = { headers: { authorization: "Bearer bad-token" } };
    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("propagates rejection when the user is no longer active", async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const tokenService = {
      verifyAccessToken: jest.fn().mockReturnValue({ sub: "user-1" }),
    } as unknown as TokenService;
    const authService = {
      loadActiveUserOrThrow: jest.fn().mockRejectedValue(new UnauthorizedException()),
    } as unknown as AuthService;
    const guard = new JwtAccessGuard(reflector, tokenService, authService);

    const request = { headers: { authorization: "Bearer good-token" } };
    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("attaches the user to the request and allows access when no password change is pending", async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const tokenService = {
      verifyAccessToken: jest.fn().mockReturnValue({ sub: "user-1" }),
    } as unknown as TokenService;
    const authService = {
      loadActiveUserOrThrow: jest.fn().mockResolvedValue(activeUser),
    } as unknown as AuthService;
    const guard = new JwtAccessGuard(reflector, tokenService, authService);

    const request: { headers: Record<string, string>; user?: AuthenticatedUser } = {
      headers: { authorization: "Bearer good-token" },
    };
    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.user).toEqual(activeUser);
  });

  it("blocks a forced-password-change user on a route without the bypass decorator", async () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => (key === "isPublic" ? false : false)),
    } as unknown as Reflector;
    const tokenService = {
      verifyAccessToken: jest.fn().mockReturnValue({ sub: "user-1" }),
    } as unknown as TokenService;
    const authService = {
      loadActiveUserOrThrow: jest
        .fn()
        .mockResolvedValue({ ...activeUser, mustChangePassword: true }),
    } as unknown as AuthService;
    const guard = new JwtAccessGuard(reflector, tokenService, authService);

    const request = { headers: { authorization: "Bearer good-token" } };
    await expect(guard.canActivate(buildContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("allows a forced-password-change user through a route with the bypass decorator", async () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === "allowWhilePasswordChangeRequired" ? true : false,
      ),
    } as unknown as Reflector;
    const tokenService = {
      verifyAccessToken: jest.fn().mockReturnValue({ sub: "user-1" }),
    } as unknown as TokenService;
    const authService = {
      loadActiveUserOrThrow: jest
        .fn()
        .mockResolvedValue({ ...activeUser, mustChangePassword: true }),
    } as unknown as AuthService;
    const guard = new JwtAccessGuard(reflector, tokenService, authService);

    const request = { headers: { authorization: "Bearer good-token" } };
    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
  });
});
