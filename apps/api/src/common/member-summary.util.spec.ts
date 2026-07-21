import { Prisma } from "@dho/database";

import { AppError } from "./errors/app-error";
import { throwIfUniqueEmailViolation } from "./member-summary.util";

describe("throwIfUniqueEmailViolation", () => {
  it("throws a 409 CONFLICT AppError for a unique-constraint (P2002) violation", () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });

    expect(() => throwIfUniqueEmailViolation(prismaError)).toThrow(AppError);
  });

  it("does not throw for an unrelated Prisma error code", () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "test",
    });

    expect(() => throwIfUniqueEmailViolation(prismaError)).not.toThrow();
  });

  it("does not throw for a non-Prisma error", () => {
    expect(() => throwIfUniqueEmailViolation(new Error("boom"))).not.toThrow();
  });
});
