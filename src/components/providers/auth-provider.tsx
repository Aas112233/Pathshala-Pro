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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<{
    user: User | null;
    tenantId: string | null;
    isLoading: boolean;
  }>({
    user: null,
    tenantId: null,
    isLoading: true,
  });

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
        });

        if (response.ok) {
          const result = await response.json();
          const user = result.data as User;
          setAuthState({
            user,
            tenantId: user.tenantId,
            isLoading: false,
          });
        } else {
          setAuthState({
            user: null,
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
    if (!authState.isLoading) {
      if (!authState.user) {
        // Allow access to auth pages without login
        if (!pathname.startsWith("/login") && !pathname.startsWith("/register")) {
          router.push("/login");
        }
      } else {
        // If user is logged in, restrict access to auth pages
        if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
          router.push("/");
        }
      }
    }
  }, [authState.user, authState.isLoading, pathname, router]);

  const login = useCallback((user: User) => {
    setAuthState({
      user,
      tenantId: user.tenantId,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    setAuthState({
      user: null,
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
