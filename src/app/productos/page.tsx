"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, Package, Layers, Tag, AlertTriangle } from "lucide-react";
import {
  getProducts,
  getProductsSummary,
  getDepartments,
  getCategories,
  getSubcategories,
  type ProductFilters,
} from "@/lib/api";
import { num } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { KpiStat } from "@/components/ui/kpi-stat";
import { Card } from "@/components/ui/card";
import { Input, Select, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { ProductDetailDrawer } from "@/components/products/product-detail-drawer";
import type { ProductListItem } from "@/lib/types";

const LIMIT = 50;

type Toggle = "all" | "mapped_only" | "override_only" | "unmapped_only";

export default function ProductosPage() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [toggle, setToggle] = useState<Toggle>("all");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  // Debounce de la búsqueda
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset de paginación al cambiar filtros (durante el render, sin efecto)
  const filterSig = `${q}|${department}|${category}|${subcategory}|${toggle}`;
  const [prevSig, setPrevSig] = useState(filterSig);
  if (filterSig !== prevSig) {
    setPrevSig(filterSig);
    setOffset(0);
  }

  const summary = useQuery({
    queryKey: ["products-summary"],
    queryFn: ({ signal }) => getProductsSummary(signal),
  });

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: ({ signal }) => getDepartments(signal),
    staleTime: 5 * 60_000,
  });

  const categories = useQuery({
    queryKey: ["categories", department],
    queryFn: ({ signal }) => {
      const dep = departments.data?.find((d) => d.name === department);
      return getCategories(dep?.id, signal);
    },
    enabled: !!department && !!departments.data,
    staleTime: 5 * 60_000,
  });

  const subcategories = useQuery({
    queryKey: ["subcategories", category],
    queryFn: ({ signal }) => {
      const cat = categories.data?.find((c) => c.name === category);
      return getSubcategories(cat?.id, signal);
    },
    enabled: !!category && !!categories.data,
    staleTime: 5 * 60_000,
  });

  const filters: ProductFilters = useMemo(
    () => ({
      q: q || undefined,
      department: department || undefined,
      category: category || undefined,
      subcategory: subcategory || undefined,
      mapped_only: toggle === "mapped_only" || undefined,
      override_only: toggle === "override_only" || undefined,
      unmapped_only: toggle === "unmapped_only" || undefined,
      limit: LIMIT,
      offset,
    }),
    [q, department, category, subcategory, toggle, offset],
  );

  const products = useQuery({
    queryKey: ["products", filters],
    queryFn: ({ signal }) => getProducts(filters, signal),
    placeholderData: keepPreviousData,
  });

  const s = summary.data;

  const columns: Column<ProductListItem>[] = [
    {
      key: "name",
      header: "Producto",
      render: (r) => (
        <div className="min-w-0">
          <p className="line-clamp-1 font-medium text-fg">{r.name}</p>
          {r.skus && (
            <p className="line-clamp-1 font-mono text-[11px] text-faint">
              {r.skus}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "clasificacion",
      header: "Clasificación",
      render: (r) =>
        r.department ? (
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="text-fg">{r.subcategory ?? r.category}</span>
            <span className="text-faint">
              {r.department}
              {r.category ? ` · ${r.category}` : ""}
            </span>
          </div>
        ) : (
          <Badge tone="warning">Sin clasificar</Badge>
        ),
    },
    {
      key: "variantes_count",
      header: "Var.",
      align: "right",
      render: (r) => num(r.variantes_count),
    },
    {
      key: "flags",
      header: "",
      render: (r) => (
        <div className="flex justify-end gap-1">
          {r.has_override && <Badge tone="success">Override</Badge>}
          {r.is_active === false && <Badge tone="neutral">Inactivo</Badge>}
        </div>
      ),
      align: "right",
    },
  ];

  const toggles: { key: Toggle; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "mapped_only", label: "Clasificados" },
    { key: "unmapped_only", label: "Sin clasificar" },
    { key: "override_only", label: "Con override" },
  ];

  return (
    <div>
      <PageHeader
        title="Productos"
        description="Catálogo de productos con su clasificación en la taxonomía interna."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiStat
          label="Productos"
          value={num(s?.total_productos)}
          icon={Package}
          tone="primary"
          loading={summary.isLoading}
          sub={`${num(s?.total_variantes)} variantes`}
        />
        <KpiStat
          label="Tipos mapeados"
          value={num(s?.product_types_mapeados)}
          icon={Layers}
          tone="success"
          loading={summary.isLoading}
          sub={`${num(s?.product_types_total)} en total`}
        />
        <KpiStat
          label="Con override"
          value={num(s?.productos_con_override)}
          icon={Tag}
          tone="violet"
          loading={summary.isLoading}
        />
        <KpiStat
          label="Tipos sin mapear"
          value={num(s?.product_types_sin_mapear)}
          icon={AlertTriangle}
          tone="warning"
          loading={summary.isLoading}
          sub={`${num(s?.productos_huerfanos?.length)} con productos`}
        />
      </div>

      <Card className="mt-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Buscar" className="sm:col-span-2 lg:col-span-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, ID o SKU…"
                className="w-full pl-8"
              />
            </div>
          </Field>
          <Field label="Departamento">
            <Select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setCategory("");
                setSubcategory("");
              }}
            >
              <option value="">Todos</option>
              {(departments.data ?? []).map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoría">
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubcategory("");
              }}
              disabled={!department}
            >
              <option value="">Todas</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subcategoría">
            <Select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              disabled={!category}
            >
              <option value="">Todas</option>
              {(subcategories.data ?? []).map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {toggles.map((t) => (
            <button
              key={t.key}
              onClick={() => setToggle(t.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                toggle === t.key
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="mt-4 space-y-2">
        <DataTable
          columns={columns}
          rows={products.data?.items}
          isLoading={products.isLoading || products.isFetching}
          error={products.error}
          rowKey={(r) => r.bsale_product_id}
          onRowClick={(r) => setSelected(r.bsale_product_id)}
          emptyTitle="Sin resultados"
          emptyHint="Ajusta los filtros o la búsqueda."
        />
        {products.data && products.data.total > 0 && (
          <Pagination
            total={products.data.total}
            limit={LIMIT}
            offset={offset}
            onChange={setOffset}
          />
        )}
      </div>

      <ProductDetailDrawer
        productId={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
