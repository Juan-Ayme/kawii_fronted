"use client";

/**
 * AuthContext: estado de autenticación global.
 *
 * Internamente usa React Query (`["auth-me"]`) para resolver la sesión:
 * hace `GET /auth/me` al montar; si vuelve 401, el query queda en
 * estado "errored" y `user` es null. Al hacer login, invalidamos para
 * que se refetchee.
 *
 * Hooks expuestos:
 * - `useAuth()`         → { user, isLoading, isAuthenticated, signIn, signOut }
 * - `useRequireAuth()`  → redirige a /login si no hay sesión (usar en pages protegidas)
 * - `useRequireRole(roles)` → idem + valida rol
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  getMe,
  login as apiLogin,
  logout as apiLogout,
  type AuthUser,
  type UserRole,
} from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

const AUTH_KEY = ["auth-me"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  // Una sesión vencida da 401 — React Query lo trata como "error" y `data`
  // queda undefined. Lo convertimos a `null` en el consumidor.
  const q = useQuery({
    queryKey: AUTH_KEY,
    queryFn: ({ signal }) => getMe(signal),
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 1;
    },
  });

  const signIn = useCallback(
    async (username: string, password: string) => {
      const r = await apiLogin(username, password);
      // Pre-llenamos la cache y refetcheamos para confirmar.
      qc.setQueryData(AUTH_KEY, r.user);
      await qc.invalidateQueries({ queryKey: AUTH_KEY });
    },
    [qc],
  );

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Ignoramos errores: limpiamos estado igual.
    }
    qc.setQueryData(AUTH_KEY, null);
    // Invalida TODAS las queries — la próxima vez que entremos cualquier
    // página, las llamadas a la API van a fallar con 401 y redirigir.
    qc.clear();
  }, [qc]);

  const user: AuthUser | null = q.data ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading: q.isLoading,
      isAuthenticated: !!user,
      signIn,
      signOut,
    }),
    [user, q.isLoading, signIn, signOut],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

/**
 * En cualquier página protegida: si no hay sesión, redirige a /login con
 * `next=` para que vuelva a esta página después del login.
 */
export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!isLoading && !user) {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/login?next=${next}`);
    }
  }, [user, isLoading, pathname, router]);
  return { user, isLoading };
}

/** Igual que `useRequireAuth` pero además exige que `user.role` esté en `roles`. */
export function useRequireRole(roles: UserRole[]) {
  const { user, isLoading } = useRequireAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && user && !roles.includes(user.role)) {
      router.replace("/?forbidden=1");
    }
  }, [user, isLoading, roles, router]);
  return { user, isLoading };
}
