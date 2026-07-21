import { z } from "zod";

import { EnvValidationError } from "./env-error";

// Unset (and, equivalently, explicitly "") is a deliberate same-origin
// sentinel (ARCHITECTURE.md §26 / GitHub issue #6 Render deployment):
// apps/web/lib/auth/api-client.ts and lib/realtime/socket-client.ts fall
// back to relative HTTP requests and a same-host WebSocket when this is
// absent from the environment, so a combined production image that never
// sets it (Dockerfile.render passes no build arg) must not fail to start.
const originOrSameOrigin = (message: string) =>
  z.union([z.literal(""), z.string().url(message)]).default("");

export const webEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  NEXT_PUBLIC_API_ORIGIN: originOrSameOrigin("NEXT_PUBLIC_API_ORIGIN must be a valid URL or empty"),
  NEXT_PUBLIC_WS_ORIGIN: originOrSameOrigin("NEXT_PUBLIC_WS_ORIGIN must be a valid URL or empty"),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function parseWebEnv(source: NodeJS.ProcessEnv = process.env): WebEnv {
  const result = webEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError("web", result.error);
  }
  return result.data;
}
