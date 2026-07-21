"use client";

import { cn } from "@dho/ui";
import { useState } from "react";

import { resolveUploadUrl } from "../../lib/auth/api-client";

export interface EventCoverImageProps {
  coverImagePath: string | null;
  alt: string;
  className?: string;
}

/** Renders an event's cover image, or a visually acceptable fallback when
 * there is none — and falls back the same way if the image fails to load,
 * so a broken file can never break the surrounding layout. */
export function EventCoverImage({ coverImagePath, alt, className }: EventCoverImageProps) {
  const [loadError, setLoadError] = useState(false);
  const showFallback = !coverImagePath || loadError;

  if (showFallback) {
    return (
      <div className={cn("dho-cal-cover-fallback", className)} role="img" aria-label={alt}>
        <span aria-hidden="true">🗓️</span>
      </div>
    );
  }

  return (
    <img
      src={resolveUploadUrl(coverImagePath)}
      alt={alt}
      className={cn("dho-cal-cover", className)}
      onError={() => setLoadError(true)}
    />
  );
}
