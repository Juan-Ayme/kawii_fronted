"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Pencil,
  Link2Off,
  RefreshCw,
  Trash2,
  Tags,
  CircleAlert,
} from "lucide-react";
import {
  getProductTypes,
  getSubcategories,
  createProductType,
  updateProductType,
  deleteProductType,
  resyncProductType,
  type ProductTypeFilters,
} from "@/lib/api";
import { num } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/types";

type Toggle = "all" | "unmapped" | "inactive";

export default function ProductTypesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [toggle, setToggle] = useState<Toggle>("all");

  // edición / creación
  const [editing, setEditing] = useState<ProductType | "new" | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [subInput, setSubInput] = useState("");
  const [del, setDel] = useState<ProductType | null>(null);
  const [force, setForce] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const filters: ProductTypeFilters = useMemo(
    () => ({
      q: q || undefined,
      only_unmapped: toggle === "unmapped" || undefined,
      only_inactive: toggle === "inactive" || undefined,
      limit: 1000,
    }),
    [q, toggle],
  );

  const pts = useQuery({
    queryKey: ["product-types", filters],
    queryFn: ({ signal }) => getProductTypes(filters, signal),
    placeholderData: keepPreviousData,
  });

  const subs = useQuery({
    queryKey: ["subcategories-all"],
    queryFn: ({ signal }) => getSubcategories(undefined, signal),
    staleTime: 5 * 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["product-types"] });
    qc.invalidateQueries({ queryKey: ["products-summary"] });
    qc.invalidateQueries({ queryKey: ["audits"] });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const name = nameInput.trim();
      if (editing === "new") {
        return createProductType(name, subInput === "" ? null : Number(subInput));
      }
      const pt = editing as ProductType;
      const unmap = subInput === "";
      return updateProductType(
        pt.bsale_product_type_id,
        {
          name: name !== pt.name ? name : undefined,
          subcategory_id: unmap ? undefined : Number(subInput),
        },
        unmap && pt.is_mapped,
      );
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });

  const delMut = useMutation({
    mutationFn: () =>
      deleteProductType((del as ProductType).bsale_product_type_id, force),
    onSuccess: () => {
      invalidate();
      setDel(null);
      setForce(false);
    },
  });

  const resyncMut = useMutation({
    mutationFn: (id: number) => resyncProductType(id),
    onSuccess: invalidate,
  });

  const openNew = () => {
    setEditing("new");
    setNameInput("");
    setSubInput("");
    saveMut.reset();
  };
  const openEdit = (pt: ProductType) => {
    setEditing(pt);
    setNameInput(pt.name);
    setSubInput(pt.subcategory_id ? String(pt.subcategory_id) : "");
    saveMut.reset();
  };

  const columns: Column<ProductType>[] = [
    {
      key: "name",
      header: "Product Type (BSale)",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="line-clamp-1 font-medium text-fg">{r.name}</span>
          {!r.naming_ok && r.is_mapped && (
            <span title="El nombre no sigue 'Categoría / Subcategoría'">
              <CircleAlert className="h-3.5 w-3.5 text-warning" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: "mapping",
      header: "Mapeo",
      render: (r) =>
        r.is_mapped ? (
          <div className="text-xs">
            <span className="text-fg">{r.subcategory}</span>
            <span className="text-faint">
              {" "}
              · {r.department} / {r.category}
            </span>
          </div>
        ) : (
          <Badge tone="warning">Sin mapear</Badge>
        ),
    },
    {
      key: "productos",
      header: "Prod.",
      align: "right",
      render: (r) => num(r.productos),
    },
    {
      key: "estado",
      header: "Estado",
      align: "center",
      render: (r) =>
        r.is_active ? (
          <Badge tone="success">Activo</Badge>
        ) : (
          <Badge tone="neutral">Inactivo</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-0.5">
          <IconBtn title="Editar / mapear" onClick={() => openEdit(r)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconBtn>
          {r.is_mapped && (
            <IconBtn
              title="Quitar mapeo"
              onClick={() =>
                updateProductType(r.bsale_product_type_id, {}, true).then(
                  invalidate,
                )
              }
            >
              <Link2Off className="h-3.5 w-3.5" />
            </IconBtn>
          )}
          <IconBtn
            title="Resincronizar desde BSale"
            onClick={() => resyncMut.mutate(r.bsale_product_type_id)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn title="Eliminar" danger onClick={() => setDel(r)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      ),
    },
  ];

  const toggles: { key: Toggle; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "unmapped", label: "Sin mapear" },
    { key: "inactive", label: "Inactivos" },
  ];

  return (
    <div>
      <PageHeader
        title="Product Types"
        description="Tipos de producto de BSale y su mapeo a la taxonomía. Crear, renombrar y eliminar escriben en BSale."
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre…"
              className="w-full pl-8"
            />
          </div>
          <div className="flex gap-1.5">
            {toggles.map((t) => (
              <button
                key={t.key}
                onClick={() => setToggle(t.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  toggle === t.key
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={pts.data?.items}
        isLoading={pts.isLoading || pts.isFetching}
        error={pts.error}
        rowKey={(r) => r.bsale_product_type_id}
        emptyTitle="Sin product types"
      />
      {pts.data && (
        <p className="mt-2 text-xs text-faint">
          {num(pts.data.total)} resultados <Tags className="inline h-3 w-3" />
        </p>
      )}

      {/* Crear / editar */}
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nuevo product type" : "Editar product type"}
        description="El nombre se crea/edita en BSale; el mapeo solo en tu BD."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              loading={saveMut.isPending}
              disabled={!nameInput.trim()}
            >
              {editing === "new" ? "Crear" : "Guardar"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Nombre">
            <Input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Ej: Dulces / Chocolates"
              className="w-full"
            />
          </Field>
          <Field label="Mapear a subcategoría">
            <Select
              value={subInput}
              onChange={(e) => setSubInput(e.target.value)}
              disabled={subs.isLoading}
            >
              <option value="">— Sin mapear —</option>
              {(subs.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.department_name} / {s.category_name} / {s.name}
                </option>
              ))}
            </Select>
          </Field>
          {saveMut.isError && (
            <p className="text-xs text-danger">
              {(saveMut.error as Error).message}
            </p>
          )}
        </div>
      </Dialog>

      {/* Eliminar */}
      <Dialog
        open={del !== null}
        onClose={() => setDel(null)}
        title="Eliminar product type"
        description={del ? `"${del.name}" — se eliminará en BSale y tu BD.` : ""}
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
        {del && del.productos > 0 && (
          <label className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-dim/40 p-3 text-sm">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-fg">
              Tiene {num(del.productos)} productos. Forzar (BSale puede rechazar
              si hay productos vivos).
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

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={cn(
        "rounded-md p-1.5 text-faint transition-colors",
        danger
          ? "hover:bg-danger/15 hover:text-danger"
          : "hover:bg-surface-3 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
