"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000, // 2 minutes: instant data access without network roundtrip
            gcTime: 10 * 60 * 1000, // 10 minutes: keep unused data in memory cache
            refetchOnWindowFocus: false, // Prevents background re-fetch latency on tab focus
            refetchOnMount: false, // Uses fresh cache if within staleTime
            retry: 1,
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
