import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "accent";
export type ButtonSize = "default" | "small";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "default", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "dho-button",
        variant === "secondary" && "dho-button--secondary",
        variant === "danger" && "dho-button--danger",
        variant === "accent" && "dho-button--accent",
        size === "small" && "dho-button--small",
        className,
      )}
      {...props}
    />
  );
});
