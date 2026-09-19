"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";

interface QueryProviderProps {
  children: React.ReactNode;
}

function handleUnauthorizedRedirect() {
  if (typeof window === "undefined") return;
  const currentPath = window.location.pathname;
  // Ignore if already on public/auth routes
  const isPublicPath = ["/login", "/register", "/onboarding", "/verify"].some(
    (path) => currentPath === path || currentPath.startsWith(`${path}/`)
  );
  if (isPublicPath) return;

  try {
    localStorage.removeItem("pathshala_auth_user");
  } catch {
    // Ignore storage access errors
  }

  const searchParams = new URLSearchParams();
  searchParams.set("expired", "1");
  if (currentPath && currentPath !== "/") {
    searchParams.set("returnUrl", currentPath);
  }

  toast.error("Your session has expired. Please sign in again.");
  window.location.href = `/login?${searchParams.toString()}`;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error: any) => {
            if (
              error?.status === 401 ||
              error?.statusCode === 401 ||
              error?.message?.toLowerCase().includes("unauthorized") ||
              error?.message?.toLowerCase().includes("authentication required") ||
              error?.message?.toLowerCase().includes("session expired")
            ) {
              handleUnauthorizedRedirect();
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error: any) => {
            if (
              error?.status === 401 ||
              error?.statusCode === 401 ||
              error?.message?.toLowerCase().includes("unauthorized") ||
              error?.message?.toLowerCase().includes("authentication required") ||
              error?.message?.toLowerCase().includes("session expired")
            ) {
              handleUnauthorizedRedirect();
            }
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000, // 2 minutes: instant data access without network roundtrip
            gcTime: 10 * 60 * 1000, // 10 minutes: keep unused data in memory cache
            refetchOnWindowFocus: false, // Prevents background re-fetch latency on tab focus
            refetchOnMount: false, // Uses fresh cache if within staleTime
            retry: (failureCount, error: any) => {
              // Never retry on 401/403
              if (error?.status === 401 || error?.status === 403) return false;
              return failureCount < 1;
            },
            networkMode: "offlineFirst", // Instant render from cache
          },
          mutations: {
            retry: 0,
            networkMode: "always",
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
