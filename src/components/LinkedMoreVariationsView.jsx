import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LayoutGrid, List, Plus, X } from "lucide-react";
import LinkToProjectModal from "./LinkToProjectModal";
import DataTable from "./DataTable";
import GalleryView from "./GalleryView";
import ViewSelector from "./ViewSelector";

// Multi-select dropdown for array fields — uses portal to escape scroll containers
function MultiSelectCell({ value = [], onSave, options = [] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value || []);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => { setSelected(value || []); }, [JSON.stringify(value)]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
        onSave(selected);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, selected]);

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
  };

  const toggle = (opt) => {
    setSelected((prev) => prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]);
  };

  return (
    <>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        className="text-left text-xs w-full h-full block px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
        {selected.length ? selected.join(", ") : "—"}
      </button>
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="min-w-[160px] bg-popover border border-border rounded-lg shadow-lg p-1.5 flex flex-col gap-0.5"
        >
          {options.map((opt) => (
            <button key={opt} type="button"
              onClick={() => toggle(opt)}
              className={`flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors ${
                selected.includes(opt) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}>
              <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
                selected.includes(opt) ? "bg-primary-foreground border-primary-foreground" : "border-muted-foreground"
              }`}>{selected.includes(opt) && <span className="text-primary text-[10px] leading-none">✓</span>}</span>
              {opt}
            </button>
          ))}
          <button type="button" onClick={() => { setOpen(false); onSave(selected); }}
            className="mt-1 text-[10px] text-center text-muted-foreground hover:text-foreground border-t border-border pt-1">Done</button>
        </div>,
        document.body
      )}
    </>
  );
}

// Inline-edit cell for link entity fields
function LinkCell({ value, onSave, type = "text", options = null }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const ref = useRef(null);

  useEffect(() => { setVal(value ?? ""); }, [value]);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const save = () => { setEditing(false); if (val !== (value ?? "")) onSave(val); };

  if (!editing) {
    const display = Array.isArray(value) ? (value.length ? value.join(", ") : "—") : (value || "—");
    return (
      <button type="button" onClick={() => setEditing(true)}
        className="text-left text-xs w-full h-full block px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
        {display}
      </button>
    );
  }

  if (options) {
    return (
      <select ref={ref} value={val} onChange={(e) => setVal(e.target.value)}
        onBlur={() => save()}
        className="text-xs border-0 ring-1 ring-primary rounded px-2 py-1.5 bg-background w-full h-full outline-none">
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <input ref={ref} type={type === "number" ? "number" : "text"} value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(value ?? ""); setEditing(false); } }}
      className="text-xs border-0 ring-1 ring-primary rounded px-2 py-1.5 bg-background w-full h-full outline-none" />
  );
}

const LINK_STATUS_OPTIONS = ["Development", "Confirmed", "Dropped", "On Hold"];
const CHANNEL_LOV_CODE = "ChannelOfTrade";

