import { NextResponse } from "next/server";
import { ZodError } from "zod";
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

  static conflict(message: string = "Resource already exists", details?: ApiErrorDetail[]): ApiError {
    return new ApiError(message, 409, details);
  }

  static unprocessableEntity(message: string = "Validation failed", details?: ApiErrorDetail[]): ApiError {
    return new ApiError(message, 422, details);
  }

  static internal(message: string = "Internal server error"): ApiError {
    return new ApiError(message, 500);
  }
}

/**
 * Universal failsafe error handler for Next.js API routes.
 * Translates Prisma DB errors, Zod validation errors, syntax errors, and custom ApiErrors
 * into consistent, clean HTTP JSON responses with proper status codes.
 */
export function handleApiError(
  error: unknown,
  fallbackMessage: string = "Internal server error"
): NextResponse<ApiErrorResponse> {
  // 1. ApiError instances
  if (error instanceof ApiError) {
    return NextResponse.json(error.toJSON(), { status: error.statusCode });
  }

  // 2. Zod validation errors
  if (error instanceof ZodError) {
    const details: ApiErrorDetail[] = error.errors.map((err) => ({
      field: err.path.join(".") || undefined,
      code: err.code,
      message: err.message,
    }));

    const summary = details
      .map((err) => (err.field ? `${err.field}: ${err.message}` : err.message))
      .filter(Boolean)
      .join("; ");

    return NextResponse.json(
      {
        error: true,
        message: summary ? `Validation failed: ${summary}` : "Validation failed",
        details,
      },
      { status: 422 }
    );
  }

  // 3. JSON SyntaxError (e.g. malformed JSON in request body)
  if (error instanceof SyntaxError && error.message.includes("JSON")) {
    return NextResponse.json(
      {
        error: true,
        message: "Malformed JSON in request body",
        details: [{ code: "INVALID_JSON", message: error.message }],
      },
      { status: 400 }
    );
  }

  // 4. Prisma known request errors
  if (typeof error === "object" && error !== null && "code" in error) {
    const prismaError = error as { code: string; meta?: Record<string, unknown>; message?: string };

    switch (prismaError.code) {
      case "P2002": {
        const target = Array.isArray(prismaError.meta?.target)
          ? (prismaError.meta.target as string[]).join(", ")
          : (prismaError.meta?.target as string) || "field";

        return NextResponse.json(
          {
            error: true,
            message: `A record with this ${target} already exists`,
            details: [
              {
                field: target,
                code: "UNIQUE_CONSTRAINT",
                message: `Duplicate value violates unique constraint on: ${target}`,
              },
            ],
          },
          { status: 409 }
        );
      }

      case "P2025": {
        const cause = (prismaError.meta?.cause as string) || "The requested record was not found or has been deleted";
        return NextResponse.json(
          {
            error: true,
            message: cause,
            details: [{ code: "NOT_FOUND", message: cause }],
          },
          { status: 404 }
        );
      }

      case "P2003": {
        const fieldName = (prismaError.meta?.field_name as string) || "foreign_key";
        return NextResponse.json(
          {
            error: true,
            message: "Cannot complete operation due to existing data associations",
            details: [
              {
                field: fieldName,
                code: "FOREIGN_KEY_CONSTRAINT",
                message: "Referenced record does not exist or has dependent records attached.",
              },
            ],
          },
          { status: 400 }
        );
      }

      case "P2014": {
        return NextResponse.json(
          {
            error: true,
            message: "The required relation violation between records occurred",
            details: [{ code: "RELATION_VIOLATION", message: prismaError.message || "" }],
          },
          { status: 400 }
        );
      }

      case "P2023": {
        return NextResponse.json(
          {
            error: true,
            message: "Inconsistent column data or invalid identifier format",
            details: [{ code: "INVALID_IDENTIFIER", message: prismaError.message || "" }],
          },
          { status: 400 }
        );
      }
    }
  }

  // 5. General fallback
  console.error(`[API Error] ${fallbackMessage}:`, error);

  return NextResponse.json(
    {
      error: true,
      message: fallbackMessage,
      details: [],
    },
    { status: 500 }
  );
}
