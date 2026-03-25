// Standardized API request/response types for the Pathshala Pro ERP.

export interface PaginationMeta {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiSuccessResponse<T> {
  error: false;
  data: T;
  message?: string;
}

export interface ApiPaginatedResponse<T> {
  error: false;
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiErrorResponse {
  error: true;
  message: string;
  details: ApiErrorDetail[];
}

export interface ApiErrorDetail {
  field?: string;
  code: string;
  message: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface SearchParams extends PaginationParams {
  filters?: Record<string, string | number | boolean>;
}
