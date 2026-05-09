import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Minus, AlertTriangle } from "lucide-react";

const LINE_COMPARE_FIELDS = [
  { key: "component_role", label: "Role" },
  { key: "base_quantity", label: "Base Qty" },
  { key: "uom", label: "UOM" },
  { key: "varies_by_color", label: "Varies by color" },
  { key: "varies_by_size", label: "Varies by size" },
  { key: "varies_by_supplier", label: "Varies by supplier" },
  { key: "varies_by_color_and_more", label: "Varies by more" },
  { key: "is_phantom", label: "Phantom" },
  { key: "notes", label: "Notes" },
];

function matchLines(leftLines, rightLines) {
  // Match by component_product_id + component_role (most reliable cross-revision matcher)
  const matched = [];
  const rightUsed = new Set();

  for (const ll of leftLines) {
    const key = `${ll.component_product_id}__${ll.component_role || ""}`;
    const ri = rightLines.findIndex((rl, i) =>
      !rightUsed.has(i) &&
      rl.component_product_id === ll.component_product_id &&
      (rl.component_role || "") === (ll.component_role || "")
    );
    if (ri !== -1) {
      rightUsed.add(ri);
      const rl = rightLines[ri];
      const diffFields = LINE_COMPARE_FIELDS.filter(f => String(ll[f.key] ?? "") !== String(rl[f.key] ?? ""));
      matched.push({ left: ll, right: rl, status: diffFields.length > 0 ? "modified" : "unchanged", diffFields });
    } else {
      matched.push({ left: ll, right: null, status: "removed", diffFields: [] });
    }
  }

  for (let i = 0; i < rightLines.length; i++) {
    if (!rightUsed.has(i)) {
      matched.push({ left: null, right: rightLines[i], status: "added", diffFields: [] });
    }
  }

  // Sort: unchanged first, then modified, then added/removed
  const order = { unchanged: 0, modified: 1, added: 2, removed: 3 };
  return matched.sort((a, b) => order[a.status] - order[b.status]);
}

const STATUS_STYLE = {
  unchanged: { row: "", badge: "bg-slate-100 text-slate-600 border-slate-200", label: "Unchanged" },
  modified: { row: "bg-amber-50/50", badge: "bg-amber-100 text-amber-700 border-amber-300", label: "Modified" },
  added: { row: "bg-green-50/50", badge: "bg-green-100 text-green-700 border-green-300", label: "Added" },
  removed: { row: "bg-red-50/50", badge: "bg-red-100 text-red-700 border-red-300", label: "Removed" },
};

function LineRow({ match, allProducts }) {
  const [expanded, setExpanded] = useState(false);
  const { left, right, status, diffFields } = match;
  const line = left || right;
  const prod = allProducts.find(p => p.id === line.component_product_id);
  const s = STATUS_STYLE[status];

  return (
    <div className={`border-b border-border last:border-0 ${s.row}`}>
      <button
        type="button"
        onClick={() => status === "modified" && setExpanded(v => !v)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${status === "modified" ? "hover:bg-amber-50 cursor-pointer" : "cursor-default"}`}
      >
        {/* Status icon */}
        <div className="shrink-0 w-5 flex justify-center">
          {status === "added" && <Plus className="w-4 h-4 text-green-600" />}
          {status === "removed" && <Minus className="w-4 h-4 text-red-600" />}
          {status === "modified" && (expanded ? <ChevronDown className="w-4 h-4 text-amber-600" /> : <ChevronRight className="w-4 h-4 text-amber-600" />)}
          {status === "unchanged" && <span className="w-4 h-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {line.component_role && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{line.component_role}</span>
            )}
            <span className="text-xs font-medium text-foreground truncate">
              {prod ? `${prod.code || ""} ${prod.name}`.trim() : line.component_product_id}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Pos {left?.position ?? right?.position ?? "—"} · Qty {line.base_quantity ?? "—"} {line.uom || ""}
          </p>
        </div>

        <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${s.badge}`}>{s.label}</span>
        {status === "modified" && (
          <span className="text-[10px] text-muted-foreground shrink-0">{diffFields.length} field{diffFields.length !== 1 ? "s" : ""}</span>
        )}
      </button>

      {/* Expanded field diff */}
      {expanded && status === "modified" && (
        <div className="px-12 pb-3">
          <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Field</th>
                <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Left</th>
                <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Right</th>
              </tr>
            </thead>
            <tbody>
              {diffFields.map(f => (
                <tr key={f.key} className="border-b border-border last:border-0 bg-amber-50">
                  <td className="px-3 py-1.5 text-muted-foreground">{f.label}</td>
                  <td className="px-3 py-1.5 font-medium">{String(left[f.key] ?? "—")}</td>
                  <td className="px-3 py-1.5 font-medium">{String(right[f.key] ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function BomDiffLines({ leftLines, rightLines, allProducts }) {
  const matched = matchLines(leftLines, rightLines);
  const [collapsed, setCollapsed] = useState(false);

  const addedCount = matched.filter(m => m.status === "added").length;
  const removedCount = matched.filter(m => m.status === "removed").length;
  const modifiedCount = matched.filter(m => m.status === "modified").length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {collapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          <span className="font-semibold text-sm">BOM Lines</span>
          <span className="text-xs text-muted-foreground">{matched.length} lines</span>
          {addedCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300">+{addedCount}</span>}
          {removedCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300">−{removedCount}</span>}
          {modifiedCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">~{modifiedCount}</span>}
        </div>
      </button>

      {!collapsed && (
        <div>
          {matched.length === 0 ? (
            <p className="px-4 py-6 text-xs text-muted-foreground text-center">No BOM lines found.</p>
          ) : matched.map((match, i) => (
            <LineRow key={i} match={match} allProducts={allProducts} />
          ))}
        </div>
      )}
    </div>
  );
}