import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Zap, LayoutGrid, List, FileDown, BarChart2, Search } from "lucide-react";
import DataTable from "./DataTable";
import GalleryView from "./GalleryView";
import ViewSelector from "./ViewSelector";
import ImageLightbox from "./ImageLightbox";
import * as XLSX from "xlsx";

// Inline number edit cell
function NumberCell({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const ref = useRef(null);

  useEffect(() => { setVal(value ?? ""); }, [value]);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const save = () => {
    setEditing(false);
    const num = val === "" ? null : Number(val);
    if (num !== (value ?? null)) onSave(num);
  };

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)}
        className="text-left text-xs w-full h-full block px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
        {value != null ? value : "—"}
      </button>
    );
  }
  return (
    <input ref={ref} type="number" value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(value ?? ""); setEditing(false); } }}
      className="text-xs border-0 ring-1 ring-primary rounded px-2 py-1.5 bg-background w-full h-full outline-none" />
  );
}

import { applyQuickFilters } from "./QuickFiltersPanel";

export default function DCperCOTTab({ projectId, linkedVariations, allVariations, colorways, products, techColors = [], commColors = [], onGenerateRef, onExportRef, onImportRef, onViewRef, activeViewId, onSelectView, quickFilters = [] }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDC, setFilterDC] = useState("all");
  const [filterCoT, setFilterCoT] = useState("all");
  const [view, setView] = useState("list");
  const [activeColumns, setActiveColumns] = useState(null);
  const [pinnedCols, setPinnedCols] = useState([]);
  const [linkMap, setLinkMap] = useState({});
  const [selectedForExport, setSelectedForExport] = useState(new Set());
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [tableLightbox, setTableLightbox] = useState(null);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    onGenerateRef?.(handleGenerate);
    onExportRef?.(handleExport);
    onImportRef?.(() => {
      const fileInput = document.querySelector('[data-dc-import-input]');
      fileInput?.click();
    });
    onViewRef?.({ view, setView: (v) => { setView(v); }, activeColumns, setActiveColumns, pinnedCols, setPinnedCols });
  }, [view, activeColumns, pinnedCols]);

  useEffect(() => {
    if (importFile) {
      handleImportFile();
    }
  }, [importFile]);

  useEffect(() => {
    if (!projectId) return;
    loadItems();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    base44.entities.ProductColorAndMoreProjectLink.filter({ project_id: projectId }).then((links) => {
      const map = {};
      links.forEach((l) => { map[l.id] = l; });
      setLinkMap(map);
    });
  }, [projectId, items.length]);

  const loadItems = async () => {
    setLoading(true);
    const rows = await base44.entities.ProductColorAndMoreProjectDCperCOTLink.filter({ project_id: projectId });
    setItems(rows);
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const links = await base44.entities.ProductColorAndMoreProjectLink.filter({ project_id: projectId });
    const existing = await base44.entities.ProductColorAndMoreProjectDCperCOTLink.filter({ project_id: projectId });
    const existingKeys = new Set(existing.map((e) => `${e.project_link_id}__${e.distribution_channel}__${e.channel_of_trade}`));
    const toCreate = [];
    for (const link of links) {
      const dcs = link.distribution_channels || [];
      const cots = link.channels_of_trade || [];
      for (const dc of dcs) {
        for (const cot of cots) {
          const key = `${link.id}__${dc}__${cot}`;
          if (!existingKeys.has(key)) {
            toCreate.push({ project_link_id: link.id, project_id: projectId, distribution_channel: dc, channel_of_trade: cot });
            existingKeys.add(key);
          }
        }
      }
    }
    if (toCreate.length > 0) {
      const created = await Promise.all(toCreate.map((d) => base44.entities.ProductColorAndMoreProjectDCperCOTLink.create(d)));
      setItems((prev) => [...prev, ...created]);
    }
    setGenerating(false);
  };

  const updateForecast = async (itemId, value) => {
    await base44.entities.ProductColorAndMoreProjectDCperCOTLink.update(itemId, { forecasted_quantity: value });
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, forecasted_quantity: value } : i));
  };

  const getVariationForLink = useCallback((linkId) => {
    const link = linkMap[linkId];
    if (!link) return null;
    return allVariations.find((v) => v.id === link.product_color_and_more_id) || null;
  }, [linkMap, allVariations]);

  const getColorway = useCallback((v) => v ? colorways.find((cw) => cw.id === v.product_color_id) : null, [colorways]);

  const getProduct = useCallback((v) => {
    const cw = getColorway(v);
    return cw ? products.find((p) => p.id === cw.product_id) : null;
  }, [getColorway, products]);

  const getMainTechColor = useCallback((cw) => {
    if (!cw) return null;
    const comm = commColors.find((c) => c.id === cw.linked_color_id);
    const techId = comm?.main_technical_color_id || cw.linked_tech_color_id;
    return techId ? (techColors.find((t) => t.id === techId) || null) : null;
  }, [commColors, techColors]);

  const allDCs = useMemo(() => [...new Set(items.map((i) => i.distribution_channel).filter(Boolean))].sort(), [items]);
  const allCoTs = useMemo(() => [...new Set(items.map((i) => i.channel_of_trade).filter(Boolean))].sort(), [items]);

  const filtered = useMemo(() => {
    // Enrich items with denormalized fields for quick filter access
    const enriched = items.map((item) => {
      const v = getVariationForLink(item.project_link_id);
      const cw = getColorway(v);
      const prod = getProduct(v);
      return {
        ...item,
        _style_name: prod?.name || "",
        _pack_code: v?.pack_code || "",
        _variant: v?.variant || "",
        _color_name: cw?.color_name || "",
      };
    });

    let result = enriched.filter((item) => {
      if (filterDC !== "all" && item.distribution_channel !== filterDC) return false;
      if (filterCoT !== "all" && item.channel_of_trade !== filterCoT) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.distribution_channel?.toLowerCase().includes(q) ||
        item.channel_of_trade?.toLowerCase().includes(q) ||
        item._style_name.toLowerCase().includes(q) ||
        item._pack_code.toLowerCase().includes(q) ||
        item._color_name.toLowerCase().includes(q)
      );
    });

    return applyQuickFilters(result, quickFilters);
  }, [items, search, filterDC, filterCoT, getVariationForLink, getColorway, getProduct, quickFilters]);

  const allFields = useMemo(() => [
    {
      id: "style_image", label: "Style Image",
      getValue: () => "",
      render: (item) => {
        const prod = getProduct(getVariationForLink(item.project_link_id));
        const img = prod?.images?.[0];
        return img
          ? <div className="w-10 h-10 overflow-hidden cursor-zoom-in" onClick={() => setTableLightbox(img)}><img src={img} alt="" className="w-full h-full object-contain" /></div>
          : null;
      },
    },
    {
      id: "style_name", label: "Style Name",
      getValue: (item) => getProduct(getVariationForLink(item.project_link_id))?.name || "",
      render: (item) => <span className="text-xs font-semibold">{getProduct(getVariationForLink(item.project_link_id))?.name || "—"}</span>,
    },
    {
      id: "style_code", label: "Style Code",
      getValue: (item) => getProduct(getVariationForLink(item.project_link_id))?.code || "",
      render: (item) => <span className="font-mono text-xs text-muted-foreground">{getProduct(getVariationForLink(item.project_link_id))?.code || "—"}</span>,
    },
    {
      id: "style_type", label: "Style Type",
      getValue: (item) => getProduct(getVariationForLink(item.project_link_id))?.type || "",
      render: (item) => <span className="text-xs">{getProduct(getVariationForLink(item.project_link_id))?.type || "—"}</span>,
    },
    {
      id: "style_category", label: "Style Category",
      getValue: (item) => getProduct(getVariationForLink(item.project_link_id))?.category || "",
      render: (item) => <span className="text-xs">{getProduct(getVariationForLink(item.project_link_id))?.category || "—"}</span>,
    },
    {
      id: "style_sub_category", label: "Style Sub-Category",
      getValue: (item) => getProduct(getVariationForLink(item.project_link_id))?.sub_category || "",
      render: (item) => <span className="text-xs">{getProduct(getVariationForLink(item.project_link_id))?.sub_category || "—"}</span>,
    },
    {
      id: "style_sub_type", label: "Style Sub-type",
      getValue: (item) => getProduct(getVariationForLink(item.project_link_id))?.sub_type || "",
      render: (item) => <span className="text-xs text-muted-foreground">{getProduct(getVariationForLink(item.project_link_id))?.sub_type || "—"}</span>,
    },
    {
      id: "style_customer_need", label: "Style Customer Need",
      getValue: (item) => getProduct(getVariationForLink(item.project_link_id))?.customer_need || "",
      render: (item) => <span className="text-xs">{getProduct(getVariationForLink(item.project_link_id))?.customer_need || "—"}</span>,
    },
    {
      id: "style_description", label: "Style Description",
      getValue: (item) => getProduct(getVariationForLink(item.project_link_id))?.description || "",
      render: (item) => <span className="text-xs text-muted-foreground truncate">{getProduct(getVariationForLink(item.project_link_id))?.description || "—"}</span>,
    },
    {
      id: "colorway_image", label: "Colorway Image",
      getValue: () => "",
      render: (item) => {
        const cw = getColorway(getVariationForLink(item.project_link_id));
        return cw?.image_url
          ? <div className="w-8 h-8 overflow-hidden cursor-zoom-in" onClick={() => setTableLightbox(cw.image_url)}><img src={cw.image_url} alt="" className="w-full h-full object-contain" /></div>
          : <div className="w-8 h-8" style={{ backgroundColor: cw?.color_hex || "#ccc" }} />;
      },
    },
    {
      id: "colorway_name", label: "Colorway Name",
      getValue: (item) => getColorway(getVariationForLink(item.project_link_id))?.color_name || "",
      render: (item) => {
        const cw = getColorway(getVariationForLink(item.project_link_id));
        return (
          <div className="flex items-center gap-1.5">
            {cw && <div className="w-3.5 h-3.5 rounded-sm border border-border shrink-0" style={{ backgroundColor: cw.color_hex || "#ccc" }} />}
            <span className="text-xs">{cw?.color_name || "—"}</span>
          </div>
        );
      },
    },
    {
      id: "colorway_code", label: "Colorway Code",
      getValue: (item) => getColorway(getVariationForLink(item.project_link_id))?.colorway_code || "",
      render: (item) => <span className="font-mono text-xs text-muted-foreground">{getColorway(getVariationForLink(item.project_link_id))?.colorway_code || "—"}</span>,
    },
    {
      id: "tech_color", label: "Technical Color",
      getValue: (item) => {
        const tc = getMainTechColor(getColorway(getVariationForLink(item.project_link_id)));
        return tc ? `${tc.code} ${tc.name}` : "";
      },
      render: (item) => {
        const tc = getMainTechColor(getColorway(getVariationForLink(item.project_link_id)));
        return tc
          ? <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-sm border border-border shrink-0" style={{ backgroundColor: tc.hex || "#ccc" }} />
              <span className="text-xs font-mono">{tc.code}</span>
              <span className="text-xs text-muted-foreground">{tc.name}</span>
            </div>
          : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "sequence", label: "Seq.",
      getValue: (item) => getVariationForLink(item.project_link_id)?.sequence || "",
      render: (item) => <span className="font-mono text-xs text-muted-foreground">{getVariationForLink(item.project_link_id)?.sequence || "—"}</span>,
    },
    {
      id: "pack_code", label: "Pack Code",
      getValue: (item) => getVariationForLink(item.project_link_id)?.pack_code || "",
      render: (item) => <span className="text-xs text-muted-foreground">{getVariationForLink(item.project_link_id)?.pack_code || "—"}</span>,
    },
    {
      id: "variant", label: "Variant",
      getValue: (item) => getVariationForLink(item.project_link_id)?.variant || "",
      render: (item) => <span className="text-xs text-muted-foreground">{getVariationForLink(item.project_link_id)?.variant || "—"}</span>,
    },
    {
      id: "distribution_channel", label: "Distribution Channel",
      getValue: (item) => item.distribution_channel || "",
      render: (item) => <span className="text-xs font-medium">{item.distribution_channel}</span>,
    },
    {
      id: "channel_of_trade", label: "Channel of Trade",
      getValue: (item) => item.channel_of_trade || "",
      render: (item) => <span className="text-xs font-medium">{item.channel_of_trade}</span>,
    },
    {
      id: "forecasted_quantity", label: "Forecast Qty",
      getValue: (item) => item.forecasted_quantity ?? "",
      render: (item) => (
        <NumberCell
          value={item.forecasted_quantity}
          onSave={(val) => {
            updateForecast(item.id, val);
            // Mark as Revised if it was Done
            if (item.forecast_status === "Done") {
              base44.entities.ProductColorAndMoreProjectDCperCOTLink.update(item.id, { forecast_status: "Revised" });
              setItems((prev) =>
                prev.map((i) => i.id === item.id ? { ...i, forecast_status: "Revised" } : i)
              );
            }
          }}
        />
      ),
    },
    {
      id: "forecast_status", label: "Forecast Status",
      getValue: (item) => item.forecast_status || "Not Started",
      render: (item) => {
        const statusColors = {
          "Not Started": "bg-muted text-muted-foreground",
          "In Progress": "bg-blue-100 text-blue-800",
          "Done": "bg-green-100 text-green-800",
          "Revised": "bg-amber-100 text-amber-800",
        };
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[item.forecast_status] || statusColors["Not Started"]}`}>
            {item.forecast_status || "Not Started"}
          </span>
        );
      },
    },
  ], [getVariationForLink, getColorway, getProduct, getMainTechColor]);

  const filterableFields = useMemo(() => [
    { id: "distribution_channel", label: "Distribution Channel", getValue: (item) => item.distribution_channel },
    { id: "channel_of_trade", label: "Channel of Trade", getValue: (item) => item.channel_of_trade },
    { id: "style_name", label: "Style Name", getValue: (item) => getProduct(getVariationForLink(item.project_link_id))?.name },
    { id: "pack_code", label: "Pack Code", getValue: (item) => getVariationForLink(item.project_link_id)?.pack_code },
  ], [getVariationForLink, getProduct]);

  const defaultColumns = useMemo(() => allFields.map((f) => ({
    id: f.id,
    label: f.label,
    width: ["style_image", "colorway_image"].includes(f.id) ? 70 : f.id.includes("name") ? 150 : f.id === "distribution_channel" ? 170 : f.id === "channel_of_trade" ? 150 : 120,
    sortKey: f.getValue,
    render: f.render,
  })), [allFields]);

  const visibleColumns = activeColumns || defaultColumns;

  // Stats calculations
  const totalItems = filtered.length;
  const doneItems = filtered.filter((item) => item.forecast_status === "Done").length;
  const forecastProgress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const qtyByDC = useMemo(() => {
    const map = {};
    filtered.forEach((item) => {
      if (item.forecast_status === "Done") {
        if (!map[item.distribution_channel]) map[item.distribution_channel] = 0;
        map[item.distribution_channel] += item.forecasted_quantity || 0;
      }
    });
    return map;
  }, [filtered]);

  const qtyByCOT = useMemo(() => {
    const map = {};
    filtered.forEach((item) => {
      if (item.forecast_status === "Done") {
        if (!map[item.channel_of_trade]) map[item.channel_of_trade] = 0;
        map[item.channel_of_trade] += item.forecasted_quantity || 0;
      }
    });
    return map;
  }, [filtered]);

  const handleExport = async () => {
    const toExport = selectedForExport.size > 0
      ? filtered.filter((item) => selectedForExport.has(item.id))
      : filtered;

    if (toExport.length === 0) return;

    // Update status to "In Progress" for exported items
    await Promise.all(toExport.map((item) =>
      base44.entities.ProductColorAndMoreProjectDCperCOTLink.update(item.id, { forecast_status: "In Progress" })
    ));

    // Update local state
    setItems((prev) =>
      prev.map((item) =>
        toExport.some((e) => e.id === item.id) ? { ...item, forecast_status: "In Progress" } : item
      )
    );

    const rows = toExport.map((item) => {
      const v = getVariationForLink(item.project_link_id);
      const cw = getColorway(v);
      const prod = getProduct(v);
      const tc = getMainTechColor(cw);
      return {
        "Item ID": item.id,
        "Style Name": prod?.name || "",
        "Style Sub-type": prod?.sub_type || "",
        "Colorway Name": cw?.color_name || "",
        "Colorway Code": cw?.colorway_code || "",
        "Technical Color Code": tc?.code || "",
        "Technical Color Name": tc?.name || "",
        "Sequence": v?.sequence || "",
        "Pack Code": v?.pack_code || "",
        "Variant": v?.variant || "",
        "Distribution Channel": item.distribution_channel || "",
        "Channel of Trade": item.channel_of_trade || "",
        "Forecast Qty": item.forecasted_quantity ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DC per CoT");
    XLSX.writeFile(wb, "dc_per_cot.xlsx");
    setSelectedForExport(new Set());
  };

  const handleImportFile = async () => {
    if (!importFile) return;
    setImporting(true);

    try {
      const buffer = await importFile.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      const updates = [];
      for (const row of rows) {
        const itemId = row["Item ID"];
        const newQty = row["Forecast Qty"];
        if (itemId && newQty !== undefined && newQty !== null && newQty !== "") {
          updates.push({
            id: itemId,
            qty: Number(newQty),
          });
        }
      }

      // Update items in bulk
      await Promise.all(updates.map((u) =>
        base44.entities.ProductColorAndMoreProjectDCperCOTLink.update(u.id, {
          forecasted_quantity: u.qty,
          forecast_status: "Done",
        })
      ));

      // Reload items
      await loadItems();
      setImportFile(null);
    } catch (e) {
      console.error("Import error:", e);
    }

    setImporting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar - Row 1 */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <Select value={filterDC} onValueChange={setFilterDC}>
            <SelectTrigger className="h-8 text-xs flex-1 sm:flex-initial sm:w-40">
              <SelectValue placeholder="DC" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All DC</SelectItem>
              {allDCs.map((dc) => <SelectItem key={dc} value={dc}>{dc}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterCoT} onValueChange={setFilterCoT}>
            <SelectTrigger className="h-8 text-xs flex-1 sm:flex-initial sm:w-40">
              <SelectValue placeholder="CoT" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All CoT</SelectItem>
              {allCoTs.map((cot) => <SelectItem key={cot} value={cot}>{cot}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <button
          type="button"
          onClick={() => {
            const input = document.querySelector('[data-dc-search-input]');
            if (input) {
              input.classList.toggle('hidden');
              if (!input.classList.contains('hidden')) input.focus();
            }
          }}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar - Row 2 (collapsed) */}
      <div className="relative hidden" data-dc-search-input>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8 text-xs" autoFocus />
      </div>

      {/* Toolbar - Row 3 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10"
          onClick={() => setShowStats((v) => !v)}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          Stats
        </Button>

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setImportFile(e.target.files?.[0] || null)}
          className="hidden"
          data-dc-import-input
        />

        {importing && (
          <div className="flex items-center gap-1.5 px-3 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Importing…
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? `No DC per CoT items yet. Make sure variations have Distribution Channels and Channels of Trade set, then click "Generate DC per CoT".`
              : "No results match your search or filters."}
          </p>
        </div>
      ) : view === "list" ? (
        <>
          {showStats && <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
            {/* Forecast Progress */}
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Forecast Progress</div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${forecastProgress}%` }}
                    />
                  </div>
                </div>
                <div className="text-lg font-semibold">{forecastProgress}%</div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {doneItems} of {totalItems} done
              </div>
            </div>

            {/* Qty by DC */}
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="text-xs font-semibold text-muted-foreground mb-3">Total Qty by DC</div>
              <div className="space-y-2">
                {Object.entries(qtyByDC).length > 0 ? (
                  Object.entries(qtyByDC).map(([dc, qty]) => (
                    <div key={dc} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{dc}</span>
                      <span className="font-semibold">{qty.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground">No completed forecasts</div>
                )}
              </div>
            </div>

            {/* Qty by CoT */}
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="text-xs font-semibold text-muted-foreground mb-3">Total Qty by CoT</div>
              <div className="space-y-2">
                {Object.entries(qtyByCOT).length > 0 ? (
                  Object.entries(qtyByCOT).map(([cot, qty]) => (
                    <div key={cot} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{cot}</span>
                      <span className="font-semibold">{qty.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground">No completed forecasts</div>
                )}
              </div>
            </div>
          </div>}

          <DataTable
            columns={[
              {
                id: "_select",
                label: (
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedForExport.size === filtered.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const allIds = new Set(filtered.map((item) => item.id));
                        setSelectedForExport(allIds);
                      } else {
                        setSelectedForExport(new Set());
                      }
                    }}
                    className="w-4 h-4 cursor-pointer"
                  />
                ),
                width: 40,
                render: (row) => (
                  <input
                    type="checkbox"
                    checked={selectedForExport.has(row.id)}
                    onChange={(e) => {
                      const newSet = new Set(selectedForExport);
                      if (e.target.checked) newSet.add(row.id);
                      else newSet.delete(row.id);
                      setSelectedForExport(newSet);
                    }}
                    className="w-4 h-4 cursor-pointer"
                  />
                ),
              },
              ...visibleColumns,
            ]}
            rows={filtered}
            hideColumnToggle
            fixedColumns={pinnedCols}
            onPinColumn={(id) => setPinnedCols((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
          />
        </>
      ) : (
        <GalleryView
          pageKey="dc_per_cot"
          allFields={allFields}
          filterableFields={filterableFields}
          rows={filtered}
          renderThumbnail={(item) => {
            const v = getVariationForLink(item.project_link_id);
            const prod = getProduct(v);
            const cw = getColorway(v);
            const img = v?.image_url || prod?.images?.[0];
            return img
              ? <img src={img} alt="" className="w-full h-full object-contain" />
              : <div className="w-full h-full" style={{ backgroundColor: cw?.color_hex || "#ccc" }} />;
          }}
          onClickItem={() => {}}
        />
        )}

        {tableLightbox && <ImageLightbox src={tableLightbox} onClose={() => setTableLightbox(null)} />}
        </div>
        );
        }