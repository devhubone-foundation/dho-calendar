import { z } from "zod";

export const errorCodes = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export const errorCodeSchema = z.enum(errorCodes);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  fieldErrors: z.record(z.array(z.string())).optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
