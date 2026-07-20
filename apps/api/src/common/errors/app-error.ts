import { HttpException } from "@nestjs/common";
import type { ErrorCode } from "@dho/contracts";

export class AppError extends HttpException {
  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super({ code, message, fieldErrors }, status);
  }
}
