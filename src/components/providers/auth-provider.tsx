"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

import type { TenantModuleKey } from "@/lib/tenant-modules";

interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  permissions?: Record<string, any> | null;
  tenantName?: string;
  moduleAccess?: Record<TenantModuleKey, boolean> | null;
}

interface AuthContextType {
  user: User | null;
  tenantId: string | null;
  moduleAccess: Record<TenantModuleKey, boolean> | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
}

const AUTH_STORAGE_KEY = "pathshala_auth_user";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getInitialUser(): {
  user: User | null;
  tenantId: string | null;
  moduleAccess: Record<TenantModuleKey, boolean> | null;
  isLoading: boolean;
} {
  return { user: null, tenantId: null, moduleAccess: null, isLoading: true };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState(getInitialUser);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;

    // Immediately restore cached user on mount (client-side only, after clean hydration)
    try {
      const isExpiredOrLogout =
        typeof window !== "undefined" &&
        (window.location.search.includes("expired=1") ||
         window.location.search.includes("logout=1"));

      if (isExpiredOrLogout) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } else {
        const cached = localStorage.getItem(AUTH_STORAGE_KEY);
        if (cached) {
          const user = JSON.parse(cached) as User;
          if (user && user.tenantId) {
            setAuthState({
              user,
              tenantId: user.tenantId,
              moduleAccess: user.moduleAccess ?? null,
              isLoading: false,
            });
          }
        }
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }

    const restoreAuth = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
        });

        if (!isMounted) return;

        if (response.ok) {
          const result = await response.json();
          const user = result.data as User;
          if (user) {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
            setAuthState({
              user,
              tenantId: user.tenantId,
              moduleAccess: user.moduleAccess ?? null,
              isLoading: false,
            });
          }
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthState({
            user: null,
            tenantId: null,
            moduleAccess: null,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error("Failed to restore auth session:", error);
        if (isMounted) {
          setAuthState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    };

    void restoreAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Protect routes without blocking renders
  useEffect(() => {
    if (!authState.isLoading) {
      if (!authState.user) {
        // Keep public onboarding and verification accessible without a session.
        const isPublicPath = ["/login", "/register", "/onboarding", "/verify"].some(
          (path) => pathname === path || pathname.startsWith(`${path}/`)
        );
        if (!isPublicPath) {
          router.push("/login");
        }
      } else {
        const isExpiredOrLogout =
          typeof window !== "undefined" &&
          (window.location.search.includes("expired=1") ||
           window.location.search.includes("logout=1"));
        if (!isExpiredOrLogout && (pathname.startsWith("/login") || pathname.startsWith("/register"))) {
          router.push("/");
        }
      }
    }
  }, [authState.user, authState.isLoading, pathname, router]);

  const login = useCallback((user: User) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    setAuthState({
      user,
      tenantId: user.tenantId,
      moduleAccess: user.moduleAccess ?? null,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(async () => {
    // Clear client auth state, keeping isLoading: true while redirecting to prevent
    // flash of NotAuthorizedScreen or unauthorized content before the page unloads
    localStorage.removeItem(AUTH_STORAGE_KEY);

    setAuthState({
      user: null,
      tenantId: null,
      moduleAccess: null,
      isLoading: true,
    });

    try {
      // Invalidate the auth cookie on the server before redirecting
      await Promise.race([
        fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        }),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
    } catch {
      // Ignore network errors during logout
    } finally {
      // Full redirect to /login clears client cache, queries, and prevents middleware bounce
      window.location.href = "/login";
    }
  }, []);

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
