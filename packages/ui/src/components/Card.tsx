import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean;
}

export function Card({ accent = false, className, ...props }: CardProps) {
  return <div className={cn("dho-card", accent && "dho-card--accent", className)} {...props} />;
}
