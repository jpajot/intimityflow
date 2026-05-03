import { useState, useMemo } from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";

// ─── Default filter config ──────────────────────────────────────────────────
export const DEFAULT_FILTER_CONFIG = {
  product_color: {
    linked_project_ids: [],
    status: [],
    tech_color_groups: [],
    specific_technical_color_ids: [],
    specific_commercial_color_ids: [],
    specific_product_color_ids: [],
  },
  size: {
    linked_project_ids: [],
    active_only: true,
    specific_size_ids: [],
  },
  color_and_more: {
    linked_project_ids: [],
    active_only: true,
    specific_color_and_more_ids: [],
  },
  supplier: {
    status: ["active"],
    capabilities: [],
    specific_approved_supplier_ids: [],
  },
};

// ─── Is filter active? ───────────────────────────────────────────────────────
export function isFilterActive(filterConfig) {
  if (!filterConfig) return false;
  const f = { ...DEFAULT_FILTER_CONFIG, ...filterConfig };

  const pcActive = (
    f.product_color?.linked_project_ids?.length > 0 ||
    f.product_color?.status?.length > 0 ||
    f.product_color?.tech_color_groups?.length > 0 ||
    f.product_color?.specific_technical_color_ids?.length > 0 ||
    f.product_color?.specific_commercial_color_ids?.length > 0 ||
    f.product_color?.specific_product_color_ids?.length > 0
  );
  const sizeActive = (
    f.size?.linked_project_ids?.length > 0 ||
    f.size?.active_only === false ||
    f.size?.specific_size_ids?.length > 0
  );
  const camActive = (
    f.color_and_more?.linked_project_ids?.length > 0 ||
    f.color_and_more?.active_only === false ||
    f.color_and_more?.specific_color_and_more_ids?.length > 0
  );
  const supActive = (
    JSON.stringify(f.supplier?.status) !== JSON.stringify(["active"]) ||
    f.supplier?.capabilities?.length > 0 ||
    f.supplier?.specific_approved_supplier_ids?.length > 0
  );

  return pcActive || sizeActive || camActive || supActive;
}

// ─── Apply filter to axis members ────────────────────────────────────────────
export function applyFilterConfig(filterConfig, { colorVariants, styleSizes, colorAndMores, allSizes, techColors, commColors, approvedSuppliers }) {
  const f = { ...DEFAULT_FILTER_CONFIG, ...filterConfig };

  // ProductColor filter
  let filteredColors = colorVariants;
  const pc = f.product_color;
  if (pc.linked_project_ids?.length > 0) {
    filteredColors = filteredColors.filter((c) =>
      (c.project_ids || []).some((pid) => pc.linked_project_ids.includes(pid))
    );
  }
  if (pc.status?.length > 0) {
    filteredColors = filteredColors.filter((c) => pc.status.includes(c.colorway_status || "approved"));
  }
  if (pc.specific_product_color_ids?.length > 0) {
    filteredColors = filteredColors.filter((c) => pc.specific_product_color_ids.includes(c.id));
  }
  if (pc.specific_technical_color_ids?.length > 0) {
    filteredColors = filteredColors.filter((c) => {
      const tcId = resolveTcId(c, commColors);
      return tcId && pc.specific_technical_color_ids.includes(tcId);
    });
  }
  if (pc.specific_commercial_color_ids?.length > 0) {
    filteredColors = filteredColors.filter((c) =>
      c.linked_color_type === "commercial" && pc.specific_commercial_color_ids.includes(c.linked_color_id)
    );
  }
  if (pc.tech_color_groups?.length > 0) {
    filteredColors = filteredColors.filter((c) => {
      const tcId = resolveTcId(c, commColors);
      if (!tcId) return false;
      const tc = techColors.find((t) => t.id === tcId);
      return tc && pc.tech_color_groups.includes(tc.color_group);
    });
  }

  // Size filter
  let filteredSizes = styleSizes;
  const sz = f.size;
  if (sz.active_only) {
    filteredSizes = filteredSizes.filter((s) => s.active !== false);
  }
  if (sz.specific_size_ids?.length > 0) {
    filteredSizes = filteredSizes.filter((s) => sz.specific_size_ids.includes(s.size_id));
  }

  // ColorAndMore filter
  let filteredCam = colorAndMores;
  const cam = f.color_and_more;
  if (cam.active_only) {
    filteredCam = filteredCam.filter((c) => c.active !== false);
  }
  if (cam.specific_color_and_more_ids?.length > 0) {
    filteredCam = filteredCam.filter((c) => cam.specific_color_and_more_ids.includes(c.id));
  }

  return { filteredColors, filteredSizes, filteredCam };
}

