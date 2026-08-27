"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  permissions?: Record<string, any> | null;
  tenantName?: string;
}

interface AuthContextType {
  user: User | null;
  tenantId: string | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
}

const AUTH_STORAGE_KEY = "pathshala_auth_user";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getInitialUser(): { user: User | null; tenantId: string | null; isLoading: boolean } {
  return { user: null, tenantId: null, isLoading: true };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState(getInitialUser);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;

    // Immediately restore cached user on mount (client-side only, after clean hydration)
    try {
      const cached = localStorage.getItem(AUTH_STORAGE_KEY);
      if (cached) {
        const user = JSON.parse(cached) as User;
        if (user && user.tenantId) {
          setAuthState({
            user,
            tenantId: user.tenantId,
            isLoading: false,
          });
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
              isLoading: false,
            });
          }
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthState({
            user: null,
            tenantId: null,
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
        if (!pathname.startsWith("/login") && !pathname.startsWith("/register")) {
          router.push("/login");
        }
      } else {
        if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
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
      isLoading: false,
    });
  }, []);

  const logout = useCallback(async () => {
    // Clear client auth state
    localStorage.removeItem(AUTH_STORAGE_KEY);

    setAuthState({
      user: null,
      tenantId: null,
      isLoading: false,
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
