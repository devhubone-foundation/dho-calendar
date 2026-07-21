const AVATAR_PALETTE = [
  "var(--dho-avatar-palette-1)",
  "var(--dho-avatar-palette-2)",
  "var(--dho-avatar-palette-3)",
  "var(--dho-avatar-palette-4)",
] as const;

/** Up to two initials from a full name, e.g. "Ada Lovelace" -> "AL". */
export function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Deterministic palette color for a given seed (e.g. user id), so the same
 * member always gets the same fallback-avatar background. */
export function avatarColorFromSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index] as string;
}

/** A missing path, or an image that failed to load client-side, both mean
 * "show the fallback avatar" — this is the single source of truth for that
 * decision so Avatar and any future consumer agree on it. */
export function shouldShowFallbackAvatar(imagePath: string | null | undefined, hasLoadError: boolean): boolean {
  return !imagePath || imagePath.trim().length === 0 || hasLoadError;
}