function resolveTcId(productColor, commColors) {
  if (productColor.linked_tech_color_id) return productColor.linked_tech_color_id;
  if (productColor.linked_color_type === "commercial" && productColor.linked_color_id) {
    const cc = (commColors || []).find((c) => c.id === productColor.linked_color_id);
    return cc?.main_technical_color_id || null;
  }
  return null;
}

// ─── Multi-select chip control ───────────────────────────────────────────────
function MultiSelect({ options, selected, onChange, placeholder = "Select…" }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() =>
    options.filter((o) =>
      !selected.includes(o.value) &&
      o.label.toLowerCase().includes(search.toLowerCase())
    ),
    [options, selected, search]
  );

  const selectedOptions = options.filter((o) => selected.includes(o.value));

  const toggle = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="relative">
      {/* Selected chips */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {selectedOptions.map((o) => (
            <span key={o.value} className="flex items-center gap-0.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              {o.swatch && (
                <span className="w-2.5 h-2.5 rounded-full mr-0.5 border border-border" style={{ backgroundColor: o.swatch }} />
              )}
              {o.label}
              <button type="button" onClick={() => toggle(o.value)} className="ml-0.5 hover:text-destructive">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => onChange([])} className="text-[10px] text-muted-foreground hover:text-destructive">
            Clear all
          </button>
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between h-7 px-2 text-xs border border-input rounded bg-background hover:bg-muted text-left"
      >
        <span className="text-muted-foreground truncate">
          {selectedOptions.length === 0 ? placeholder : `${selectedOptions.length} selected`}
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 ml-1" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[10001] mt-1 w-full bg-popover border border-border rounded shadow-lg max-h-48 overflow-y-auto">
          <div className="p-1 border-b border-border">
            <input
              className="w-full text-xs px-2 py-1 bg-background border border-input rounded outline-none"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">{options.length === 0 ? "(no options available)" : "No matches"}</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { toggle(o.value); setSearch(""); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted text-left"
              >
                {o.swatch && (
                  <span className="w-3 h-3 rounded-full shrink-0 border border-border" style={{ backgroundColor: o.swatch }} />
                )}
                <span className="flex-1 truncate">{o.label}</span>
                {o.sub && <span className="text-muted-foreground text-[10px]">{o.sub}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Filter row label ─────────────────────────────────────────────────────────
function FilterRow({ label, children }) {
  return (
    <div className="space-y-0.5">
      <label className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BOMQuickFilterGroup({
  expanded,
  onToggle,
  filterConfig,
  onFilterChange,
  columnAxis,
  secondaryAxis,
  colorVariants = [],
  styleSizes = [],
  colorAndMores = [],
  techColors = [],
  commColors = [],
  projects = [],
  allSizes = [],
}) {
  const f = useMemo(() => ({ ...DEFAULT_FILTER_CONFIG, ...filterConfig }), [filterConfig]);
  const active = isFilterActive(f);

  // Axes in play
  const axesInPlay = new Set();
  axesInPlay.add(columnAxis);
  if (secondaryAxis) axesInPlay.add(secondaryAxis);

  const showColor = axesInPlay.has("color");
  const showSize = axesInPlay.has("size");
  const showCam = axesInPlay.has("color_and_more");
  const showSupplier = axesInPlay.has("supplier");

  const updatePc = (patch) => onFilterChange({ ...f, product_color: { ...f.product_color, ...patch } });
  const updateSz = (patch) => onFilterChange({ ...f, size: { ...f.size, ...patch } });
  const updateCam = (patch) => onFilterChange({ ...f, color_and_more: { ...f.color_and_more, ...patch } });

  // ── Options builders (scoped to actual data) ─────────────────────────────

  // Projects linked to the parent product's colorways
  const colorwayProjectIds = useMemo(() => {
    const ids = new Set();
    colorVariants.forEach((c) => (c.project_ids || []).forEach((pid) => ids.add(pid)));
    return ids;
  }, [colorVariants]);

  const projectOptions = useMemo(() =>
    projects.filter((p) => colorwayProjectIds.has(p.id))
      .map((p) => ({ value: p.id, label: p.name })),
    [projects, colorwayProjectIds]
  );

  const colorwayStatusOptions = useMemo(() => {
    const statuses = new Set(colorVariants.map((c) => c.colorway_status || "approved"));
    const LABELS = { requested: "Requested", in_progress: "In Progress", submitted_for_approval: "Submitted", approved: "Approved", rejected: "Rejected", obsolete: "Obsolete" };
    return [...statuses].map((s) => ({ value: s, label: LABELS[s] || s }));
  }, [colorVariants]);

  const productColorOptions = useMemo(() =>
    colorVariants.map((c) => ({ value: c.id, label: [c.colorway_code, c.color_name].filter(Boolean).join(" "), swatch: c.color_hex })),
    [colorVariants]
  );

  // TC groups
  const tcGroupOptions = useMemo(() => {
    const groups = new Set();
    colorVariants.forEach((c) => {
      const tcId = resolveTcId(c, commColors);
      if (tcId) {
        const tc = techColors.find((t) => t.id === tcId);
        if (tc?.color_group) groups.add(tc.color_group);
      }
    });
    return [...groups].map((g) => ({ value: g, label: g }));
  }, [colorVariants, techColors, commColors]);

  // Specific TCs scoped
  const tcOptions = useMemo(() => {
    const tcIds = new Set();
    colorVariants.forEach((c) => {
      const tcId = resolveTcId(c, commColors);
      if (tcId) tcIds.add(tcId);
    });
    return [...tcIds].map((tcId) => {
      const tc = techColors.find((t) => t.id === tcId);
      return tc ? { value: tc.id, label: `${tc.code} ${tc.name}`, swatch: tc.hex } : null;
    }).filter(Boolean);
  }, [colorVariants, techColors, commColors]);

  // Specific CCs scoped
  const ccOptions = useMemo(() => {
    const ccIds = new Set(
      colorVariants.filter((c) => c.linked_color_type === "commercial" && c.linked_color_id).map((c) => c.linked_color_id)
    );
    return [...ccIds].map((ccId) => {
      const cc = commColors.find((c) => c.id === ccId);
      return cc ? { value: cc.id, label: cc.name } : null;
    }).filter(Boolean);
  }, [colorVariants, commColors]);

  // Size options (scoped to this product's style sizes)
  const sizeOptions = useMemo(() =>
    styleSizes.filter((s) => s.active !== false).map((ss) => {
      const s = allSizes.find((sz) => sz.id === ss.size_id);
      return { value: ss.size_id, label: s?.name || s?.size_code || ss.size_id };
    }),
    [styleSizes, allSizes]
  );

  // CAM options
  const camOptions = useMemo(() =>
    colorAndMores.map((c) => ({ value: c.id, label: c.name || `Variant ${c.sequence}` })),
    [colorAndMores]
  );

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-1 group"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
          Quick filter
          {active && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
          )}
        </span>
        {expanded
          ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
        }
      </button>

      {expanded && (
        <div className="mt-2 space-y-3 px-1">

          {/* ProductColor filters */}
          {showColor && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-primary/80">Colorway axis</p>

              <FilterRow label="Linked project">
                <MultiSelect
                  options={projectOptions}
                  selected={f.product_color.linked_project_ids}
                  onChange={(v) => updatePc({ linked_project_ids: v })}
                  placeholder="All projects…"
                />
              </FilterRow>

              <FilterRow label="Status">
                <MultiSelect
                  options={colorwayStatusOptions}
                  selected={f.product_color.status}
                  onChange={(v) => updatePc({ status: v })}
                  placeholder="All statuses…"
                />
              </FilterRow>

              {tcGroupOptions.length > 0 && (
                <FilterRow label="TechnicalColor family">
                  <MultiSelect
                    options={tcGroupOptions}
                    selected={f.product_color.tech_color_groups}
                    onChange={(v) => updatePc({ tech_color_groups: v })}
                    placeholder="All color families…"
                  />
                </FilterRow>
              )}

              {tcOptions.length > 0 && (
                <FilterRow label="Specific TechnicalColors">
                  <MultiSelect
                    options={tcOptions}
                    selected={f.product_color.specific_technical_color_ids}
                    onChange={(v) => updatePc({ specific_technical_color_ids: v })}
                    placeholder="All TCXes…"
                  />
                </FilterRow>
              )}

              {ccOptions.length > 0 && (
                <FilterRow label="Specific CommercialColors">
                  <MultiSelect
                    options={ccOptions}
                    selected={f.product_color.specific_commercial_color_ids}
                    onChange={(v) => updatePc({ specific_commercial_color_ids: v })}
                    placeholder="All commercial colors…"
                  />
                </FilterRow>
              )}

              <FilterRow label="Specific colorways">
                <MultiSelect
                  options={productColorOptions}
                  selected={f.product_color.specific_product_color_ids}
                  onChange={(v) => updatePc({ specific_product_color_ids: v })}
                  placeholder="All colorways…"
                />
              </FilterRow>
            </div>
          )}

          {/* Size filters */}
          {showSize && (
            <div className="space-y-2">
              {showColor && <hr className="border-border" />}
              <p className="text-[10px] font-semibold text-green-700">Size axis</p>

              <div className="flex items-center justify-between">
                <label className="text-[10px] text-muted-foreground cursor-pointer" htmlFor="size-active-toggle">Active only</label>
                <Switch
                  id="size-active-toggle"
                  checked={f.size.active_only}
                  onCheckedChange={(v) => updateSz({ active_only: v })}
                />
              </div>

              <FilterRow label="Specific sizes">
                <MultiSelect
                  options={sizeOptions}
                  selected={f.size.specific_size_ids}
                  onChange={(v) => updateSz({ specific_size_ids: v })}
                  placeholder="All sizes…"
                />
              </FilterRow>
            </div>
          )}

          {/* ColorAndMore filters */}
          {showCam && (
            <div className="space-y-2">
              {(showColor || showSize) && <hr className="border-border" />}
              <p className="text-[10px] font-semibold text-orange-700">Color & More axis</p>

              <div className="flex items-center justify-between">
                <label className="text-[10px] text-muted-foreground cursor-pointer" htmlFor="cam-active-toggle">Active only</label>
                <Switch
                  id="cam-active-toggle"
                  checked={f.color_and_more.active_only}
                  onCheckedChange={(v) => updateCam({ active_only: v })}
                />
              </div>

              <FilterRow label="Specific variants">
                <MultiSelect
                  options={camOptions}
                  selected={f.color_and_more.specific_color_and_more_ids}
                  onChange={(v) => updateCam({ specific_color_and_more_ids: v })}
                  placeholder="All variants…"
                />
              </FilterRow>
            </div>
          )}

          {/* Clear all */}
          {active && (
            <button
              type="button"
              onClick={() => onFilterChange(DEFAULT_FILTER_CONFIG)}
              className="w-full text-xs text-destructive hover:underline text-left pt-1"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}