export default function LinkedMoreVariationsView({ variations, colorways, products, projects, navigate, projectId, allVariations = [], onLinked }) {
  const [linkMap, setLinkMap] = useState({});
  const [channelOptions, setChannelOptions] = useState([]);

  useEffect(() => {
    base44.entities.TypeOfLOV.list().then((types) => {
      const match = types.find((t) => t.code === CHANNEL_LOV_CODE);
      if (!match) return;
      base44.entities.ListOfValues.filter({ type_of_lov_id: match.id }).then((vals) => {
        setChannelOptions(vals.map((v) => v.name));
      });
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    base44.entities.ProductColorAndMoreProjectLink.filter({ project_id: projectId }).then((links) => {
      const map = {};
      links.forEach((l) => { map[l.product_color_and_more_id] = l; });
      setLinkMap(map);
    });
  }, [projectId, variations.length]);

  const saveLinkField = async (variationId, field, rawValue) => {
    let value = rawValue;
    if (field === "channels_of_trade") {
      value = typeof rawValue === "string" ? rawValue.split(",").map((s) => s.trim()).filter(Boolean) : rawValue;
    }
    if (field === "forecasted_quantity") value = rawValue === "" ? null : Number(rawValue);

    const existing = linkMap[variationId];
    let updated;
    if (existing) {
      updated = { ...existing, [field]: value };
      await base44.entities.ProductColorAndMoreProjectLink.update(existing.id, { [field]: value });
    } else {
      updated = await base44.entities.ProductColorAndMoreProjectLink.create({ product_color_and_more_id: variationId, project_id: projectId, [field]: value });
    }
    setLinkMap((prev) => ({ ...prev, [variationId]: updated }));
  };

  const alreadyLinkedIds = useMemo(() => variations.map((v) => v.id), [variations]);

  const handleUnlink = async (v) => {
    await base44.entities.ProductColorAndMore.update(v.id, {
      project_ids: (v.project_ids || []).filter((pid) => pid !== projectId),
    });
    if (onLinked) onLinked();
  };

  const handleLink = async (selectedIds) => {
    for (const vid of selectedIds) {
      const v = allVariations.find((x) => x.id === vid);
      if (!v) continue;
      // Link project to variation
      const varProjects = v.project_ids || [];
      const updates = {};
      if (!varProjects.includes(projectId)) updates.project_ids = [...varProjects, projectId];
      if (!v.creation_project_id) updates.creation_project_id = projectId;
      if (Object.keys(updates).length > 0) {
        await base44.entities.ProductColorAndMore.update(vid, updates);
      }
      // Also link project to parent colorway if not already linked
      const cw = colorways.find((c) => c.id === v.product_color_id);
      if (cw) {
        const cwProjects = cw.project_ids || [];
        if (!cwProjects.includes(projectId)) {
          await base44.entities.ProductColor.update(cw.id, { project_ids: [...cwProjects, projectId] });
        }
        // Fetch fresh product to get up-to-date project_ids
        if (cw.product_id) {
          const freshProds = await base44.entities.Product.filter({ id: cw.product_id });
          if (freshProds.length > 0) {
            const prod = freshProds[0];
            if (!(prod.project_ids || []).includes(projectId)) {
              await base44.entities.Product.update(prod.id, { project_ids: [...(prod.project_ids || []), projectId] });
            }
          }
        }
      }
    }
    if (onLinked) onLinked();
  };

  const modalItems = useMemo(() => allVariations.map((v) => {
    const cw = colorways.find((c) => c.id === v.product_color_id);
    const prod = cw ? products.find((p) => p.id === cw.product_id) : null;
    return {
      id: v.id,
      label: v.name || `Seq. ${v.sequence}`,
      sublabel: [v.sequence, v.pack_code, cw?.color_name, prod?.name].filter(Boolean).join(" · "),
      imageUrl: v.image_url || prod?.images?.[0],
      colorHex: !v.image_url && !prod?.images?.[0] ? cw?.color_hex : undefined,
    };
  }), [allVariations, colorways, products]);
  const [search, setSearch] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [view, setView] = useState("list");
  const [activeColumns, setActiveColumns] = useState(null);
  const [pinnedCols, setPinnedCols] = useState([]);

  const getColorway = (v) => colorways.find((cw) => cw.id === v.product_color_id);
  const getProduct = (v) => {
    const cw = getColorway(v);
    return cw ? products.find((p) => p.id === cw.product_id) : null;
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return variations;
    const q = search.toLowerCase();
    return variations.filter((v) => {
      const cw = getColorway(v);
      const prod = getProduct(v);
      return (
        v.name?.toLowerCase().includes(q) ||
        v.sequence?.toLowerCase().includes(q) ||
        v.pack_code?.toLowerCase().includes(q) ||
        v.variant?.toLowerCase().includes(q) ||
        cw?.color_name?.toLowerCase().includes(q) ||
        cw?.colorway_code?.toLowerCase().includes(q) ||
        prod?.name?.toLowerCase().includes(q)
      );
    });
  }, [variations, search]);

  const columns = [
    {
      id: "style_image", label: "Style Image", width: 70,
      render: (v) => {
        const prod = getProduct(v);
        const img = prod?.images?.[0];
        return img ? (
          <div className="w-10 h-10 rounded-md overflow-hidden border border-border bg-muted">
            <img src={img} alt={prod.name} className="w-full h-full object-contain" />
          </div>
        ) : <div className="w-10 h-10 rounded-md border border-border bg-muted" />;
      },
    },
    {
      id: "style_name", label: "Style Name", width: 150, sortKey: (v) => getProduct(v)?.name || "",
      render: (v) => {
        const prod = getProduct(v);
        return prod ? (
          <button type="button" onClick={() => navigate(`/products/${prod.id}`)} className="text-xs font-semibold text-primary hover:underline text-left">{prod.name}</button>
        ) : "—";
      },
    },
    {
      id: "cw_image", label: "Colorway", width: 70,
      render: (v) => {
        const cw = getColorway(v);
        return cw?.image_url ? (
          <div className="w-8 h-8 rounded-md overflow-hidden border border-border">
            <img src={cw.image_url} alt={cw.color_name} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-md border border-border" style={{ backgroundColor: cw?.color_hex || "#ccc" }} />
        );
      },
    },
    { id: "style_sub_type", label: "Style: Sub-type", width: 130, sortKey: (v) => getProduct(v)?.sub_type || "", render: (v) => <span className="text-xs text-muted-foreground">{getProduct(v)?.sub_type || "—"}</span> },
    { id: "cw_color_name", label: "Colorway Name", width: 140, sortKey: (v) => getColorway(v)?.color_name || "", render: (v) => <span className="text-xs">{getColorway(v)?.color_name || "—"}</span> },
    { id: "cw_code", label: "Colorway Code", width: 120, sortKey: (v) => getColorway(v)?.colorway_code || "", render: (v) => <span className="font-mono text-xs text-muted-foreground">{getColorway(v)?.colorway_code || "—"}</span> },
    { id: "sequence", label: "Seq.", width: 80, sortKey: (v) => v.sequence || "", render: (v) => <span className="font-mono text-xs text-muted-foreground">{v.sequence || "—"}</span> },
    { id: "name", label: "Variation Name", width: 150, sortKey: (v) => v.name || "", render: (v) => <span className="font-medium">{v.name || "—"}</span> },
    { id: "pack_code", label: "Pack Code", width: 110, sortKey: (v) => v.pack_code || "", render: (v) => <span className="text-xs">{v.pack_code || "—"}</span> },
    { id: "variant", label: "Variant", width: 110, sortKey: (v) => v.variant || "", render: (v) => <span className="text-xs">{v.variant || "—"}</span> },
    { id: "creation_project", label: "Creation Project", width: 160, sortKey: (v) => projects.find((p) => p.id === v.creation_project_id)?.name || "", render: (v) => { const p = projects.find((pr) => pr.id === v.creation_project_id); return <span className="text-xs text-muted-foreground">{p?.name || "—"}</span>; } },
    { id: "linked_projects", label: "Linked Projects", width: 200, render: (v) => { const names = (v.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean); return <span className="text-xs text-muted-foreground">{names.length > 0 ? names.join(", ") : "—"}</span>; } },
    {
      id: "link_forecasted_qty", label: "Fcst. Qty", width: 100,
      render: (v) => <LinkCell value={linkMap[v.id]?.forecasted_quantity} type="number" onSave={(val) => saveLinkField(v.id, "forecasted_quantity", val)} />,
    },
    {
      id: "link_channels", label: "Channels of Trade", width: 200,
      render: (v) => (
        <MultiSelectCell
          value={linkMap[v.id]?.channels_of_trade || []}
          options={channelOptions}
          onSave={(val) => saveLinkField(v.id, "channels_of_trade", val)}
        />
      ),
    },
    {
      id: "link_status", label: "Project Status", width: 130,
      render: (v) => <LinkCell value={linkMap[v.id]?.status} options={LINK_STATUS_OPTIONS} onSave={(val) => saveLinkField(v.id, "status", val)} />,
    },
    {
      id: "link_notes", label: "Project Notes", width: 200,
      render: (v) => <LinkCell value={linkMap[v.id]?.notes} onSave={(val) => saveLinkField(v.id, "notes", val)} />,
    },
    { id: "_unlink", label: "", width: 50, render: (v) => (
      <button type="button" onClick={() => handleUnlink(v)} title="Unlink from project" className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    ) },
  ];

  const filterableFields = [
    { id: "pack_code", label: "Pack Code", getValue: (v) => v.pack_code },
    { id: "variant", label: "Variant", getValue: (v) => v.variant },
    { id: "style_category", label: "Style: Category", getValue: (v) => getProduct(v)?.category },
    { id: "creation_project", label: "Creation Project", getValue: (v) => projects.find((p) => p.id === v.creation_project_id)?.name },
  ];

  const linkAllFields = [
    { id: "link_forecasted_qty", label: "Fcst. Qty (Project)", getValue: (v) => linkMap[v.id]?.forecasted_quantity ?? "—", render: (v) => linkMap[v.id]?.forecasted_quantity ?? "—" },
    { id: "link_channels", label: "Channels of Trade (Project)", getValue: (v) => (linkMap[v.id]?.channels_of_trade || []).join(", ") || "—", render: (v) => (linkMap[v.id]?.channels_of_trade || []).join(", ") || "—" },
    { id: "link_status", label: "Project Status", getValue: (v) => linkMap[v.id]?.status || "—", render: (v) => linkMap[v.id]?.status || "—" },
    { id: "link_notes", label: "Project Notes", getValue: (v) => linkMap[v.id]?.notes || "—", render: (v) => linkMap[v.id]?.notes || "—" },
  ];

  const allFields = [
    ...linkAllFields,
    { id: "linked_projects", label: "Linked Projects", getValue: (v) => (v.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean).join(", ") || "—", render: (v) => (v.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean).join(", ") || "—" },
  ];

  // Always inject fresh channelOptions into the channels column render
  const visibleColumns = (activeColumns || columns).map((col) =>
    col.id === "link_channels"
      ? {
          ...col,
          render: (v) => (
            <MultiSelectCell
              value={linkMap[v.id]?.channels_of_trade || []}
              options={channelOptions}
              onSave={(val) => saveLinkField(v.id, "channels_of_trade", val)}
            />
          ),
        }
      : col
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search variations…" className="pl-8 h-8 text-xs" />
        </div>
        {projectId && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowLink(true)}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        )}
        {view === "list" && (
          <ViewSelector pageKey="project_linked_variations" allColumns={columns} onColumnsChange={setActiveColumns} filterableFields={filterableFields} rows={variations} entityNames={["ProductColorAndMore"]} fixedColumnIds={pinnedCols} onFixedColumnIdsChange={setPinnedCols} />
        )}
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button type="button" onClick={() => setView("grid")} className={`px-2.5 py-1.5 transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Gallery"><LayoutGrid className="w-4 h-4" /></button>
          <button type="button" onClick={() => setView("list")} className={`px-2.5 py-1.5 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Table"><List className="w-4 h-4" /></button>
        </div>
      </div>

      <LinkToProjectModal
        open={showLink}
        onClose={() => setShowLink(false)}
        title="Link Variations to Project"
        items={modalItems}
        alreadyLinkedIds={alreadyLinkedIds}
        onSave={handleLink}
      />

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">{variations.length === 0 ? "No linked variations yet." : "No results match your search."}</p>
        </div>
      ) : view === "grid" ? (
        <GalleryView
          pageKey="project_linked_variations"
          navigate={navigate}
          allFields={[...linkAllFields, ...allFields.filter((f) => !f.id.startsWith("link_"))]}
          filterableFields={filterableFields}
          rows={filtered}
          renderThumbnail={(v) => {
            const prod = getProduct(v);
            const cw = getColorway(v);
            const img = v.image_url || prod?.images?.[0];
            return img ? (
              <img src={img} alt={v.name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: cw?.color_hex || "#ccc" }} />
            );
          }}
          onClickItem={(v) => navigate(`/products/${getProduct(v)?.id}`)}
        />
      ) : (
        <DataTable columns={visibleColumns} rows={filtered} hideColumnToggle fixedColumns={pinnedCols} onPinColumn={(id) => setPinnedCols((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])} />
      )}
    </div>
  );
}