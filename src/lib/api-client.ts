import type {
  ApiSuccessResponse,
  ApiPaginatedResponse,
  ApiErrorResponse,
  SearchParams,
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
  async get<T>(endpoint: string, params?: SearchParams): Promise<ApiSuccessResponse<T> | ApiPaginatedResponse<T>> {
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

  private buildQueryString(params: SearchParams): string {
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
  list: (params?: SearchParams) =>
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
  list: (params?: SearchParams) =>
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
  list: (params?: SearchParams) =>
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
  list: (params?: SearchParams) =>
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
  list: (params?: SearchParams) =>
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
  list: (params?: SearchParams) =>
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
  list: (params?: SearchParams) =>
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
  list: (params?: SearchParams) =>
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
  list: (params?: SearchParams) =>
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

// Expenses API
export const expensesApi = {
  list: (params?: SearchParams) =>
    api.get<any[]>("/api/accounting/expenses", params),

  create: (data: any) =>
    api.post<any>("/api/accounting/expenses", data),

  delete: (id: string) =>
    api.delete<any>(`/api/accounting/expenses/${id}`),
};

// Expense Categories API
export const expenseCategoriesApi = {
  list: () =>
    api.get<any[]>("/api/accounting/categories"),

  create: (data: any) =>
    api.post<any>("/api/accounting/categories", data),
};

// Bank Accounts API
export const bankAccountsApi = {
  list: () =>
    api.get<any[]>("/api/accounting/accounts"),

  create: (data: any) =>
    api.post<any>("/api/accounting/accounts", data),
};

// Profit & Loss API
export const profitLossApi = {
  get: (year?: number) =>
    api.get<any>("/api/accounting/profit-loss", year ? { year: year.toString() } : undefined),
};

// Enquiries API
export const enquiriesApi = {
  list: (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return api.get<any[]>(`/api/enquiries?${qs}` as any);
  },
  create: (data: any) => api.post<any>("/api/enquiries", data),
  update: (id: string, data: any) => api.put<any>(`/api/enquiries/${id}`, data),
  remove: (id: string) => api.delete<any>(`/api/enquiries/${id}`),
  convert: (id: string) => api.post<any>(`/api/enquiries/${id}/convert`, {}),
};

// Leaves API
export const leavesApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api.get<any[]>(`/api/leaves${qs ? `?${qs}` : ""}` as any);
  },
  create: (data: any) => api.post<any>("/api/leaves", data),
  update: (id: string, data: any) => api.put<any>(`/api/leaves/${id}`, data),
  remove: (id: string) => api.delete<any>(`/api/leaves/${id}`),
};

// Homework API
export const homeworkApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api.get<any[]>(`/api/homeworks${qs ? `?${qs}` : ""}` as any);
  },
  create: (data: any) => api.post<any>("/api/homeworks", data),
  update: (id: string, data: any) => api.put<any>(`/api/homeworks/${id}`, data),
  remove: (id: string) => api.delete<any>(`/api/homeworks/${id}`),
  submissions: {
    list: (homeworkId: string) => api.get<any[]>(`/api/homeworks/${homeworkId}/submissions` as any),
    create: (homeworkId: string, data: any) => api.post<any>(`/api/homeworks/${homeworkId}/submissions`, data),
    grade: (id: string, data: any) => api.put<any>(`/api/homework-submissions/${id}`, data),
  },
};

// Certificates API
export const certificatesApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api.get<any[]>(`/api/certificates${qs ? `?${qs}` : ""}` as any);
  },
  create: (data: any) => api.post<any>("/api/certificates", data),
  update: (id: string, data: any) => api.put<any>(`/api/certificates/${id}`, data),
  remove: (id: string) => api.delete<any>(`/api/certificates/${id}`),
};

// Health API
export const healthApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api.get<any[]>(`/api/health-records${qs ? `?${qs}` : ""}` as any);
  },
  create: (data: any) => api.post<any>("/api/health-records", data),
  update: (id: string, data: any) => api.put<any>(`/api/health-records/${id}`, data),
  remove: (id: string) => api.delete<any>(`/api/health-records/${id}`),
};

