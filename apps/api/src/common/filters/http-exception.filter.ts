import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import type { ErrorResponse } from "@dho/contracts";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(this.normalize(exception.getResponse(), status));
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    const payload: ErrorResponse = {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
  }

  private normalize(body: unknown, status: number): ErrorResponse {
    if (typeof body === "object" && body !== null && "code" in body && "message" in body) {
      return body as ErrorResponse;
    }

    return {
      code: this.codeForStatus(status),
      message: typeof body === "string" ? body : this.extractMessage(body),
    };
  }

  private extractMessage(body: unknown): string {
    if (typeof body === "object" && body !== null && "message" in body) {
      const raw = (body as { message: unknown }).message;
      if (typeof raw === "string") return raw;
      if (Array.isArray(raw)) return raw.join(", ");
    }
    return "Request failed";
  }

  private codeForStatus(status: number): ErrorResponse["code"] {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return "UNAUTHORIZED";
      case HttpStatus.FORBIDDEN:
        return "FORBIDDEN";
      case HttpStatus.NOT_FOUND:
        return "NOT_FOUND";
      case HttpStatus.CONFLICT:
        return "CONFLICT";
      case HttpStatus.TOO_MANY_REQUESTS:
        return "RATE_LIMITED";
      case HttpStatus.BAD_REQUEST:
        return "VALIDATION_ERROR";
      default:
        return "INTERNAL_ERROR";
    }
  }
}
