import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

export type BadgeVariant = "default" | "success" | "muted" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "dho-badge",
        variant === "success" && "dho-badge--success",
        variant === "muted" && "dho-badge--muted",
        variant === "danger" && "dho-badge--danger",
        className,
      )}
      {...props}
    />
  );
}
