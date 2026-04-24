import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Zap } from "lucide-react";
import DataTable from "./DataTable";

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

export default function DCperCOTTab({ projectId, linkedVariations, allVariations, colorways, products }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!projectId) return;
    loadItems();
  }, [projectId]);

  const loadItems = async () => {
    setLoading(true);
    const rows = await base44.entities.ProductColorAndMoreProjectDCperCOTLink.filter({ project_id: projectId });
    setItems(rows);
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);

    // Load all project links for this project
    const links = await base44.entities.ProductColorAndMoreProjectLink.filter({ project_id: projectId });

    // Load existing DC x CoT combos to avoid duplicates
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
            toCreate.push({
              project_link_id: link.id,
              project_id: projectId,
              distribution_channel: dc,
              channel_of_trade: cot,
            });
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

  const getVariation = (item) => {
    // Find the parent link, then the variation
    return null; // we'll resolve inline
  };

  // Build enriched rows by joining with link data
  const [linkMap, setLinkMap] = useState({});
  useEffect(() => {
    if (!projectId) return;
    base44.entities.ProductColorAndMoreProjectLink.filter({ project_id: projectId }).then((links) => {
      const map = {};
      links.forEach((l) => { map[l.id] = l; });
      setLinkMap(map);
    });
  }, [projectId, items.length]);

  const getVariationForLink = (linkId) => {
    const link = linkMap[linkId];
    if (!link) return null;
    return allVariations.find((v) => v.id === link.product_color_and_more_id) || null;
  };

  const getColorway = (v) => v ? colorways.find((cw) => cw.id === v.product_color_id) : null;
  const getProduct = (v) => {
    const cw = getColorway(v);
    return cw ? products.find((p) => p.id === cw.product_id) : null;
  };

  const filtered = search.trim()
    ? items.filter((item) => {
        const v = getVariationForLink(item.project_link_id);
        const cw = getColorway(v);
        const prod = getProduct(v);
        const q = search.toLowerCase();
        return (
          item.distribution_channel?.toLowerCase().includes(q) ||
          item.channel_of_trade?.toLowerCase().includes(q) ||
          v?.sequence?.toLowerCase().includes(q) ||
          v?.pack_code?.toLowerCase().includes(q) ||
          cw?.color_name?.toLowerCase().includes(q) ||
          prod?.name?.toLowerCase().includes(q)
        );
      })
    : items;

  const columns = [
    {
      id: "style_name", label: "Style", width: 150,
      sortKey: (item) => getProduct(getVariationForLink(item.project_link_id))?.name || "",
      render: (item) => {
        const v = getVariationForLink(item.project_link_id);
        const prod = getProduct(v);
        return prod ? (
          <span className="text-xs font-semibold">{prod.name}</span>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "colorway", label: "Colorway", width: 130,
      sortKey: (item) => getColorway(getVariationForLink(item.project_link_id))?.color_name || "",
      render: (item) => {
        const v = getVariationForLink(item.project_link_id);
        const cw = getColorway(v);
        return cw ? (
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-sm border border-border shrink-0" style={{ backgroundColor: cw.color_hex || "#ccc" }} />
            <span className="text-xs">{cw.color_name}</span>
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "sequence", label: "Seq.", width: 70,
      sortKey: (item) => getVariationForLink(item.project_link_id)?.sequence || "",
      render: (item) => {
        const v = getVariationForLink(item.project_link_id);
        return <span className="font-mono text-xs text-muted-foreground">{v?.sequence || "—"}</span>;
      },
    },
    {
      id: "pack_code", label: "Pack Code", width: 100,
      sortKey: (item) => getVariationForLink(item.project_link_id)?.pack_code || "",
      render: (item) => {
        const v = getVariationForLink(item.project_link_id);
        return <span className="text-xs text-muted-foreground">{v?.pack_code || "—"}</span>;
      },
    },
    {
      id: "distribution_channel", label: "Distribution Channel", width: 170,
      sortKey: (item) => item.distribution_channel || "",
      render: (item) => <span className="text-xs font-medium">{item.distribution_channel}</span>,
    },
    {
      id: "channel_of_trade", label: "Channel of Trade", width: 150,
      sortKey: (item) => item.channel_of_trade || "",
      render: (item) => <span className="text-xs font-medium">{item.channel_of_trade}</span>,
    },
    {
      id: "forecasted_quantity", label: "Forecast Qty", width: 120,
      sortKey: (item) => item.forecasted_quantity ?? -1,
      render: (item) => (
        <NumberCell
          value={item.forecasted_quantity}
          onSave={(val) => updateForecast(item.id, val)}
        />
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8 text-xs" />
        </div>
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={handleGenerate}
          disabled={generating}
          title="Create variations per Distribution Channels per Channel of Trade"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Generate DC per CoT
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "No DC per CoT items yet. Make sure variations have Distribution Channels and Channels of Trade set, then click \"Generate DC per CoT\"."
              : "No results match your search."}
          </p>
        </div>
      ) : (
        <DataTable columns={columns} rows={filtered} hideColumnToggle />
      )}
    </div>
  );
}