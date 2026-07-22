import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

export type BadgeVariant = "default" | "success" | "muted" | "danger" | "not-sure" | "event" | "warning";

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
        variant === "not-sure" && "dho-badge--not-sure",
        variant === "event" && "dho-badge--event",
        variant === "warning" && "dho-badge--warning",
        className,
      )}
      {...props}
    />
  );
}
