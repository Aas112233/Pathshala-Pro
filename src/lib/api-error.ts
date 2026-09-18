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
      .map((err) => (err.field ? `${err.field}: ${err.message}${err.code ? ` (${err.code})` : ""}` : err.message))
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
      case "P1000":
      case "P1001":
      case "P1002":
      case "P1008":
      case "P1017":
      case "P2024": {
        // Connection / pool failures (unreachable host, bad credentials,
        // engine timeout, timed-out pooled connection). Always transient or
        // infra-level: report 503 with Retry-After so clients back off
        // instead of surfacing a masked 500. Never echo driver internals.
        return NextResponse.json(
          {
            error: true,
            message: "Database temporarily unavailable. Please retry in a few seconds.",
            details: [
              {
                code: "DB_UNAVAILABLE",
                message: `Database connection failed (${prismaError.code})`,
              },
            ],
          },
          { status: 503, headers: { "Retry-After": "5" } }
        );
      }

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

      // Raw SQL rejected by the database (e.g. an un-cast enum parameter,
      // SQLSTATE 42883). The underlying Postgres message is the only useful
      // thing for whoever has to fix it, so never replace it with a generic one.
      case "P2010": {
        const sqlState = (prismaError.meta?.code as string) || undefined;
        const dbMessage = (prismaError.meta?.message as string) || prismaError.message || "Raw query failed";
        return NextResponse.json(
          {
            error: true,
            message: `Database rejected the query${sqlState ? ` (SQLSTATE ${sqlState})` : ""}: ${dbMessage}`,
            details: [{ code: sqlState ? `SQLSTATE_${sqlState}` : "RAW_QUERY_FAILED", message: dbMessage }],
          },
          { status: 500 }
        );
      }

      // Interactive transaction exceeded its timeout / maxWait, or was rolled
      // back by the engine. Bulk operations must shrink their batch size.
      case "P2028": {
        const cause = prismaError.message || "The database transaction could not be completed";
        return NextResponse.json(
          {
            error: true,
            message: `Database transaction failed: ${cause}`,
            details: [{ code: "TRANSACTION_FAILED", message: cause }],
          },
          { status: 500 }
        );
      }
    }
  }

  // 4b. Prisma engine errors that carry NO `code` on the client-side object.
  // Raw-query failures arrive as `PrismaClientUnknownRequestError` (the SQLSTATE
  // is only inside the message) and malformed query shapes as
  // `PrismaClientValidationError`. Without this branch both collapse into the
  // generic "Internal server error" fallback, making a production incident
  // impossible to diagnose from the UI or the network tab.
  const engineErrorName =
    typeof error === "object" && error !== null ? (error as { name?: string }).name : undefined;

  // Engine failed before a request error code existed (connect refused at
  // startup, pool exhausted, Rust panic). Same 503 contract as P1001/P2024.
  if (
    engineErrorName === "PrismaClientInitializationError" ||
    engineErrorName === "PrismaClientRustPanicError"
  ) {
    console.error(`[API Error] Prisma engine unavailable (${engineErrorName})`);
    return NextResponse.json(
      {
        error: true,
        message: "Database temporarily unavailable. Please retry in a few seconds.",
        details: [{ code: "DB_UNAVAILABLE", message: engineErrorName }],
      },
      { status: 503, headers: { "Retry-After": "5" } }
    );
  }

  if (engineErrorName === "PrismaClientUnknownRequestError" || engineErrorName === "PrismaClientValidationError") {
    const text = error instanceof Error ? error.message : String(error);
    const sqlState = text.match(/code:\s*"([0-9A-Z]{5})"/)?.[1];
    const dbMessage = text.match(/message:\s*"([^"]+)"/)?.[1];
    const firstLine = text.split("\n").map((line) => line.trim()).filter(Boolean)[0];
    const summary = [sqlState ? `SQLSTATE ${sqlState}` : null, dbMessage || firstLine].filter(Boolean).join(" - ");

    console.error(`[API Error] Prisma engine error${sqlState ? ` (${sqlState})` : ""}:`, text.slice(0, 1000));

    return NextResponse.json(
      {
        error: true,
        message: `Database operation failed: ${(summary || "unknown engine error").slice(0, 500)}`,
        details: [
          {
            code: sqlState ? `SQLSTATE_${sqlState}` : "DB_ENGINE_ERROR",
            message: (dbMessage || firstLine || "No further detail").slice(0, 500),
          },
        ],
      },
      { status: 500 }
    );
  }

  // 5. General fallback. Unclassified errors are deliberately masked: they may
  // carry internal detail (stack frames, driver internals) that must not reach
  // the client. Services that raise *actionable* domain errors (missing chart
  // of accounts, unbalanced journal, ...) must throw `ApiError` explicitly so
  // branch 1 above surfaces their message instead of landing here.
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
