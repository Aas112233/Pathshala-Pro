import type {
  ApiSuccessResponse,
  ApiPaginatedResponse,
  ApiErrorResponse,
  PaginationParams,
} from "@/types/api";
import type {
  CreateUserPayload,
  UpdateUserPayload,
  UserRecord,
} from "@/types/users";

const API_BASE_URL = "";

interface FetchOptions extends RequestInit {
  data?: any;
}

export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  setAuth(_token: string, _tenantId: string) {}

  clearAuth() {}

  private async request<T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const { data, headers: customHeaders, ...restOptions } = options;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(customHeaders as Record<string, string> || {}),
    };

    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...restOptions,
      credentials: "include",
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    const result = await response.json();

    if (!response.ok) {
      // Auto logout on 401, but not if they are just trying to log in
      if (response.status === 401 && typeof window !== 'undefined' && !url.includes('/api/auth/login')) {
        window.location.href = '/login';
      }

      const error = result as ApiErrorResponse;
      throw new ApiError(error.message, response.status, error.details);
    }

    return result as T;
  }

  // GET request
  async get<T>(endpoint: string, params?: PaginationParams): Promise<ApiSuccessResponse<T> | ApiPaginatedResponse<T>> {
    const queryString = params ? this.buildQueryString(params) : "";
    const separator = queryString ? "?" : "";
    return this.request<ApiSuccessResponse<T> | ApiPaginatedResponse<T>>(`${endpoint}${separator}${queryString}`);
  }

  // POST request
  async post<T>(endpoint: string, data?: any): Promise<ApiSuccessResponse<T>> {
    return this.request<ApiSuccessResponse<T>>(endpoint, { method: "POST", data });
  }

  // PUT request
  async put<T>(endpoint: string, data?: any): Promise<ApiSuccessResponse<T>> {
    return this.request<ApiSuccessResponse<T>>(endpoint, { method: "PUT", data });
  }

  // DELETE request
  async delete<T>(endpoint: string): Promise<ApiSuccessResponse<T>> {
    return this.request<ApiSuccessResponse<T>>(endpoint, { method: "DELETE" });
  }

  private buildQueryString(params: PaginationParams): string {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.search) searchParams.set("search", params.search);
    if (params.sortBy) searchParams.set("sortBy", params.sortBy);
    if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);

    // Handle filters object
    if ((params as any).filters && typeof (params as any).filters === 'object') {
      Object.entries((params as any).filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });
    }

    // Handle gender filter specifically
    if ((params as any).gender) {
      searchParams.set("gender", String((params as any).gender));
    }

    return searchParams.toString();
  }
}

export class ApiError extends Error {
  statusCode: number;
  details?: Array<{ field?: string; code: string; message: string }>;

  constructor(
    message: string,
    statusCode: number,
    details?: Array<{ field?: string; code: string; message: string }>
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Singleton instance
export const api = new ApiClient();

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: any }>("/api/auth/login", { email, password }),

  register: (data: any) =>
    api.post("/api/auth/register", data),
};

// Users API
export const usersApi = {
  list: (params?: PaginationParams) =>
    api.get<UserRecord[]>("/api/users", params),

  get: (id: string) =>
    api.get<UserRecord>(`/api/users/${id}`),

  create: (data: CreateUserPayload) =>
    api.post<UserRecord>("/api/users", data),

  update: (id: string, data: UpdateUserPayload) =>
    api.put<UserRecord>(`/api/users/${id}`, data),

  delete: (id: string) =>
    api.delete<null>(`/api/users/${id}`),
};

// Students API
export const studentsApi = {
  list: (params?: PaginationParams) =>
    api.get<any[]>("/api/students", params),

  get: (id: string) =>
    api.get<any>(`/api/students/${id}`),

  create: (data: any) =>
    api.post<any>("/api/students", data),

  update: (id: string, data: any) =>
    api.put<any>(`/api/students/${id}`, data),

  delete: (id: string) =>
    api.delete<any>(`/api/students/${id}`),
};

// Academic Years API
export const academicYearsApi = {
  list: (params?: PaginationParams) =>
    api.get<any[]>("/api/academic-years", params),

  get: (id: string) =>
    api.get<any>(`/api/academic-years/${id}`),

  create: (data: any) =>
    api.post<any>("/api/academic-years", data),

  update: (id: string, data: any) =>
    api.put<any>(`/api/academic-years/${id}`, data),

  delete: (id: string) =>
    api.delete<any>(`/api/academic-years/${id}`),
};

// Fees API
export const feesApi = {
  list: (params?: PaginationParams) =>
    api.get<any[]>("/api/fees", params),

  get: (id: string) =>
    api.get<any>(`/api/fees/${id}`),

  create: (data: any) =>
    api.post<any>("/api/fees", data),

  update: (id: string, data: any) =>
    api.put<any>(`/api/fees/${id}`, data),

  delete: (id: string) =>
    api.delete<any>(`/api/fees/${id}`),
};

// Transactions API
export const transactionsApi = {
  list: (params?: PaginationParams) =>
    api.get<any[]>("/api/transactions", params),

  get: (id: string) =>
    api.get<any>(`/api/transactions/${id}`),

  create: (data: any) =>
    api.post<any>("/api/transactions", data),

  delete: (id: string) =>
    api.delete<any>(`/api/transactions/${id}`),
};

// Staff API
export const staffApi = {
  list: (params?: PaginationParams) =>
    api.get<any[]>("/api/staff", params),

  get: (id: string) =>
    api.get<any>(`/api/staff/${id}`),

  create: (data: any) =>
    api.post<any>("/api/staff", data),

  update: (id: string, data: any) =>
    api.put<any>(`/api/staff/${id}`, data),

  delete: (id: string) =>
    api.delete<any>(`/api/staff/${id}`),
};

// Salary API
export const salaryApi = {
  list: (params?: PaginationParams) =>
    api.get<any[]>("/api/salary", params),

  get: (id: string) =>
    api.get<any>(`/api/salary/${id}`),

  create: (data: any) =>
    api.post<any>("/api/salary", data),

  update: (id: string, data: any) =>
    api.put<any>(`/api/salary/${id}`, data),

  delete: (id: string) =>
    api.delete<any>(`/api/salary/${id}`),

  bulk: (data: any) =>
    api.post<any>("/api/salary/bulk", data),
};

// Attendance API
export const attendanceApi = {
  list: (params?: PaginationParams) =>
    api.get<any[]>("/api/attendance", params),

  get: (id: string) =>
    api.get<any>(`/api/attendance/${id}`),

  create: (data: any) =>
    api.post<any>("/api/attendance", data),

  update: (id: string, data: any) =>
    api.put<any>(`/api/attendance/${id}`, data),

  delete: (id: string) =>
    api.delete<any>(`/api/attendance/${id}`),
};

// Exams API
export const examsApi = {
  list: (params?: PaginationParams) =>
    api.get<any[]>("/api/exams", params),

  get: (id: string) =>
    api.get<any>(`/api/exams/${id}`),

  create: (data: any) =>
    api.post<any>("/api/exams", data),

  update: (id: string, data: any) =>
    api.put<any>(`/api/exams/${id}`, data),

  delete: (id: string) =>
    api.delete<any>(`/api/exams/${id}`),
};
