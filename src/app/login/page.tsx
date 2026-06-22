"use client";

/**
 * Página de login.
 *
 * El backend setea una cookie httpOnly al hacer `POST /auth/login`; el
 * cliente fetch ya manda esa cookie en cada request siguiente
 * (`credentials: 'include'`). Esta página no necesita guardar el token —
 * solo refrescar el AuthContext con `signIn()` y navegar a `next`.
 */

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Lock, User as UserIcon } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const { signIn, isAuthenticated, isLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya estoy autenticado y caí acá por accidente, voy directo al "next".
  if (!isLoading && isAuthenticated) {
    router.replace(next);
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? "Usuario o contraseña incorrectos."
            : err.status === 403
              ? "Usuario desactivado. Pedí al admin que te active."
              : err.message,
        );
      } else {
        setError("Error al iniciar sesión. Intentá de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-pill bg-primary/15 ring-4 ring-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-h2 font-bold text-fg">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-muted">
            Ingresá con tu usuario para acceder al panel.
          </p>
        </div>

        <Card>
          <CardBody>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-caption font-semibold uppercase tracking-[0.08em] text-muted">
                  Usuario
                </span>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                  <Input
                    type="text"
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="pl-9"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-caption font-semibold uppercase tracking-[0.08em] text-muted">
                  Contraseña
                </span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-9"
                  />
                </div>
              </label>

              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-danger/40 bg-danger-dim/30 px-3 py-2 text-sm text-danger"
                >
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || !username.trim() || !password}
                className="w-full justify-center"
              >
                <LogIn className="h-4 w-4" />
                {submitting ? "Ingresando…" : "Ingresar"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="mt-4 text-center text-[0.7rem] text-faint">
          ¿Olvidaste tu contraseña? Pedí al admin que te la resetee desde
          Configuración → Usuarios.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Cargando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
