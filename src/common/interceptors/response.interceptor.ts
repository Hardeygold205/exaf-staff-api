import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, map } from "rxjs";
import { Response } from "express";
import { RESPONSE_MESSAGE_KEY } from "../decorators/response-message.decorator";
import { STATUS_MESSAGES, successResponse } from "../api-response.util";

/**
 * Global interceptor that wraps every successful response in the standard
 * `{ success, statusCode, message, data }` envelope.
 *
 * - Reads the HTTP status code from the actual response.
 * - Reads a custom message from `@ResponseMessage()` metadata, or falls back
 *   to a sensible default from `STATUS_MESSAGES`.
 * - If data is a bare array, it is wrapped in `data: [...]`.
 * - If data was legacy `{ ok: true }`, it cleans it up so data is `null`.
 * - Skips wrapping when the controller already sent a response via `@Res()`
 *   (e.g. the uploads download endpoint) or if already wrapped.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse<Response>();

        // If the controller already sent the response (e.g. res.download / res.redirect),
        // `headersSent` is true and we must not touch the body.
        if (response.headersSent) return data;

        // If response is already formatted as a standard API response envelope
        if (
          data &&
          typeof data === "object" &&
          "success" in data &&
          "statusCode" in data &&
          "message" in data
        ) {
          return data;
        }

        const statusCode = response.statusCode;

        const customMessage = this.reflector.get<string>(
          RESPONSE_MESSAGE_KEY,
          context.getHandler(),
        );

        let message = customMessage ?? this.defaultMessage(statusCode);
        let finalData = data;

        // Clean up legacy `{ ok: true }` or `{ ok: true, message: ... }` returns
        if (data && typeof data === "object" && !Array.isArray(data)) {
          const keys = Object.keys(data);
          if (keys.length === 1 && (data as Record<string, unknown>).ok === true) {
            finalData = null;
          } else if (
            keys.length === 2 &&
            (data as Record<string, unknown>).ok === true &&
            typeof (data as Record<string, unknown>).message === "string"
          ) {
            if (!customMessage) {
              message = (data as Record<string, unknown>).message as string;
            }
            finalData = null;
          }
        }

        return successResponse(statusCode, message, finalData);
      }),
    );
  }

  private defaultMessage(statusCode: number): string {
    switch (statusCode) {
      case 201:
        return STATUS_MESSAGES.CREATED;
      case 202:
        return STATUS_MESSAGES.ACCEPTED;
      case 204:
        return STATUS_MESSAGES.NO_CONTENT;
      default:
        return STATUS_MESSAGES.OK;
    }
  }
}
