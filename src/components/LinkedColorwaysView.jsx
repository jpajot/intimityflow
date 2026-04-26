import { useState, useEffect, useMemo, useRef } from "react";
import ImageLightbox from "./ImageLightbox";

import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import ListToolbar from "./ListToolbar";
import LinkToProjectModal from "./LinkToProjectModal";
import ViewSelector from "./ViewSelector";
import DataTable from "./DataTable";
import GalleryView from "./GalleryView";

function LinkedColorwayCard({ cw, product, techColor, commColor, allTechColors = [], navigate }) {
  const [lightbox, setLightbox] = useState(false);
  const productImage = product?.images?.[0];
  // Rule: colorway image first, then product image as fallback
  const useProductFallback = !cw.image_url && !!productImage;
  const displayImage = cw.image_url || productImage;

  const linkedHexes = (() => {
    if (!commColor || commColor.sub_type !== "Combined") return null;
    const ids = commColor.linked_technical_color_ids || [];
    const hexes = ids.map((id) => allTechColors.find((t) => t.id === id)?.hex).filter(Boolean);
    return hexes.length > 1 ? hexes : null;
  })();

  return (
    <>
    <div className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
      <div className="aspect-square bg-muted relative">
        {displayImage ?
          <img src={displayImage} alt={cw.color_name} className="w-full h-full object-contain cursor-zoom-in" onClick={() => setLightbox(true)} /> :
          linkedHexes ?
          <div className="w-full h-full flex">
            {linkedHexes.map((h, i) => <div key={i} className="flex-1 h-full" style={{ backgroundColor: h }} />)}
          </div> :

          <div className="w-full h-full" style={{ backgroundColor: cw.color_hex || "#ccc" }} />
          }
        {/* Hex swatch overlay only when using product fallback image */}
        {useProductFallback && cw.color_hex &&
          <div className="absolute bottom-2 left-2 w-6 h-6 rounded-md border-2 border-white shadow-md" style={{ backgroundColor: cw.color_hex }} />
          }
      </div>
      <div className="p-3 space-y-1.5">
        {/* Style name */}
        {product ?
          <button
            type="button"
            onClick={() => navigate(`/products/${product.id}`)}
            className="text-xs font-semibold text-primary hover:underline truncate block w-full text-left">
            
            {product.name}
          </button> :

          <p className="text-xs text-muted-foreground">—</p>
          }
        {/* Colorway name */}
        <p className="text-sm font-medium truncate">{cw.color_name}</p>
        {/* Codes */}
        {cw.colorway_code &&
          <p className="text-xs font-mono text-muted-foreground truncate">{cw.colorway_code}</p>
          }
        {techColor &&
          <p className="text-xs text-muted-foreground truncate">{techColor.code} – {techColor.name}</p>
          }
      </div>
    </div>
    {lightbox && <ImageLightbox src={displayImage} alt={cw.color_name} onClose={() => setLightbox(false)} />}
    </>);

}

