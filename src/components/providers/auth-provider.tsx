"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api-client";

interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  tenantId: string | null;
  isLoading: boolean;
  login: (token: string, tenantId: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<{
    user: User | null;
    token: string | null;
    tenantId: string | null;
    isLoading: boolean;
  }>({
    user: null,
    token: null,
    tenantId: null,
    isLoading: true,
  });

  const router = useRouter();
  const pathname = usePathname();

  // Restore auth state from localStorage on mount
  useEffect(() => {
    const restoreAuth = () => {
      try {
        const token = localStorage.getItem("auth_token");
        const tenantId = localStorage.getItem("tenant_id");
        const userStr = localStorage.getItem("user");

        if (token && tenantId && userStr) {
          const user = JSON.parse(userStr) as User;
          
          // Set auth in API client
          api.setAuth(token, tenantId);
          
          setAuthState({
            user,
            token,
            tenantId,
            isLoading: false,
          });

          // Also set cookie for middleware
          document.cookie = `auth_token=${token}; path=/; max-age=86400`;
        } else {
          setAuthState({
            user: null,
            token: null,
            tenantId: null,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error("Failed to restore auth:", error);
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    restoreAuth();
  }, []);

  // Protect routes
  useEffect(() => {
    if (!authState.isLoading && !authState.user) {
      // Allow access to auth pages without login
      if (!pathname.startsWith("/login") && !pathname.startsWith("/register")) {
        router.push("/login");
      }
    }
  }, [authState.user, authState.isLoading, pathname, router]);

  const login = useCallback((token: string, tenantId: string, user: User) => {
    // Store in localStorage
    localStorage.setItem("auth_token", token);
    localStorage.setItem("tenant_id", tenantId);
    localStorage.setItem("user", JSON.stringify(user));

    // Set cookie for middleware
    document.cookie = `auth_token=${token}; path=/; max-age=86400`;

    // Set auth in API client
    api.setAuth(token, tenantId);

    setAuthState({
      user,
      token,
      tenantId,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem("auth_token");
    localStorage.removeItem("tenant_id");
    localStorage.removeItem("user");

    // Clear cookie
    document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";

    // Clear API client auth
    api.clearAuth();

    setAuthState({
      user: null,
      token: null,
      tenantId: null,
      isLoading: false,
    });

    // Redirect to login
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
