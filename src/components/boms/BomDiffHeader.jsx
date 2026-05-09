import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";

const HEADER_FIELDS = [
  { key: "product_id", label: "Product" },
  { key: "bom_type", label: "Type" },
  { key: "revision_code", label: "Revision" },
  { key: "version", label: "Version" },
  { key: "status", label: "Status" },
  { key: "released_at", label: "Released At" },
  { key: "released_by", label: "Released By" },
  { key: "valid_from", label: "Valid From" },
  { key: "valid_until", label: "Valid Until" },
  { key: "notes", label: "Notes" },
];

function formatVal(key, val, productMap) {
  if (val === null || val === undefined || val === "") return <span className="text-muted-foreground/50 italic text-xs">—</span>;
  if (key === "product_id") {
    const p = productMap?.[val];
    return p ? `${p.code || ""} ${p.name}`.trim() : val;
  }
  if (key === "released_at" || key === "valid_from" || key === "valid_until") {
    try { return new Date(val).toLocaleDateString(); } catch { return val; }
  }
  if (key === "version") return `v${val}`;
  if (key === "revision_code") return `Rev ${val}`;
  return String(val);
}

export default function BomDiffHeader({ leftBom, rightBom, productMap }) {
  const rows = HEADER_FIELDS.map(f => {
    const lv = leftBom?.[f.key] ?? null;
    const rv = rightBom?.[f.key] ?? null;
    const isDiff = String(lv ?? "") !== String(rv ?? "");
    return { ...f, lv, rv, isDiff };
  });

  const changedCount = rows.filter(r => r.isDiff).length;
  const [collapsed, setCollapsed] = useState(changedCount === 0);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          <span className="font-semibold text-sm">BOM Header</span>
          {changedCount === 0 ? (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> No header changes
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
              {changedCount} field{changedCount !== 1 ? "s" : ""} changed
            </span>
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/10">
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-32">Field</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Left BOM</th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Right BOM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key}
                  className={`border-b border-border last:border-0 ${row.isDiff ? "bg-amber-50" : ""}`}>
                  <td className="px-4 py-2 text-xs font-medium text-muted-foreground">{row.label}</td>
                  <td className={`px-4 py-2 text-xs ${row.isDiff ? "font-medium text-foreground" : "text-foreground"}`}>
                    {formatVal(row.key, row.lv, productMap)}
                  </td>
                  <td className={`px-4 py-2 text-xs ${row.isDiff ? "font-medium text-foreground" : "text-foreground"}`}>
                    {formatVal(row.key, row.rv, productMap)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}