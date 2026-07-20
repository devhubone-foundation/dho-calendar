const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Parses durations shaped like "15m", "1h", "30d" (the same format used for
 * jsonwebtoken's `expiresIn`) into a millisecond count.
 */
export function msFromDuration(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value);
  if (!match) {
    throw new Error(`Invalid duration string: ${value}`);
  }
  const amount = match[1];
  const unit = match[2];
  const multiplier = unit ? UNIT_MS[unit] : undefined;
  if (!amount || multiplier === undefined) {
    throw new Error(`Invalid duration string: ${value}`);
  }
  return Number(amount) * multiplier;
}
