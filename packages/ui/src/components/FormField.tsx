import { type InputHTMLAttributes, forwardRef, useId } from "react";

import { cn } from "../lib/cn";

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, error, hint, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className="dho-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        ref={ref}
        id={inputId}
        className={cn("dho-input", className)}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={cn(errorId, hintId) || undefined}
        {...props}
      />
      {hint && !error && (
        <span id={hintId} className="dho-field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="dho-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
});
