import { HttpStatus, type PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

import { AppError } from "../errors/app-error";

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors as Record<string, string[]>;
      throw new AppError(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Validation failed", fieldErrors);
    }
    return result.data;
  }
}
