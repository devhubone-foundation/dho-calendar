import { z } from "zod";

import { EnvValidationError } from "./env-error";

const durationPattern = /^\d+(ms|s|m|h|d)$/;

export const apiEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required")
      .refine(
        (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "DATABASE_URL must be a PostgreSQL connection string",
      ),
    JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
    JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
    ACCESS_TOKEN_TTL: z
      .string()
      .regex(durationPattern, "ACCESS_TOKEN_TTL must look like 15m, 1h, or 30d")
      .default("15m"),
    REFRESH_TOKEN_TTL: z
      .string()
      .regex(durationPattern, "REFRESH_TOKEN_TTL must look like 15m, 1h, or 30d")
      .default("30d"),
    APP_ORIGIN: z.string().url("APP_ORIGIN must be a valid URL"),
    API_ORIGIN: z.string().url("API_ORIGIN must be a valid URL"),
    UPLOAD_ROOT: z.string().min(1).default("./data/uploads"),
    OFFICE_TIMEZONE: z.string().min(1).default("Europe/Sofia"),
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    LOGIN_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
    LOGIN_RATE_LIMIT_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    message: "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values",
    path: ["JWT_REFRESH_SECRET"],
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function parseApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = apiEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError("API", result.error);
  }
  return result.data;
}
