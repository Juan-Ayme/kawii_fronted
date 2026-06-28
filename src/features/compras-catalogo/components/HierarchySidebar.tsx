import React from "react";
import { ChevronRight, Folder, FolderOpen, Home, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { money, num } from "@/lib/format";
import { Selection, TreeNode, ROOT_SELECTION } from "../types";
import { DEPT_COLORS } from "../utils";

export function RootNode({
  total,
  active,
  onClick,
}: {
  total: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left",
        "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Home className={cn("h-3.5 w-3.5", active ? "text-primary" : "text-faint group-hover:text-fg")} />
      <span className="flex-1 truncate text-xs font-semibold">
        Todos los departamentos
      </span>
      <span
        className={cn(
          "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
          active ? "bg-primary/20 text-primary" : "bg-surface-3 text-muted",
        )}
      >
        {num(total)}
      </span>
    </button>
  );
}

export function JerarquiaTree({
  tree,
  selection,
  onSelect,
}: {
  tree: TreeNode[];
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  if (tree.length === 0) {
    return <p className="py-2 text-center text-xs text-faint">Sin datos</p>;
  }
  const max = tree[0]?.ventaSoles || 1;
  return (
    <ul className="max-h-[65vh] overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
      {tree.map((dept, i) => (
        <DeptRow
          key={dept.name}
          node={dept}
          colorIdx={i}
          maxVenta={max}
          selection={selection}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

const DeptRow = React.memo(function DeptRow({
  node,
  colorIdx,
  maxVenta,
  selection,
  onSelect,
}: {
  node: TreeNode;
  colorIdx: number;
  maxVenta: number;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const isOpen = selection.dept === node.name;
  const widthPct = Math.max(4, Math.round((node.ventaSoles / maxVenta) * 100));
  return (
    <li>
      <button
        onClick={() =>
          onSelect(
            isOpen
              ? ROOT_SELECTION
              : { dept: node.name, cat: null, subcat: null },
          )
        }
        className={cn(
          "group block w-full rounded-md px-2.5 py-2 text-left transition-colors",
          isOpen ? "bg-primary/10" : "hover:bg-surface-2",
        )}
      >
        <div className="flex items-center gap-2 text-xs">
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 text-faint transition-transform duration-[var(--duration-fast)]",
              isOpen && "rotate-90 text-primary",
            )}
          />
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              DEPT_COLORS[colorIdx % DEPT_COLORS.length],
            )}
          />
          <span
            className={cn(
              "flex-1 truncate font-semibold",
              isOpen ? "text-fg" : "text-fg",
            )}
          >
            {node.name}
          </span>
          <span className="shrink-0 text-faint tabular-nums">{num(node.skus)}</span>
        </div>
        <div className="mt-1 ml-5 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                DEPT_COLORS[colorIdx % DEPT_COLORS.length],
              )}
              style={{ width: `${widthPct}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-muted">
            {money(node.ventaSoles)}
          </span>
        </div>
      </button>

      {isOpen && node.children.length > 0 && (
        <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border-soft pl-2 animate-[fade-in_var(--duration-fast)_var(--ease-premium)_both]">
          {node.children.map((cat) => (
            <CatRow
              key={cat.name}
              dept={node.name}
              node={cat}
              selection={selection}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

const CatRow = React.memo(function CatRow({
  dept,
  node,
  selection,
  onSelect,
}: {
  dept: string;
  node: TreeNode;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const isOpen = selection.cat === node.name && selection.dept === dept;
  const isActive = isOpen && !selection.subcat;
  return (
    <li>
      <button
        onClick={() =>
          onSelect(
            isOpen
              ? { dept, cat: null, subcat: null }
              : { dept, cat: node.name, subcat: null },
          )
        }
        className={cn(
          "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
          isActive ? "bg-primary/15 text-primary" : "hover:bg-surface-2 text-muted",
        )}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 text-faint transition-transform duration-[var(--duration-fast)]",
            isOpen && "rotate-90 text-primary",
          )}
        />
        {isOpen ? (
          <FolderOpen className="h-3 w-3 shrink-0 text-primary" />
        ) : (
          <Folder className="h-3 w-3 shrink-0 text-faint group-hover:text-fg" />
        )}
        <span
          className={cn(
            "flex-1 truncate text-[11px] font-medium",
            isActive ? "text-primary" : "text-fg",
          )}
        >
          {node.name}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-faint">
          {num(node.skus)}
        </span>
      </button>

      {isOpen && node.children.length > 0 && (
        <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border-soft pl-2 animate-[fade-in_var(--duration-fast)_var(--ease-premium)_both]">
          {node.children.map((sub) => (
            <SubcatRow
              key={sub.name}
              dept={dept}
              cat={node.name}
              node={sub}
              selection={selection}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

const SubcatRow = React.memo(function SubcatRow({
  dept,
  cat,
  node,
  selection,
  onSelect,
}: {
  dept: string;
  cat: string;
  node: TreeNode;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const isActive =
    selection.subcat === node.name &&
    selection.cat === cat &&
    selection.dept === dept;
  return (
    <li>
      <button
        onClick={() =>
          onSelect(
            isActive
              ? { dept, cat, subcat: null }
              : { dept, cat, subcat: node.name },
          )
        }
        className={cn(
          "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
          isActive ? "bg-primary/15 text-primary" : "hover:bg-surface-2 text-muted",
        )}
      >
        <Tag
          className={cn(
            "h-3 w-3 shrink-0",
            isActive ? "text-primary" : "text-faint group-hover:text-fg",
          )}
        />
        <span
          className={cn(
            "flex-1 truncate text-[11px]",
            isActive ? "font-semibold text-primary" : "text-fg",
          )}
        >
          {node.name}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-faint">
          {num(node.skus)}
        </span>
      </button>
    </li>
  );
});
