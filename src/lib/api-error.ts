import type { ApiErrorDetail, ApiErrorResponse } from "@/types/api";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details: ApiErrorDetail[];

  constructor(
    message: string,
    statusCode: number = 500,
    details: ApiErrorDetail[] = []
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON(): ApiErrorResponse {
    return {
      error: true,
      message: this.message,
      details: this.details,
    };
  }

  static badRequest(message: string, details?: ApiErrorDetail[]): ApiError {
    return new ApiError(message, 400, details);
  }

  static unauthorized(message: string = "Unauthorized"): ApiError {
    return new ApiError(message, 401);
  }

  static forbidden(message: string = "Forbidden"): ApiError {
    return new ApiError(message, 403);
  }

  static notFound(message: string = "Resource not found"): ApiError {
    return new ApiError(message, 404);
  }

  static internal(message: string = "Internal server error"): ApiError {
    return new ApiError(message, 500);
  }
}
