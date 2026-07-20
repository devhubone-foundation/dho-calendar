import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { AuthenticatedUser } from "@dho/contracts";

import { RolesGuard } from "./roles.guard";

function buildContext(user: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

const member: AuthenticatedUser = {
  id: "user-1",
  email: "member@devhubone.local",
  role: "MEMBER",
  isActive: true,
  mustChangePassword: false,
};

const admin: AuthenticatedUser = { ...member, id: "user-2", role: "ADMIN" };

describe("RolesGuard", () => {
  it("allows access when the route declares no required roles", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext(member))).toBe(true);
  });

  it("allows access when the user's role is in the required list", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["ADMIN"]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext(admin))).toBe(true);
  });

  it("rejects a MEMBER hitting an ADMIN-only route with ForbiddenException", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["ADMIN"]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext(member))).toThrow(ForbiddenException);
  });
});
