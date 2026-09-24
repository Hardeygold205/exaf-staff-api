import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { STATUS_CODES, STATUS_MESSAGES } from "../api-response.util";

/**
 * Normalizes every error response to one shape, whether it came from a built-in
 * Nest exception (ForbiddenException, NotFoundException, ...) or from
 * ZodValidationPipe's BadRequestException (which carries a { message, errors }
 * body instead of Nest's default { message, error, statusCode }).
 *
 * Frontend can now always expect:
 * { success: false, statusCode, message, errors, path, timestamp }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      // ZodValidationPipe throws BadRequestException({ message, errors }) — a plain object body.
      // Nest's own exceptions throw either a string or { message, error, statusCode }.
      let message: string;
      let errors: unknown = null;
      if (typeof body === "string") {
        message = body;
      } else {
        const asObj = body as Record<string, unknown>;
        message = Array.isArray(asObj.message)
          ? asObj.message.join(", ")
          : ((asObj.message as string) ?? exception.message);
        errors = asObj.errors ?? null;
      }

      if (status >= 500) {
        this.logger.error(
          `${request.method} ${request.url} -> ${status}: ${message}`,
        );
      }

      return response.status(status).json({
        success: false,
        statusCode: status,
        message,
        errors,
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    // Anything that isn't a recognized HttpException is a bug — log the real error,
    // but never leak internals (stack traces, DB error text) to the client.
    this.logger.error(
      `Unhandled exception on ${request.method} ${request.url}`,
      (exception as Error)?.stack,
    );
    return response.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      statusCode: STATUS_CODES.INTERNAL_SERVER_ERROR,
      message: STATUS_MESSAGES.INTERNAL_SERVER_ERROR,
      errors: null,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
