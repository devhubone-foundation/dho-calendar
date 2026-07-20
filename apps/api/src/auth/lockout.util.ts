export interface LockoutState {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastFailedLoginAt: Date | null;
}

export interface LockoutPolicy {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
}

export function isLockedOut(state: Pick<LockoutState, "lockedUntil">, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

/**
 * Computes the next lockout state after a failed login attempt. Attempts
 * outside the configured rolling window reset the counter to 1 instead of
 * accumulating forever.
 */
export function recordFailedAttempt(
  state: LockoutState,
  policy: LockoutPolicy,
  now: Date,
): LockoutState {
  const withinWindow =
    state.lastFailedLoginAt !== null &&
    now.getTime() - state.lastFailedLoginAt.getTime() <= policy.windowMs;

  const attempts = withinWindow ? state.failedLoginAttempts + 1 : 1;

  if (attempts >= policy.maxAttempts) {
    return {
      failedLoginAttempts: attempts,
      lastFailedLoginAt: now,
      lockedUntil: new Date(now.getTime() + policy.lockoutMs),
    };
  }

  return {
    failedLoginAttempts: attempts,
    lastFailedLoginAt: now,
    lockedUntil: null,
  };
}

export function resetLockout(): LockoutState {
  return { failedLoginAttempts: 0, lastFailedLoginAt: null, lockedUntil: null };
}