// Multi-select dropdown for array fields
function MultiSelectCell({ value = [], onSave, options = [] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value || []);
  const ref = useRef(null);

  useEffect(() => {setSelected(value || []);}, [JSON.stringify(value)]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {if (ref.current && !ref.current.contains(e.target)) {setOpen(false);onSave(selected);}};
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, selected]);

  const toggle = (opt) => {
    setSelected((prev) => prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]);
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
      className="text-left text-xs w-full h-full block px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
        {selected.length ? selected.join(", ") : "—"}
      </button>);

  }

  return (
    <div ref={ref} className="relative z-50">
      <div className="absolute top-0 left-0 min-w-[160px] bg-popover border border-border rounded-lg shadow-lg p-1.5 flex flex-col gap-0.5">
        {options.map((opt) =>
        <button key={opt} type="button"
        onClick={() => toggle(opt)}
        className={`flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors ${
        selected.includes(opt) ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`
        }>
            <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
          selected.includes(opt) ? "bg-primary-foreground border-primary-foreground" : "border-muted-foreground"}`
          }>{selected.includes(opt) && <span className="text-primary text-[10px] leading-none">✓</span>}</span>
            {opt}
          </button>
        )}
        <button type="button" onClick={() => {setOpen(false);onSave(selected);}}
        className="mt-1 text-[10px] text-center text-muted-foreground hover:text-foreground border-t border-border pt-1">Done</button>
      </div>
    </div>);

}

// Inline-edit cell for link entity fields
function LinkCell({ value, onSave, type = "text", options = null }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const ref = useRef(null);

  useEffect(() => {setVal(value ?? "");}, [value]);
  useEffect(() => {if (editing && ref.current) ref.current.focus();}, [editing]);

  const save = () => {setEditing(false);if (val !== (value ?? "")) onSave(val);};

  if (!editing) {
    const display = Array.isArray(value) ? value.length ? value.join(", ") : "—" : value || "—";
    return (
      <button type="button" onClick={() => setEditing(true)}
      className="text-left text-xs w-full h-full block px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
        {display}
      </button>);

  }

  if (options) {
    return (
      <select ref={ref} value={val} onChange={(e) => setVal(e.target.value)}
      onBlur={() => save()}
      className="text-xs border-0 ring-1 ring-primary rounded px-2 py-1.5 bg-background w-full h-full outline-none">
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>);

  }

  return (
    <input ref={ref} type={type === "number" ? "number" : "text"} value={val}
    onChange={(e) => setVal(e.target.value)}
    onBlur={save}
    onKeyDown={(e) => {if (e.key === "Enter") save();if (e.key === "Escape") {setVal(value ?? "");setEditing(false);}}}
    className="text-xs border-0 ring-1 ring-primary rounded px-2 py-1.5 bg-background w-full h-full outline-none" />);

}

const LINK_STATUS_OPTIONS = ["Development", "Confirmed", "Dropped", "On Hold"];
const CHANNEL_LOV_CODE = "ChannelOfTrade";
const CHANNELS_OPTIONS = ["Wholesale", "Retail", "E-commerce", "Outlet", "Travel Retail", "Franchise"];

export default function LinkedColorwaysView({
  colorways, products, techColors, commColors, navigate,
  search, onSearchChange, view, onViewChange, activeColumns, onColumnsChange,
  projectId, allColorways = [], onLinked, onViewRef, activeViewId, onSelectView
}) {
  const [showLink, setShowLink] = useState(false);
  const [linkMap, setLinkMap] = useState({});
  const [channelOptions, setChannelOptions] = useState([]);
  const [tableLightbox, setTableLightbox] = useState(null);
  const [pinnedCols, setPinnedCols] = useState([]);

  useEffect(() => {
    onViewRef?.({ view, setView: onViewChange, activeColumns, setActiveColumns: onColumnsChange, pinnedCols, setPinnedCols });
  }, [view, activeColumns, pinnedCols, onViewRef, onViewChange, onColumnsChange]);

  useEffect(() => {
    base44.entities.TypeOfLOV.filter({ code: CHANNEL_LOV_CODE }).then((types) => {
      if (types.length === 0) return;
      base44.entities.ListOfValues.filter({ type_of_lov_id: types[0].id }).then((vals) => {
        setChannelOptions(vals.map((v) => v.name));
      });
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    base44.entities.ProductColorProjectLink.filter({ project_id: projectId }).then((links) => {
      const map = {};
      links.forEach((l) => {map[l.product_color_id] = l;});
      setLinkMap(map);
    });
  }, [projectId, colorways.length]);

  const saveLinkField = async (colorwayId, field, rawValue) => {
    let value = rawValue;
    if (field === "channels_of_trade") {
      value = typeof rawValue === "string" ? rawValue.split(",").map((s) => s.trim()).filter(Boolean) : rawValue;
    }
    if (field === "forecasted_quantity") value = rawValue === "" ? null : Number(rawValue);

    const existing = linkMap[colorwayId];
    let updated;
    if (existing) {
      updated = await base44.entities.ProductColorProjectLink.update(existing.id, { [field]: value });
      updated = { ...existing, [field]: value };
    } else {
      updated = await base44.entities.ProductColorProjectLink.create({ product_color_id: colorwayId, project_id: projectId, [field]: value });
    }
    setLinkMap((prev) => ({ ...prev, [colorwayId]: updated }));
  };

  const alreadyLinkedIds = useMemo(() => colorways.map((cw) => cw.id), [colorways]);

  const handleUnlink = async (cw) => {
    await base44.entities.ProductColor.update(cw.id, {
      project_ids: (cw.project_ids || []).filter((pid) => pid !== projectId)
    });
    if (onLinked) onLinked();
  };

  const handleLink = async (selectedIds) => {
    for (const cwId of selectedIds) {
      const cw = allColorways.find((c) => c.id === cwId);
      if (!cw) continue;
      // Link project to colorway
      const cwProjects = cw.project_ids || [];
      if (!cwProjects.includes(projectId)) {
        await base44.entities.ProductColor.update(cwId, { project_ids: [...cwProjects, projectId] });
      }
      // Also link project to parent product if not already linked
      const prod = products.find((p) => p.id === cw.product_id);
      if (prod) {
        const prodProjects = prod.project_ids || [];
        if (!prodProjects.includes(projectId)) {
          await base44.entities.Product.update(prod.id, { project_ids: [...prodProjects, projectId] });
        }
      }
    }
    if (onLinked) onLinked();
  };

  const modalItems = useMemo(() => allColorways.map((cw) => {
    const prod = products.find((p) => p.id === cw.product_id);
    return {
      id: cw.id,
      label: cw.color_name || "Unnamed",
      sublabel: [cw.colorway_code, prod?.name].filter(Boolean).join(" · "),
      imageUrl: cw.image_url || prod?.images?.[0],
      colorHex: !cw.image_url && !prod?.images?.[0] ? cw.color_hex : undefined
    };
  }), [allColorways, products]);
  const getProduct = (cw) => products.find((p) => p.id === cw.product_id);
  const getTechColor = (cw) => techColors.find((t) => t.id === cw.linked_tech_color_id);
  const getCommColor = (cw) => commColors.find((c) => c.id === cw.linked_color_id);

  const getLinkedHexes = (cw) => {
    const cc = getCommColor(cw);
    if (!cc || cc.sub_type !== "Combined") return null;
    const hexes = (cc.linked_technical_color_ids || []).map((id) => techColors.find((t) => t.id === id)?.hex).filter(Boolean);
    return hexes.length > 1 ? hexes : null;
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return colorways;
    const q = search.toLowerCase();
    return colorways.filter((cw) => {
      const prod = products.find((p) => p.id === cw.product_id);
      const tc = techColors.find((t) => t.id === cw.linked_tech_color_id);
      return (
        cw.color_name?.toLowerCase().includes(q) ||
        cw.colorway_code?.toLowerCase().includes(q) ||
        prod?.name?.toLowerCase().includes(q) ||
        tc?.code?.toLowerCase().includes(q) ||
        tc?.name?.toLowerCase().includes(q));

    });
  }, [colorways, search, products, techColors]);

  const columns = [
  {
    id: "style_image",
    label: "Style",
    width: 70,
    render: (cw) => {
      const prod = getProduct(cw);
      const img = prod?.images?.[0];
      return img ?
      <div className="w-10 h-10 overflow-hidden cursor-zoom-in" onClick={() => setTableLightbox(img)}>
            <img src={img} alt={prod?.name} className="w-full h-full object-contain" />
          </div> :
      null;
    }
  },
  {
    id: "style_name",
    label: "Style Name",
    width: 160,
    sortKey: (cw) => getProduct(cw)?.name || "",
    render: (cw) => {
      const prod = getProduct(cw);
      return prod ?
      <button
        type="button"
        onClick={() => navigate(`/products/${prod.id}`)}
        className="text-xs font-semibold text-primary hover:underline text-left">
        
            {prod.name}
          </button> :
      "—";
    }
  },
  {
    id: "cw_image",
    label: "Colorway",
    width: 70,
    render: (cw) => {
      if (cw.image_url) return (
        <div className="w-8 h-8 overflow-hidden cursor-zoom-in" onClick={() => setTableLightbox(cw.image_url)}>
            <img src={cw.image_url} alt={cw.color_name} className="rounded-none w-full h-full object-cover" />
          </div>);

      const hexes = getLinkedHexes(cw);
      if (hexes) return (
        <div className="w-8 h-8 overflow-hidden flex">
            {hexes.map((h, i) => <div key={i} className="flex-1 h-full" style={{ backgroundColor: h }} />)}
          </div>);

      return <div className="w-8 h-8" style={{ backgroundColor: cw.color_hex || "#ccc" }} />;
    }
  },
  { id: "style_sub_type", label: "Style: Sub-type", width: 130, sortKey: (cw) => getProduct(cw)?.sub_type || "", render: (cw) => <span className="text-xs text-muted-foreground">{getProduct(cw)?.sub_type || "—"}</span> },
  {
    id: "color_name",
    label: "Color Name",
    width: 150,
    sortKey: (cw) => cw.color_name || "",
    render: (cw) => <span className="font-medium">{cw.color_name}</span>
  },
  {
    id: "comm_code",
    label: "Commercial Code",
    width: 140,
    sortKey: (cw) => getCommColor(cw)?.code || cw.colorway_code || "",
    render: (cw) => {
      const cc = getCommColor(cw);
      return <span className="font-mono text-xs text-muted-foreground">{cc?.code || cw.colorway_code || "—"}</span>;
    }
  },
  {
    id: "comm_color_status",
    label: "Commercial Color",
    width: 150,
    sortKey: (cw) => cw.linked_color_id ? "linked" : "",
    render: (cw) => {
      const cc = getCommColor(cw);
      return cc ?
      <span className="text-xs font-mono text-muted-foreground">{cc.code || cc.color_name}</span> :
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">⚠ Not linked</span>;
    }
  },
  {
    id: "tech_code",
    label: "Technical Code",
    width: 160,
    sortKey: (cw) => getTechColor(cw)?.code || "",
    render: (cw) => {
      const tc = getTechColor(cw);
      if (!tc) return "—";
      return (
        <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: cw.color_hex || "#ccc" }} />
            <span className="text-xs font-mono text-muted-foreground">{tc.code}</span>
          </div>);

    }
  },
  {
    id: "link_forecasted_qty", label: "Fcst. Qty", width: 100,
    render: (cw) => <LinkCell value={linkMap[cw.id]?.forecasted_quantity} type="number" onSave={(v) => saveLinkField(cw.id, "forecasted_quantity", v)} />
  },
  {
    id: "link_channels", label: "Channels of Trade", width: 200,
    render: (cw) =>
    <MultiSelectCell
      value={linkMap[cw.id]?.channels_of_trade || []}
      options={channelOptions}
      onSave={(v) => saveLinkField(cw.id, "channels_of_trade", v)} />


  },
  {
    id: "link_status", label: "Project Status", width: 130,
    render: (cw) => <LinkCell value={linkMap[cw.id]?.status} options={LINK_STATUS_OPTIONS} onSave={(v) => saveLinkField(cw.id, "status", v)} />
  },
  {
    id: "link_notes", label: "Project Notes", width: 200,
    render: (cw) => <LinkCell value={linkMap[cw.id]?.notes} onSave={(v) => saveLinkField(cw.id, "notes", v)} />
  },
  { id: "_unlink", label: "", width: 50, render: (cw) =>
    <button type="button" onClick={() => handleUnlink(cw)} title="Unlink from project" className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
  }];


  const visibleColumns = activeColumns || columns;

  const linkAllFields = [
  { id: "link_forecasted_qty", label: "Fcst. Qty (Project)", getValue: (cw) => linkMap[cw.id]?.forecasted_quantity ?? "—", render: (cw) => linkMap[cw.id]?.forecasted_quantity ?? "—" },
  { id: "link_channels", label: "Channels of Trade (Project)", getValue: (cw) => (linkMap[cw.id]?.channels_of_trade || []).join(", ") || "—", render: (cw) => (linkMap[cw.id]?.channels_of_trade || []).join(", ") || "—" },
  { id: "link_status", label: "Project Status", getValue: (cw) => linkMap[cw.id]?.status || "—", render: (cw) => linkMap[cw.id]?.status || "—" },
  { id: "link_notes", label: "Project Notes", getValue: (cw) => linkMap[cw.id]?.notes || "—", render: (cw) => linkMap[cw.id]?.notes || "—" }];


  if (colorways.length === 0) {
    return (
      <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">No colorways linked to this project yet.</p>
      </div>);

  }

  return (
    <div className="space-y-4">
      <ListToolbar
        search={search}
        onSearch={onSearchChange}
        searchPlaceholder="Search colorways…"
        hideViewToggle
      />

      <LinkToProjectModal
        open={showLink}
        onClose={() => setShowLink(false)}
        title="Link Colorways to Project"
        items={modalItems}
        alreadyLinkedIds={alreadyLinkedIds}
        onSave={handleLink} />
      

      {filtered.length === 0 ?
      <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No results match your search.</p>
        </div> :
      view === "grid" ?
      <GalleryView
        pageKey="project_linked_colorways"
        allFields={[
        ...linkAllFields,
        { id: "style_name", label: "Style", getValue: (cw) => getProduct(cw)?.name || "—", render: (cw) => getProduct(cw)?.name || "—" },
        { id: "color_name", label: "Color", getValue: (cw) => cw.color_name || "—", render: (cw) => cw.color_name || "—" },
        { id: "codes", label: "Codes", getValue: (cw) => (getTechColor(cw)?.code || "") + (cw.colorway_code || ""), render: (cw) => {
            const tc = getTechColor(cw);
            return (
              <div className="flex flex-col gap-0.5">
                  {tc && <span className="text-xs font-mono text-muted-foreground">{tc.code} – {tc.name}</span>}
                  {cw.colorway_code && <span className="text-xs font-mono text-muted-foreground">{cw.colorway_code}</span>}
                </div>);

          } }]
        }
        rows={filtered}
        renderThumbnail={(cw) => {
          const product = getProduct(cw);
          const productImage = product?.images?.[0];
          const useProductFallback = !cw.image_url && !!productImage;
          const displayImage = cw.image_url || productImage;
          const hexes = getLinkedHexes(cw);
          return (
            <div className="relative w-full h-full">
                {displayImage ?
              <img src={displayImage} alt={cw.color_name} className="w-full h-full object-contain" /> :
              hexes ?
              <div className="w-full h-full flex">
                    {hexes.map((h, i) => <div key={i} className="flex-1 h-full" style={{ backgroundColor: h }} />)}
                  </div> :

              <div className="w-full h-full" style={{ backgroundColor: cw.color_hex || "#ccc" }} />
              }
                {useProductFallback && (
              hexes ?
              <div className="absolute bottom-2 left-2 w-6 h-6 rounded-md border-2 border-white shadow-md overflow-hidden flex">
                      {hexes.map((h, i) => <div key={i} className="flex-1 h-full" style={{ backgroundColor: h }} />)}
                    </div> :
              cw.color_hex ?
              <div className="absolute bottom-2 left-2 w-6 h-6 rounded-md border-2 border-white shadow-md" style={{ backgroundColor: cw.color_hex }} /> :
              null)
              }
                {!cw.linked_color_id &&
              <div title="No commercial color linked" className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-600 shadow-sm" />
              }
              </div>);

        }}
        onClickItem={(cw) => navigate(`/products/${getProduct(cw)?.id}`)} /> :


      <DataTable columns={visibleColumns} rows={filtered} hideColumnToggle />
      }

      {tableLightbox && <ImageLightbox src={tableLightbox} onClose={() => setTableLightbox(null)} />}
    </div>);

}