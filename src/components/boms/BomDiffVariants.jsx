import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

// ── Axis detection ─────────────────────────────────────────────────────────────
// For each BOM's set of variants, we determine what axes are populated.
// axis = set of unique column dimensions used across variants.
// We compare both BOMs' axis fingerprints to decide Case A vs Case B.
function detectAxis(variants) {
  const hasColor = variants.some(v => v.product_color_id);
  const hasSize = variants.some(v => v.size_id);
  const hasCam = variants.some(v => v.product_color_and_more_id);
  const hasSupplier = variants.some(v => v.parent_approved_supplier_id);
  // Return primary axis (most populous)
  if (hasColor) return "color";
  if (hasSize) return "size";
  if (hasCam) return "color_and_more";
  if (hasSupplier) return "supplier";
  return "none";
}

function variantKey(v, axis) {
  if (axis === "color") return `${v.bom_line_id}__${v.product_color_id}`;
  if (axis === "size") return `${v.bom_line_id}__${v.size_id}`;
  if (axis === "color_and_more") return `${v.bom_line_id}__${v.product_color_and_more_id}`;
  if (axis === "supplier") return `${v.bom_line_id}__${v.parent_approved_supplier_id}`;
  return v.id;
}

function variantDiffers(lv, rv) {
  const COMPARE_FIELDS = [
    "component_product_color_id", "quantity", "unit_cost_override",
    "currency_override", "lead_time_override_days", "wastage_pct", "is_not_applicable",
    "approved_supplier_id", "component_size_id",
  ];
  return COMPARE_FIELDS.some(f => String(lv[f] ?? "") !== String(rv[f] ?? ""));
}

