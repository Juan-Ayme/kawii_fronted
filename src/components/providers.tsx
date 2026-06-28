"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { SucursalProvider } from "@/components/sucursal-context";
import { AuthProvider } from "@/components/auth-context";

const config: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // No reintentar si la API no responde o devuelve 4xx.
        if (error instanceof ApiError) {
          if (error.status === 0 || (error.status >= 400 && error.status < 500))
            return false;
        }
        return failureCount < 2;
      },
    },
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient(config));
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <SucursalProvider>{children}</SucursalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
