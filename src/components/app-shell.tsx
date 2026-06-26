"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { NAV_GROUPS, ALL_NAV_ITEMS } from "./nav";
import { ApiStatus } from "./api-status";
import { SucursalSelector } from "./sucursal-context";
import { Toaster } from "./ui/toaster";
import { useAuth } from "./auth-context";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLinks({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Por defecto expandir el grupo que contiene la ruta actual
    for (const g of NAV_GROUPS) {
      if (g.items.some(i => isActive(pathname, i.href))) {
        initial.add(g.title);
      }
    }
    // Si no hay ninguno activo, expandimos el primero
    if (initial.size === 0 && NAV_GROUPS.length > 0) {
      initial.add(NAV_GROUPS[0].title);
    }
    return initial;
  });

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <nav className={cn("flex flex-col", collapsed ? "gap-2" : "gap-4")}>
      {NAV_GROUPS.map((group) => {
        const isExpanded = expandedGroups.has(group.title);
        
        // Si el menú principal está colapsado (solo íconos), mostramos los íconos
        // solo si el grupo está expandido. No mostramos el botón de grupo.
        if (collapsed) {
          if (!isExpanded) return null;
          return (
            <ul key={group.title} className="flex flex-col gap-0.5 mb-2">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={item.label}
                      className={cn(
                        "group relative flex items-center justify-center rounded-md px-2 py-2.5 text-body font-medium",
                        "transition-[background,color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
                        active ? "bg-primary/12 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-1 left-0 w-0.5 rounded-pill bg-primary" aria-hidden="true" />
                      )}
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors duration-[var(--duration-fast)]",
                          active ? "text-primary" : "text-faint group-hover:text-muted"
                        )}
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Modo expandido (sidebar completo o onHover)
        return (
          <div key={group.title} className="flex flex-col">
            <button
              onClick={() => toggleGroup(group.title)}
              className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-surface-2 rounded-md group/header"
              title={isExpanded ? "Contraer grupo" : "Expandir grupo"}
            >
              <span className="text-caption font-semibold uppercase tracking-[0.12em] text-faint group-hover/header:text-muted">
                {group.title}
              </span>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 text-faint transition-transform duration-[var(--duration-base)]",
                  isExpanded ? "rotate-90" : ""
                )}
              />
            </button>
            
            <div
              className={cn(
                "grid transition-all duration-[var(--duration-base)] ease-[var(--ease-premium)]",
                isExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0 mt-0"
              )}
            >
              <ul className="flex flex-col gap-0.5 overflow-hidden">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-md px-3 py-2 text-body font-medium",
                          "transition-[background,color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
                          active ? "bg-primary/12 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
                        )}
                      >
                        {active && (
                          <span className="absolute inset-y-1 left-0 w-0.5 rounded-pill bg-primary" aria-hidden="true" />
                        )}
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0 transition-colors duration-[var(--duration-fast)]",
                            active ? "text-primary" : "text-faint group-hover:text-muted"
                          )}
                          aria-hidden="true"
                        />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center",
        collapsed ? "justify-center" : "gap-2.5",
      )}
      title={collapsed ? "KAWII BI · Grupo Hudec" : undefined}
    >
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent font-bold text-primary-fg shadow-card-hover">
        <span className="relative z-10">K</span>
        <span
          className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/15 to-transparent"
          aria-hidden="true"
        />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <p className="text-h3 font-semibold text-fg">KAWII BI</p>
          <p className="text-caption tracking-normal text-faint">Grupo Hudec</p>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  const roleStyle: Record<string, string> = {
    admin: "bg-primary/15 text-primary",
    operador: "bg-success/15 text-success",
    viewer: "bg-surface-3 text-muted",
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-fg hover:bg-surface-2"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold uppercase">
          {user.username.slice(0, 2)}
        </span>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span>{user.username}</span>
          <span
            className={cn(
              "rounded px-1 py-0.5 text-[0.62rem] uppercase tracking-wider",
              roleStyle[user.role] ?? "",
            )}
          >
            {user.role}
          </span>
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-48 overflow-hidden rounded-md border border-border-soft bg-surface shadow-card-hover">
            <div className="border-b border-border/30 px-3 py-2 text-xs text-muted">
              <p className="font-semibold text-fg">{user.username}</p>
              <p>{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-surface-2"
            >
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();
  const current = ALL_NAV_ITEMS.find((i) => isActive(pathname, i.href));

  const isEffectivelyCollapsed = sidebarCollapsed && !sidebarHovered;

  // /login se renderiza pelado, sin sidebar.
  const isLoginPage = pathname === "/login";

  // Si no estoy autenticado y no estoy en /login, redirijo.
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isLoginPage) {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/login?next=${next}`);
    }
  }, [isLoading, isAuthenticated, isLoginPage, pathname, router]);

  // Restaurar preferencia de colapso del sidebar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarCollapsed(
      localStorage.getItem("kawii_sidebar_collapsed") === "true",
    );
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("kawii_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  if (isLoginPage) {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted">
          <ShieldCheck className="h-8 w-8 animate-pulse text-primary" />
          <p className="text-sm">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full">
      {/* Sidebar — desktop */}
      <aside
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border-soft bg-bg-soft py-5 transition-[width] duration-[var(--duration-base)] ease-[var(--ease-premium)] lg:flex",
          isEffectivelyCollapsed ? "w-[68px]" : "w-64",
          sidebarHovered && sidebarCollapsed ? "shadow-modal border-r-0" : ""
        )}
      >
        <div className={cn("flex items-center", isEffectivelyCollapsed ? "justify-center" : "px-5")}>
          <Brand collapsed={isEffectivelyCollapsed} />
        </div>
        
        <div className={cn("mt-8 flex-1 overflow-y-auto w-full", isEffectivelyCollapsed ? "px-1" : "px-4")}>
          <NavLinks collapsed={isEffectivelyCollapsed} />
        </div>

        <div className={cn("border-t border-border-soft pt-4 flex flex-col gap-3 w-full", isEffectivelyCollapsed ? "px-1 items-center" : "px-4")}>
          <button
            onClick={toggleSidebar}
            className={cn(
              "flex items-center justify-center rounded-md p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg",
              isEffectivelyCollapsed ? "" : "w-full gap-2 justify-start"
            )}
            title={isEffectivelyCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {isEffectivelyCollapsed ? <ChevronRight className="h-5 w-5" /> : <><ChevronLeft className="h-5 w-5" /> <span className="text-sm font-medium">Colapsar</span></>}
          </button>
          {!isEffectivelyCollapsed && <ApiStatus />}
        </div>
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-bg/80 backdrop-blur-sm animate-[fade-in_var(--duration-base)_var(--ease-premium)_both]"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className={cn(
              "absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border-soft bg-bg-soft px-3 py-5 shadow-modal",
              "animate-[slide-in-from-left_var(--duration-slow)_var(--ease-premium)_both]",
            )}
          >
            <div className="flex items-center justify-between px-2">
              <Brand />
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-muted transition-colors duration-[var(--duration-fast)] ease-[var(--ease-premium)] hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-8 flex-1 overflow-y-auto px-1">
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="border-t border-border-soft px-3 pt-4">
              <ApiStatus />
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[padding] duration-[var(--duration-base)] ease-[var(--ease-premium)]",
          sidebarCollapsed ? "lg:pl-[68px]" : "lg:pl-64"
        )}
      >
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border-soft bg-bg/85 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-muted transition-colors duration-[var(--duration-fast)] ease-[var(--ease-premium)] hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <h1 className="text-h3 font-semibold text-fg">
            {current?.label ?? "Dashboard"}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <SucursalSelector />
            <div className="lg:hidden">
              <ApiStatus />
            </div>
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
