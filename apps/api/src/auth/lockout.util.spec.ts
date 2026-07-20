import { isLockedOut, type LockoutState, recordFailedAttempt, resetLockout } from "./lockout.util";

const policy = { maxAttempts: 5, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000 };
const now = new Date("2026-01-01T12:00:00.000Z");

describe("isLockedOut", () => {
  it("is false when lockedUntil is null", () => {
    expect(isLockedOut({ lockedUntil: null }, now)).toBe(false);
  });

  it("is true when lockedUntil is in the future", () => {
    expect(isLockedOut({ lockedUntil: new Date(now.getTime() + 1000) }, now)).toBe(true);
  });

  it("is false when lockedUntil is in the past", () => {
    expect(isLockedOut({ lockedUntil: new Date(now.getTime() - 1000) }, now)).toBe(false);
  });
});

describe("recordFailedAttempt", () => {
  it("counts up to the threshold without locking", () => {
    let state: LockoutState = { failedLoginAttempts: 0, lockedUntil: null, lastFailedLoginAt: null };
    for (let i = 1; i < policy.maxAttempts; i += 1) {
      state = recordFailedAttempt(state, policy, now);
      expect(state.failedLoginAttempts).toBe(i);
      expect(state.lockedUntil).toBeNull();
    }
  });

  it("locks out once attempts reach maxAttempts within the window", () => {
    let state: LockoutState = { failedLoginAttempts: 0, lockedUntil: null, lastFailedLoginAt: null };
    for (let i = 0; i < policy.maxAttempts; i += 1) {
      state = recordFailedAttempt(state, policy, now);
    }
    expect(state.failedLoginAttempts).toBe(policy.maxAttempts);
    expect(state.lockedUntil).toEqual(new Date(now.getTime() + policy.lockoutMs));
  });

  it("resets the counter to 1 when the previous failure was outside the window", () => {
    const longAgo = new Date(now.getTime() - policy.windowMs - 1);
    const state = recordFailedAttempt(
      { failedLoginAttempts: 4, lockedUntil: null, lastFailedLoginAt: longAgo },
      policy,
      now,
    );
    expect(state.failedLoginAttempts).toBe(1);
    expect(state.lockedUntil).toBeNull();
  });

  it("keeps accumulating when the previous failure was inside the window", () => {
    const recently = new Date(now.getTime() - 1000);
    const state = recordFailedAttempt(
      { failedLoginAttempts: 3, lockedUntil: null, lastFailedLoginAt: recently },
      policy,
      now,
    );
    expect(state.failedLoginAttempts).toBe(4);
  });
});

describe("resetLockout", () => {
  it("clears all lockout fields", () => {
    expect(resetLockout()).toEqual({
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
    });
  });
});
