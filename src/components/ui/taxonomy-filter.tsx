"use client";

import { useQuery } from "@tanstack/react-query";
import { getTaxonomyTree } from "@/lib/api";
import { Select, Field } from "./input";

interface TaxonomyFilterProps {
  departamento: string;
  onChangeDepartamento: (v: string) => void;
  categoria: string;
  onChangeCategoria: (v: string) => void;
  subcategoria: string;
  onChangeSubcategoria: (v: string) => void;
}

export function TaxonomyFilter({
  departamento,
  onChangeDepartamento,
  categoria,
  onChangeCategoria,
  subcategoria,
  onChangeSubcategoria,
}: TaxonomyFilterProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["taxonomy-tree"],
    queryFn: ({ signal }) => getTaxonomyTree(signal),
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });

  const arbol = data?.arbol || {};
  const depts = Object.keys(arbol).sort();

  // Get categories of selected department
  const selectedDeptObj = departamento ? arbol[departamento] : null;
  const cats = selectedDeptObj ? Object.keys(selectedDeptObj.categorias).sort() : [];

  // Get subcategories of selected category
  const selectedCatObj = selectedDeptObj && categoria ? selectedDeptObj.categorias[categoria] : null;
  const subcats = selectedCatObj ? selectedCatObj.subcategorias.map(s => s.nombre).sort() : [];

  const handleDeptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onChangeDepartamento(val);
    onChangeCategoria("");
    onChangeSubcategoria("");
  };

  const handleCatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onChangeCategoria(val);
    onChangeSubcategoria("");
  };

  const handleSubcatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onChangeSubcategoria(val);
  };

  if (error) {
    return (
      <div className="text-xs text-danger p-2 border border-danger/20 rounded bg-danger/5">
        Error cargando taxonomía
      </div>
    );
  }

  return (
    <>
      <Field label="Departamento">
        <Select
          value={departamento}
          onChange={handleDeptChange}
          disabled={isLoading || depts.length === 0}
        >
          <option value="">Todos</option>
          {depts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Categoría">
        <Select
          value={categoria}
          onChange={handleCatChange}
          disabled={isLoading || !departamento || cats.length === 0}
        >
          <option value="">Todas</option>
          {cats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Subcategoría">
        <Select
          value={subcategoria}
          onChange={handleSubcatChange}
          disabled={isLoading || !categoria || subcats.length === 0}
        >
          <option value="">Todas</option>
          {subcats.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}
