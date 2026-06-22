"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Folder,
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  Tag,
} from "lucide-react";
import {
  getTaxonomyTree,
  createDepartment,
  renameDepartment,
  deleteDepartment,
  createCategory,
  renameCategory,
  deleteCategory,
  createSubcategory,
  renameSubcategory,
  deleteSubcategory,
} from "@/lib/api";
import { num } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

type Level = "department" | "category" | "subcategory";

interface FormState {
  mode: "create" | "rename";
  level: Level;
  parentId?: number;
  id?: number;
  currentName?: string;
}

interface DeleteState {
  level: Level;
  id: number;
  name: string;
  childCount: number;
}

const LEVEL_LABEL: Record<Level, string> = {
  department: "departamento",
  category: "categoría",
  subcategory: "subcategoría",
};

export default function TaxonomiaPage() {
  const qc = useQueryClient();
  const tree = useQuery({
    queryKey: ["taxonomy-tree"],
    queryFn: ({ signal }) => getTaxonomyTree(signal),
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormState | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [del, setDel] = useState<DeleteState | null>(null);
  const [force, setForce] = useState(false);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["taxonomy-tree"] });
    qc.invalidateQueries({ queryKey: ["departments"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["subcategories"] });
    qc.invalidateQueries({ queryKey: ["subcategories-all"] });
  };

  const formMut = useMutation({
    mutationFn: async () => {
      const name = nameInput.trim();
      if (!form) return;
      if (form.mode === "create") {
        if (form.level === "department") return createDepartment(name);
        if (form.level === "category")
          return createCategory(form.parentId as number, name);
        return createSubcategory(form.parentId as number, name);
      }
      if (form.level === "department")
        return renameDepartment(form.id as number, name);
      if (form.level === "category")
        return renameCategory(form.id as number, name);
      return renameSubcategory(form.id as number, name);
    },
    onSuccess: () => {
      invalidate();
      setForm(null);
      setNameInput("");
    },
  });

  const delMut = useMutation({
    mutationFn: async () => {
      if (!del) return;
      if (del.level === "department") return deleteDepartment(del.id, force);
      if (del.level === "category") return deleteCategory(del.id, force);
      return deleteSubcategory(del.id, force);
    },
    onSuccess: () => {
      invalidate();
      setDel(null);
      setForce(false);
    },
  });

  const openCreate = (level: Level, parentId?: number) => {
    setForm({ mode: "create", level, parentId });
    setNameInput("");
    formMut.reset();
  };
  const openRename = (level: Level, id: number, currentName: string) => {
    setForm({ mode: "rename", level, id, currentName });
    setNameInput(currentName);
    formMut.reset();
  };
  const openDelete = (d: DeleteState) => {
    setDel(d);
    setForce(false);
    delMut.reset();
  };

  const departments = useMemo(() => {
    const arbol = tree.data?.arbol ?? {};
    return Object.entries(arbol).sort(([a], [b]) => a.localeCompare(b));
  }, [tree.data]);

  const stats = useMemo(() => {
    let cats = 0;
    let subs = 0;
    let prods = 0;
    for (const [, dep] of departments) {
      const cs = Object.values(dep.categorias);
      cats += cs.length;
      for (const c of cs) {
        subs += c.subcategorias.length;
        prods += c.subcategorias.reduce((s, x) => s + (x.productos || 0), 0);
      }
    }
    return { deps: departments.length, cats, subs, prods };
  }, [departments]);

  const ActionBtn = ({
    icon: Icon,
    onClick,
    title,
    danger,
  }: {
    icon: typeof Plus;
    onClick: () => void;
    title: string;
    danger?: boolean;
  }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={cn(
        "rounded-md p-1 text-faint opacity-0 transition-opacity group-hover:opacity-100",
        danger ? "hover:bg-danger/15 hover:text-danger" : "hover:bg-surface-3 hover:text-fg",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Taxonomía"
        description="Jerarquía interna Departamento → Categoría → Subcategoría. Vive solo en tu base de datos (no en BSale)."
        actions={
          <Button onClick={() => openCreate("department")}>
            <Plus className="h-4 w-4" /> Departamento
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Badge tone="primary">{num(stats.deps)} departamentos</Badge>
        <Badge tone="info">{num(stats.cats)} categorías</Badge>
        <Badge tone="violet">{num(stats.subs)} subcategorías</Badge>
        <Badge tone="neutral">{num(stats.prods)} productos clasificados</Badge>
      </div>

      <Card className="p-2">
        {tree.isLoading ? (
          <LoadingState />
        ) : tree.error ? (
          <ErrorState error={tree.error} />
        ) : departments.length === 0 ? (
          <EmptyState
            title="Taxonomía vacía"
            hint="Crea el primer departamento para empezar."
          />
        ) : (
          <ul className="divide-y divide-border/50">
            {departments.map(([depName, dep]) => {
              const depKey = `d-${dep.id}`;
              const depOpen = expanded.has(depKey);
              const cats = Object.entries(dep.categorias).sort(([a], [b]) =>
                a.localeCompare(b),
              );
              const depProds = cats.reduce(
                (s, [, c]) =>
                  s + c.subcategorias.reduce((q, x) => q + (x.productos || 0), 0),
                0,
              );
              return (
                <li key={depKey}>
                  <div
                    onClick={() => toggle(depKey)}
                    className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-surface-2"
                  >
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0 text-faint transition-transform",
                        depOpen && "rotate-90",
                      )}
                    />
                    <FolderTree className="h-4 w-4 shrink-0 text-primary" />
                    <span className="font-medium text-fg">{depName}</span>
                    <Badge tone="neutral" className="ml-1">
                      {cats.length} cat · {num(depProds)} prod
                    </Badge>
                    <div className="ml-auto flex items-center gap-0.5">
                      <ActionBtn
                        icon={Plus}
                        title="Agregar categoría"
                        onClick={() => openCreate("category", dep.id)}
                      />
                      <ActionBtn
                        icon={Pencil}
                        title="Renombrar"
                        onClick={() => openRename("department", dep.id, depName)}
                      />
                      <ActionBtn
                        icon={Trash2}
                        title="Eliminar"
                        danger
                        onClick={() =>
                          openDelete({
                            level: "department",
                            id: dep.id,
                            name: depName,
                            childCount: cats.length,
                          })
                        }
                      />
                    </div>
                  </div>

                  {depOpen && (
                    <ul className="ml-6 border-l border-border/60 pl-2">
                      {cats.length === 0 && (
                        <li className="px-2 py-1.5 text-xs text-faint">
                          Sin categorías
                        </li>
                      )}
                      {cats.map(([catName, cat]) => {
                        const catKey = `c-${cat.id}`;
                        const catOpen = expanded.has(catKey);
                        const subs = cat.subcategorias;
                        return (
                          <li key={catKey}>
                            <div
                              onClick={() => toggle(catKey)}
                              className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2"
                            >
                              <ChevronRight
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0 text-faint transition-transform",
                                  catOpen && "rotate-90",
                                )}
                              />
                              <Folder className="h-3.5 w-3.5 shrink-0 text-info" />
                              <span className="text-sm text-fg">{catName}</span>
                              <span className="text-xs text-faint">
                                ({subs.length})
                              </span>
                              <div className="ml-auto flex items-center gap-0.5">
                                <ActionBtn
                                  icon={Plus}
                                  title="Agregar subcategoría"
                                  onClick={() =>
                                    openCreate("subcategory", cat.id)
                                  }
                                />
                                <ActionBtn
                                  icon={Pencil}
                                  title="Renombrar"
                                  onClick={() =>
                                    openRename("category", cat.id, catName)
                                  }
                                />
                                <ActionBtn
                                  icon={Trash2}
                                  title="Eliminar"
                                  danger
                                  onClick={() =>
                                    openDelete({
                                      level: "category",
                                      id: cat.id,
                                      name: catName,
                                      childCount: subs.length,
                                    })
                                  }
                                />
                              </div>
                            </div>

                            {catOpen && (
                              <ul className="ml-6 border-l border-border/60 pl-2">
                                {subs.length === 0 && (
                                  <li className="px-2 py-1.5 text-xs text-faint">
                                    Sin subcategorías
                                  </li>
                                )}
                                {subs
                                  .slice()
                                  .sort((a, b) =>
                                    a.nombre.localeCompare(b.nombre),
                                  )
                                  .map((sub) => (
                                    <li
                                      key={sub.id}
                                      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2"
                                    >
                                      <Tag className="h-3.5 w-3.5 shrink-0 text-violet" />
                                      <span className="text-sm text-fg/90">
                                        {sub.nombre}
                                      </span>
                                      {sub.productos > 0 && (
                                        <Badge tone="neutral">
                                          {num(sub.productos)}
                                        </Badge>
                                      )}
                                      <div className="ml-auto flex items-center gap-0.5">
                                        <ActionBtn
                                          icon={Pencil}
                                          title="Renombrar"
                                          onClick={() =>
                                            openRename(
                                              "subcategory",
                                              sub.id,
                                              sub.nombre,
                                            )
                                          }
                                        />
                                        <ActionBtn
                                          icon={Trash2}
                                          title="Eliminar"
                                          danger
                                          onClick={() =>
                                            openDelete({
                                              level: "subcategory",
                                              id: sub.id,
                                              name: sub.nombre,
                                              childCount: sub.productos,
                                            })
                                          }
                                        />
                                      </div>
                                    </li>
                                  ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Crear / Renombrar */}
      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={
          form?.mode === "create"
            ? `Nueva ${LEVEL_LABEL[form.level]}`
            : `Renombrar ${form ? LEVEL_LABEL[form.level] : ""}`
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => formMut.mutate()}
              loading={formMut.isPending}
              disabled={!nameInput.trim()}
            >
              {form?.mode === "create" ? "Crear" : "Guardar"}
            </Button>
          </>
        }
      >
        <Input
          autoFocus
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && nameInput.trim()) formMut.mutate();
          }}
          placeholder="Nombre"
          className="w-full"
        />
        {formMut.isError && (
          <p className="mt-2 text-xs text-danger">
            {(formMut.error as Error).message}
          </p>
        )}
      </Dialog>

      {/* Eliminar */}
      <Dialog
        open={del !== null}
        onClose={() => setDel(null)}
        title={`Eliminar ${del ? LEVEL_LABEL[del.level] : ""}`}
        description={del ? `"${del.name}"` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDel(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => delMut.mutate()}
              loading={delMut.isPending}
            >
              Eliminar
            </Button>
          </>
        }
      >
        {del && del.childCount > 0 && (
          <label className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-dim/40 p-3 text-sm">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-fg">
              Tiene {num(del.childCount)}{" "}
              {del.level === "subcategory" ? "productos asociados" : "elementos hijos"}.
              Eliminar en cascada (forzar).
            </span>
          </label>
        )}
        {delMut.isError && (
          <p className="mt-2 text-xs text-danger">
            {(delMut.error as Error).message}
          </p>
        )}
      </Dialog>
    </div>
  );
}
