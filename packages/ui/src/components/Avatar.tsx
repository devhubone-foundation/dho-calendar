import { useState } from "react";

import { avatarColorFromSeed, getInitials, shouldShowFallbackAvatar } from "../lib/avatar";
import { cn } from "../lib/cn";

export interface AvatarProps {
  name: string;
  /** Fully-resolved image URL, or null/undefined when there is none. */
  src?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ name, src, size = 40, className }: AvatarProps) {
  const [loadError, setLoadError] = useState(false);

  const showFallback = shouldShowFallbackAvatar(src, loadError);
  const style = { width: size, height: size, fontSize: size * 0.4 };

  if (showFallback) {
    return (
      <div
        className={cn("dho-avatar", className)}
        style={{ ...style, background: avatarColorFromSeed(name || "member") }}
        role="img"
        aria-label={name}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={src ?? undefined}
      alt={name}
      className={cn("dho-avatar", className)}
      style={style}
      onError={() => setLoadError(true)}
    />
  );
}
