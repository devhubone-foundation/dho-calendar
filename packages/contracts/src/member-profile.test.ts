import { describe, expect, it } from "vitest";

import {
  adminCreateMemberRequestSchema,
  selfProfileUpdateRequestSchema,
} from "./member-profile";

describe("selfProfileUpdateRequestSchema", () => {
  const valid = {
    fullName: "Ada Lovelace",
    email: "ada@devhubone.local",
    qualificationBg: "Програмист",
    qualificationEn: "Programmer",
  };

  it("accepts a well-formed profile update", () => {
    expect(() => selfProfileUpdateRequestSchema.parse(valid)).not.toThrow();
  });

  it("rejects an empty full name", () => {
    expect(() => selfProfileUpdateRequestSchema.parse({ ...valid, fullName: "  " })).toThrow();
  });

  it("rejects an invalid email", () => {
    expect(() => selfProfileUpdateRequestSchema.parse({ ...valid, email: "not-an-email" })).toThrow();
  });

  it("requires both bg and en qualification", () => {
    expect(() => selfProfileUpdateRequestSchema.parse({ ...valid, qualificationBg: "" })).toThrow();
    expect(() => selfProfileUpdateRequestSchema.parse({ ...valid, qualificationEn: "" })).toThrow();
  });
});

describe("adminCreateMemberRequestSchema", () => {
  const valid = {
    email: "new-member@devhubone.local",
    fullName: "New Member",
    qualificationBg: "3D Художник",
    qualificationEn: "3D Artist",
    role: "MEMBER",
    temporaryPassword: "a-temporary-password",
  };

  it("accepts a well-formed request", () => {
    expect(() => adminCreateMemberRequestSchema.parse(valid)).not.toThrow();
  });

  it("rejects a temporary password shorter than 10 characters", () => {
    expect(() =>
      adminCreateMemberRequestSchema.parse({ ...valid, temporaryPassword: "short" }),
    ).toThrow();
  });

  it("rejects an unknown role", () => {
    expect(() => adminCreateMemberRequestSchema.parse({ ...valid, role: "SUPERUSER" })).toThrow();
  });
});