// Hostel API
export const hostelApi = {
  hostels: {
    list: (params?: Record<string, string>) => {
      const qs = params ? new URLSearchParams(params).toString() : "";
      return api.get<any[]>(`/api/hostels${qs ? `?${qs}` : ""}` as any);
    },
    create: (data: any) => api.post<any>("/api/hostels", data),
    update: (id: string, data: any) => api.put<any>(`/api/hostels/${id}`, data),
    remove: (id: string) => api.delete<any>(`/api/hostels/${id}`),
  },
  rooms: {
    list: (params?: Record<string, string>) => {
      const qs = params ? new URLSearchParams(params).toString() : "";
      return api.get<any[]>(`/api/hostel-rooms${qs ? `?${qs}` : ""}` as any);
    },
    create: (data: any) => api.post<any>("/api/hostel-rooms", data),
    update: (id: string, data: any) => api.put<any>(`/api/hostel-rooms/${id}`, data),
    remove: (id: string) => api.delete<any>(`/api/hostel-rooms/${id}`),
  },
  allocations: {
    list: (params?: Record<string, string>) => {
      const qs = params ? new URLSearchParams(params).toString() : "";
      return api.get<any[]>(`/api/hostel-allocations${qs ? `?${qs}` : ""}` as any);
    },
    create: (data: any) => api.post<any>("/api/hostel-allocations", data),
    remove: (id: string) => api.delete<any>(`/api/hostel-allocations/${id}`),
  },
};

// Inventory API
export const inventoryApi = {
  items: {
    list: (params?: Record<string, string>) => {
      const qs = params ? new URLSearchParams(params).toString() : "";
      return api.get<any[]>(`/api/inventory/items${qs ? `?${qs}` : ""}` as any);
    },
    create: (data: any) => api.post<any>("/api/inventory/items", data),
    update: (id: string, data: any) => api.put<any>(`/api/inventory/items/${id}`, data),
    remove: (id: string) => api.delete<any>(`/api/inventory/items/${id}`),
  },
  transactions: {
    list: (params?: Record<string, string>) => {
      const qs = params ? new URLSearchParams(params).toString() : "";
      return api.get<any[]>(`/api/inventory/transactions${qs ? `?${qs}` : ""}` as any);
    },
    create: (data: any) => api.post<any>("/api/inventory/transactions", data),
    remove: (id: string) => api.delete<any>(`/api/inventory/transactions/${id}`),
  },
};

// Transport API
export const transportApi = {
  vehicles: {
    list: (params?: Record<string, string>) => {
      const qs = params ? new URLSearchParams(params).toString() : "";
      return api.get<any[]>(`/api/transport/vehicles${qs ? `?${qs}` : ""}` as any);
    },
    create: (data: any) => api.post<any>("/api/transport/vehicles", data),
    update: (id: string, data: any) => api.put<any>(`/api/transport/vehicles/${id}`, data),
    remove: (id: string) => api.delete<any>(`/api/transport/vehicles/${id}`),
  },
  routes: {
    list: (params?: Record<string, string>) => {
      const qs = params ? new URLSearchParams(params).toString() : "";
      return api.get<any[]>(`/api/transport/routes${qs ? `?${qs}` : ""}` as any);
    },
    create: (data: any) => api.post<any>("/api/transport/routes", data),
    update: (id: string, data: any) => api.put<any>(`/api/transport/routes/${id}`, data),
    remove: (id: string) => api.delete<any>(`/api/transport/routes/${id}`),
  },
  allocations: {
    list: (params?: Record<string, string>) => {
      const qs = params ? new URLSearchParams(params).toString() : "";
      return api.get<any[]>(`/api/transport/allocations${qs ? `?${qs}` : ""}` as any);
    },
    create: (data: any) => api.post<any>("/api/transport/allocations", data),
    remove: (id: string) => api.delete<any>(`/api/transport/allocations/${id}`),
  },
};

// Library API
export const libraryApi = {
  books: {
    list: (params?: Record<string, string>) => {
      const qs = params ? new URLSearchParams(params).toString() : "";
      return api.get<any[]>(`/api/library/books${qs ? `?${qs}` : ""}` as any);
    },
    create: (data: any) => api.post<any>("/api/library/books", data),
    update: (id: string, data: any) => api.put<any>(`/api/library/books/${id}`, data),
    remove: (id: string) => api.delete<any>(`/api/library/books/${id}`),
  },
  issues: {
    list: (params?: Record<string, string>) => {
      const qs = params ? new URLSearchParams(params).toString() : "";
      return api.get<any[]>(`/api/library/issues${qs ? `?${qs}` : ""}` as any);
    },
    create: (data: any) => api.post<any>("/api/library/issues", data),
    return: (id: string, data?: any) => api.post<any>(`/api/library/issues/${id}/return`, data || {}),
  },
};

// Timetable API
export const timetableApi = {
  list: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return api.get<any[]>(`/api/timetables?${qs}` as any);
  },
  create: (data: any) => api.post<any>("/api/timetables", data),
  bulk: (entries: any[]) => api.post<any>("/api/timetables", { entries }),
  update: (id: string, data: any) => api.put<any>(`/api/timetables/${id}`, data),
  remove: (id: string) => api.delete<any>(`/api/timetables/${id}`),
  conflicts: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return api.get<any>(`/api/timetables/conflicts?${qs}` as any);
  },
};

