import { NextResponse } from "next/server";
import type { ApiSuccessResponse, ApiPaginatedResponse, ApiErrorResponse } from "@/types/api";

type SuccessResponse<T> = ApiSuccessResponse<T>;
type PaginatedResponse<T> = ApiPaginatedResponse<T>;
type ErrorResponse = ApiErrorResponse;

export function successResponse<T>(
  data: T,
  message?: string,
  status = 200
): NextResponse<SuccessResponse<T>> {
  return NextResponse.json(
    {
      error: false,
      data,
      ...(message && { message }),
    },
    { status }
  );
}

export function paginatedResponse<T>(
  data: T[],
  pagination: {
    totalCount: number;
    currentPage: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  },
  status = 200
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json(
    {
      error: false,
      data,
      pagination,
    },
    { status }
  );
}

export function errorResponse(
  message: string,
  status = 500,
  details?: Array<{ field?: string; code: string; message: string }>
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: true,
      message,
      details: details || [],
    },
    { status }
  );
}

export function badRequest(
  message: string,
  details?: Array<{ field?: string; code: string; message: string }>
): NextResponse<ErrorResponse> {
  return errorResponse(message, 400, details);
}

export function unauthorized(message = "Unauthorized"): NextResponse<ErrorResponse> {
  return errorResponse(message, 401);
}

export function forbidden(message = "Forbidden"): NextResponse<ErrorResponse> {
  return errorResponse(message, 403);
}

export function notFound(message = "Resource not found"): NextResponse<ErrorResponse> {
  return errorResponse(message, 404);
}

export function conflict(message = "Resource already exists"): NextResponse<ErrorResponse> {
  return errorResponse(message, 409);
}

export function validationError(
  errors: Array<{ field?: string; code: string; message: string }>
): NextResponse<ErrorResponse> {
  return errorResponse("Validation failed", 422, errors);
}
