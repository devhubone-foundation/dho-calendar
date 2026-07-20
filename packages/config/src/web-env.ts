import { z } from "zod";

import { EnvValidationError } from "./env-error";

export const webEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  NEXT_PUBLIC_API_ORIGIN: z.string().url("NEXT_PUBLIC_API_ORIGIN must be a valid URL"),
  NEXT_PUBLIC_WS_ORIGIN: z.string().url("NEXT_PUBLIC_WS_ORIGIN must be a valid URL"),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function parseWebEnv(source: NodeJS.ProcessEnv = process.env): WebEnv {
  const result = webEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError("web", result.error);
  }
  return result.data;
}
