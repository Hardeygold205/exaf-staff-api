export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const STATUS_MESSAGES = {
  OK: "Request successful",
  CREATED: "Resource created successfully",
  ACCEPTED: "Request accepted",
  NO_CONTENT: "No content",
  BAD_REQUEST: "Bad request",
  UNAUTHORIZED: "Unauthorized access",
  FORBIDDEN: "Forbidden",
  NOT_FOUND: "Resource not found",
  CONFLICT: "Resource already exists or conflicts with existing data",
  UNPROCESSABLE_ENTITY: "Validation failed",
  INTERNAL_SERVER_ERROR: "Internal server error",
} as const;

export type StatusCodeValue = (typeof STATUS_CODES)[keyof typeof STATUS_CODES];

export interface SuccessResponseBody<T = unknown> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
}

export interface ErrorResponseBody<T = unknown> {
  success: false;
  statusCode: number;
  message: string;
  errors: T;
}

/**
 * Builds a standardized success response.
 * Can be called with (res, statusCode, message, data) or (statusCode, message, data).
 */
export function successResponse<T = unknown>(
  statusCode: number,
  message: string,
  data?: T,
): SuccessResponseBody<T>;
export function successResponse<T = unknown>(
  res: any,
  statusCode: number,
  message: string,
  data?: T,
): any;
export function successResponse<T = unknown>(
  first: any,
  second: any,
  third?: any,
  fourth: any = null,
): any {
  if (first && typeof first.status === "function") {
    const res = first;
    const statusCode = second as number;
    const message = third as string;
    const data = fourth as T;
    return res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data: data ?? null,
    });
  }

  const statusCode = first as number;
  const message = second as string;
  const data = (third !== undefined ? third : null) as T;
  return {
    success: true,
    statusCode,
    message,
    data,
  };
}

/**
 * Builds a standardized error response.
 * Can be called with (res, statusCode, message, errors) or (statusCode, message, errors).
 */
export function errorResponse<T = unknown>(
  statusCode: number,
  message: string,
  errors?: T,
): ErrorResponseBody<T>;
export function errorResponse<T = unknown>(
  res: any,
  statusCode: number,
  message: string,
  errors?: T,
): any;
export function errorResponse<T = unknown>(
  first: any,
  second: any,
  third?: any,
  fourth: any = null,
): any {
  if (first && typeof first.status === "function") {
    const res = first;
    const statusCode = second as number;
    const message = third as string;
    const errors = fourth as T;
    return res.status(statusCode).json({
      success: false,
      statusCode,
      message,
      errors: errors ?? null,
    });
  }

  const statusCode = first as number;
  const message = second as string;
  const errors = (third !== undefined ? third : null) as T;
  return {
    success: false,
    statusCode,
    message,
    errors,
  };
}