// ── Matrix diff (Case A) ────────────────────────────────────────────────────────
function MatrixDiff({ leftVariants, rightVariants, axis, allProductColors, allSizes, leftLines, rightLines, allProducts }) {
  const [changedOnly, setChangedOnly] = useState(false);

  const leftMap = useMemo(() => {
    const m = {}; leftVariants.forEach(v => { m[variantKey(v, axis)] = v; }); return m;
  }, [leftVariants, axis]);
  const rightMap = useMemo(() => {
    const m = {}; rightVariants.forEach(v => { m[variantKey(v, axis)] = v; }); return m;
  }, [rightVariants, axis]);

  const allKeys = useMemo(() => new Set([...Object.keys(leftMap), ...Object.keys(rightMap)]), [leftMap, rightMap]);

  const cells = useMemo(() => {
    return [...allKeys].map(k => {
      const lv = leftMap[k];
      const rv = rightMap[k];
      let status;
      if (lv && rv) status = variantDiffers(lv, rv) ? "modified" : "unchanged";
      else if (lv) status = "removed";
      else status = "added";
      return { k, lv, rv, status };
    }).filter(c => !changedOnly || c.status !== "unchanged");
  }, [allKeys, leftMap, rightMap, changedOnly]);

  const colorMap = useMemo(() => { const m = {}; allProductColors.forEach(c => { m[c.id] = c; }); return m; }, [allProductColors]);
  const sizeMap = useMemo(() => { const m = {}; allSizes.forEach(s => { m[s.id] = s; }); return m; }, [allSizes]);
  const lineMap = useMemo(() => {
    const m = {};
    [...leftLines, ...rightLines].forEach(l => { m[l.id] = l; });
    return m;
  }, [leftLines, rightLines]);

  const getLabel = (v) => {
    if (!v) return "—";
    if (axis === "color") {
      const c = colorMap[v.product_color_id];
      return c ? (c.color_name || c.colorway_code || c.id) : v.product_color_id;
    }
    if (axis === "size") {
      const s = sizeMap[v.size_id];
      return s ? (s.name || s.size_code || v.size_id) : v.size_id;
    }
    return v.id;
  };

  const getCompLabel = (v) => {
    if (!v) return null;
    if (axis === "color" && v.component_product_color_id) {
      const c = colorMap[v.component_product_color_id];
      return c ? (c.color_name || c.colorway_code) : v.component_product_color_id;
    }
    return null;
  };

  const getLineName = (v) => {
    const lineId = v?.bom_line_id;
    const line = lineMap[lineId];
    if (!line) return lineId || "—";
    const prod = allProducts.find(p => p.id === line.component_product_id);
    return prod ? `${prod.code || ""} ${prod.name}`.trim() : (line.component_product_id || "—");
  };

  const changed = cells.filter(c => c.status !== "unchanged").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Axis: <strong className="text-foreground capitalize">{axis}</strong></span>
          <span>·</span>
          <span>{cells.length} cell{cells.length !== 1 ? "s" : ""} shown</span>
          {changed > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">{changed} changed</span>}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={changedOnly} onChange={e => setChangedOnly(e.target.checked)} className="w-3 h-3 accent-primary" />
          Show only changed cells
        </label>
      </div>

      <div className="px-4 pb-4">
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-xs min-w-[480px]">
            <thead className="bg-muted/20 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Line</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground capitalize">{axis}</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Left component</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Right component</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {cells.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No variants to display.</td></tr>
              ) : cells.map(({ k, lv, rv, status }) => {
                const display = lv || rv;
                const rowStyle = status === "modified" ? "bg-amber-50" : status === "added" ? "bg-green-50" : status === "removed" ? "bg-red-50" : "";
                const badgeStyle = status === "modified" ? "bg-amber-100 text-amber-700 border-amber-300"
                  : status === "added" ? "bg-green-100 text-green-700 border-green-300"
                  : status === "removed" ? "bg-red-100 text-red-700 border-red-300"
                  : "bg-slate-100 text-slate-600 border-slate-200";
                return (
                  <tr key={k} className={`border-b border-border last:border-0 ${rowStyle}`}>
                    <td className="px-3 py-2 text-[11px] font-medium">{getLineName(display)}</td>
                    <td className="px-3 py-2 text-[11px]">{getLabel(display)}</td>
                    <td className="px-3 py-2 text-[11px]">{lv ? (getCompLabel(lv) || (lv.is_not_applicable ? "N/A" : `qty ${lv.quantity ?? "—"}`)) : <span className="text-muted-foreground/40 italic">—</span>}</td>
                    <td className="px-3 py-2 text-[11px]">{rv ? (getCompLabel(rv) || (rv.is_not_applicable ? "N/A" : `qty ${rv.quantity ?? "—"}`)) : <span className="text-muted-foreground/40 italic">—</span>}</td>
                    <td className="px-3 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeStyle}`}>{status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Per-line fallback (Case B) ──────────────────────────────────────────────────
function PerLineFallback({ leftLines, rightLines, leftVariants, rightVariants, allProducts }) {
  // Match lines same way as BomDiffLines
  const pairs = useMemo(() => {
    const used = new Set();
    const result = [];
    for (const ll of leftLines) {
      const ri = rightLines.findIndex((rl, i) =>
        !used.has(i) && rl.component_product_id === ll.component_product_id &&
        (rl.component_role || "") === (ll.component_role || "")
      );
      if (ri !== -1) { used.add(ri); result.push({ ll, rl: rightLines[ri] }); }
      else result.push({ ll, rl: null });
    }
    rightLines.forEach((rl, i) => { if (!used.has(i)) result.push({ ll: null, rl }); });
    return result;
  }, [leftLines, rightLines]);

  return (
    <div className="px-4 pb-4 space-y-3">
      <p className="text-xs text-muted-foreground italic">Axes differ between BOMs — showing per-line variant summary.</p>
      {pairs.map(({ ll, rl }, i) => {
        const line = ll || rl;
        const prod = allProducts.find(p => p.id === line.component_product_id);
        const lVars = ll ? leftVariants.filter(v => v.bom_line_id === ll.id) : [];
        const rVars = rl ? rightVariants.filter(v => v.bom_line_id === rl.id) : [];
        return (
          <div key={i} className="border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-muted/20 border-b border-border">
              <span className="text-xs font-medium">{prod ? `${prod.code || ""} ${prod.name}`.trim() : line.component_product_id}</span>
              <span className="ml-2 text-[11px] text-muted-foreground">{line.component_role || ""}</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border">
              <div className="p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Left ({lVars.length})</p>
                {lVars.length === 0 ? <p className="text-xs text-muted-foreground italic">—</p> :
                  lVars.map((v, j) => <p key={j} className="text-[11px] text-foreground">{JSON.stringify(v).slice(0, 60)}…</p>)}
              </div>
              <div className="p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Right ({rVars.length})</p>
                {rVars.length === 0 ? <p className="text-xs text-muted-foreground italic">—</p> :
                  rVars.map((v, j) => <p key={j} className="text-[11px] text-foreground">{JSON.stringify(v).slice(0, 60)}…</p>)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function BomDiffVariants({
  leftVariants, rightVariants,
  leftLines, rightLines,
  allProductColors, allSizes, allProducts,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const leftAxis = useMemo(() => detectAxis(leftVariants), [leftVariants]);
  const rightAxis = useMemo(() => detectAxis(rightVariants), [rightVariants]);
  const caseA = leftAxis === rightAxis && leftAxis !== "none";

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          <span className="font-semibold text-sm">Variants</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${caseA ? "bg-green-100 text-green-700 border-green-300" : "bg-orange-100 text-orange-700 border-orange-300"}`}>
            {caseA ? `Case A · matrix (${leftAxis})` : `Case B · per-line fallback (${leftAxis} ≠ ${rightAxis})`}
          </span>
        </div>
      </button>

      {!collapsed && (
        caseA ? (
          <MatrixDiff
            leftVariants={leftVariants}
            rightVariants={rightVariants}
            axis={leftAxis}
            allProductColors={allProductColors}
            allSizes={allSizes}
            leftLines={leftLines}
            rightLines={rightLines}
            allProducts={allProducts}
          />
        ) : (
          <PerLineFallback
            leftLines={leftLines}
            rightLines={rightLines}
            leftVariants={leftVariants}
            rightVariants={rightVariants}
            allProducts={allProducts}
          />
        )
      )}
    </div>
  );
}