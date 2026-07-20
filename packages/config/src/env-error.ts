import type { ZodError } from "zod";

export class EnvValidationError extends Error {
  readonly fieldErrors: Record<string, string[] | undefined>;

  constructor(scope: string, error: ZodError) {
    const fieldErrors = error.flatten().fieldErrors;
    const summary = Object.entries(fieldErrors)
      .map(([key, messages]) => `  - ${key}: ${(messages ?? []).join(", ")}`)
      .join("\n");
    super(`Invalid ${scope} environment configuration:\n${summary}`);
    this.name = "EnvValidationError";
    this.fieldErrors = fieldErrors;
  }
}
