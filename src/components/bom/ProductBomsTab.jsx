import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, ClipboardList, ExternalLink, Search, X } from "lucide-react";
import NewBOMDialog from "./NewBOMDialog";
import DataTable from "@/components/DataTable";
import ViewDrawerContent from "@/components/ViewDrawerContent";
import { usePageOptions } from "@/lib/PageOptionsContext";

const PAGE_KEY = "product_boms_list";

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  in_review: "bg-amber-100 text-amber-700 border-amber-300",
  released: "bg-green-100 text-green-700 border-green-300",
  superseded: "bg-purple-100 text-purple-700 border-purple-300",
  obsolete: "bg-red-100 text-red-700 border-red-300",
};

const ALL_FIELDS = [
  { id: "revision", label: "Revision" },
  { id: "version", label: "Version" },
  { id: "status", label: "Status" },
  { id: "bom_type", label: "Type" },
  { id: "routing", label: "Routing" },
  { id: "released_at", label: "Released At" },
  { id: "valid_from", label: "Valid From" },
  { id: "valid_until", label: "Valid Until" },
  { id: "notes", label: "Notes" },
  { id: "open", label: "" },
];

const DEFAULT_COLUMN_IDS = ["revision", "version", "status", "bom_type", "routing", "released_at", "notes", "open"];
const DEFAULT_FIXED_IDS = ["revision"];

function buildColumns(navigate, routingsMap) {
  return [
    {
      id: "revision",
      label: "Revision",
      width: 90,
      sortKey: (r) => r.revision_code || "",
      render: (r) => (
        <span className="font-semibold text-sm text-foreground">Rev {r.revision_code || "—"}</span>
      ),
    },
    {
      id: "version",
      label: "Version",
      width: 80,
      sortKey: (r) => r.version ?? 0,
      render: (r) => <span className="text-xs text-muted-foreground">v{r.version ?? 1}</span>,
    },
    {
      id: "status",
      label: "Status",
      width: 110,
      sortKey: (r) => r.status || "",
      render: (r) => (
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[r.status] || "bg-muted text-muted-foreground border-border"}`}>
          {r.status}
        </span>
      ),
    },
    {
      id: "bom_type",
      label: "Type",
      width: 110,
      sortKey: (r) => r.bom_type || "",
      render: (r) => (
        <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground capitalize">
          {r.bom_type}
        </span>
      ),
    },
    {
      id: "routing",
      label: "Routing",
      width: 220,
      sortKey: (r) => {
        const rt = routingsMap[r.selected_routing_id];
        return rt ? `${rt.name} ${rt.revision_code || ""} ${rt.version || 0}` : "";
      },
      render: (r) => {
        const rt = routingsMap[r.selected_routing_id];
        if (!rt) return <span className="text-xs text-muted-foreground/40">—</span>;
        return (
          <span className="text-xs text-muted-foreground">
            {rt.name} · Rev {rt.revision_code || "—"} v{rt.version || "—"}
            {" "}
            <span className={`text-[10px] px-1 py-px rounded border ${STATUS_COLORS[rt.status] || "bg-muted text-muted-foreground border-border"}`}>
              {rt.status}
            </span>
          </span>
        );
      },
    },
    {
      id: "released_at",
      label: "Released At",
      width: 140,
      sortKey: (r) => r.released_at || "",
      render: (r) => r.released_at
        ? <span className="text-xs text-muted-foreground">{new Date(r.released_at).toLocaleDateString()}</span>
        : <span className="text-xs text-muted-foreground/40">—</span>,
    },
    {
      id: "valid_from",
      label: "Valid From",
      width: 130,
      sortKey: (r) => r.valid_from || "",
      render: (r) => r.valid_from
        ? <span className="text-xs text-muted-foreground">{new Date(r.valid_from).toLocaleDateString()}</span>
        : <span className="text-xs text-muted-foreground/40">—</span>,
    },
    {
      id: "valid_until",
      label: "Valid Until",
      width: 130,
      sortKey: (r) => r.valid_until || "",
      render: (r) => r.valid_until
        ? <span className="text-xs text-muted-foreground">{new Date(r.valid_until).toLocaleDateString()}</span>
        : <span className="text-xs text-muted-foreground/40">—</span>,
    },
    {
      id: "notes",
      label: "Notes",
      width: 200,
      sortKey: (r) => r.notes || "",
      render: (r) => r.notes
        ? <span className="text-xs text-muted-foreground truncate block max-w-xs">{r.notes}</span>
        : <span className="text-xs text-muted-foreground/30">—</span>,
    },
    {
      id: "open",
      label: "",
      width: 40,
      render: (r) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(`/boms/${r.id}`); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Open BOM"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];
}

export default function ProductBomsTab({ product }) {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();
  const [boms, setBoms] = useState([]);
  const [routingsMap, setRoutingsMap] = useState({}); // id -> routing
  const [loading, setLoading] = useState(true);
  const [showNewBom, setShowNewBom] = useState(false);
  const [activeViewId, setActiveViewId] = useState("default");
  const [columnIds, setColumnIds] = useState(DEFAULT_COLUMN_IDS);
  const [fixedIds, setFixedIds] = useState(DEFAULT_FIXED_IDS);
  const [filterText, setFilterText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  const loadBoms = async () => {
    setLoading(true);
    const [result, routings] = await Promise.all([
      base44.entities.BOM.filter({ product_id: product.id }, "-created_date", 100),
      base44.entities.SupplierRouting.filter({ product_id: product.id }),
    ]);
    setBoms(result);
    const rMap = {};
    routings.forEach((r) => { rMap[r.id] = r; });
    setRoutingsMap(rMap);
    setLoading(false);
  };

  useEffect(() => {
    loadBoms();
  }, [product.id]);

  // Apply view config when activeViewId changes
  useEffect(() => {
    if (activeViewId === "default") {
      setColumnIds(DEFAULT_COLUMN_IDS);
      setFixedIds(DEFAULT_FIXED_IDS);
      return;
    }
    base44.entities.ListViewConfig.filter({ id: activeViewId }).then((results) => {
      const v = results[0];
      if (v) {
        setColumnIds(v.column_ids?.length ? v.column_ids : DEFAULT_COLUMN_IDS);
        setFixedIds(v.fixed_column_ids || []);
      }
    });
  }, [activeViewId]);

  // Register Options menu with Manage Views
  const handleSelectView = useCallback((id) => setActiveViewId(id), []);

  useEffect(() => {
    setOptions({
      customContent: ({ close }) => (
        <ViewDrawerContent
          pageKey={PAGE_KEY}
          activeViewId={activeViewId}
          onSelectView={(id) => { handleSelectView(id); close(); }}
          allFields={ALL_FIELDS}
          currentViewType="list"
        />
      ),
    });
    return () => setOptions(null);
  }, [activeViewId]);

  const handleCreated = (newBom) => {
    setShowNewBom(false);
    navigate(`/boms/${newBom.id}`);
  };

  const allColumns = buildColumns(navigate, routingsMap);
  const columns = columnIds
    .map((id) => allColumns.find((c) => c.id === id))
    .filter(Boolean);
  const fixedColumns = fixedIds.filter((id) => columnIds.includes(id));

  const filteredBoms = filterText
    ? boms.filter((r) => {
        const q = filterText.toLowerCase();
        return (r.revision_code || "").toLowerCase().includes(q)
          || (r.status || "").toLowerCase().includes(q)
          || (r.bom_type || "").toLowerCase().includes(q)
          || (r.notes || "").toLowerCase().includes(q);
      })
    : boms;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-base">BOMs</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bills of Materials for {product.code ? `${product.code} ` : ""}{product.name}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Collapsible search */}
          {searchOpen ? (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setFilterText(""); setSearchOpen(false); } }}
                onBlur={() => { if (!filterText) setSearchOpen(false); }}
                placeholder="Filter…"
                className="pl-8 pr-7 h-8 text-xs w-44"
              />
              {filterText && (
                <button type="button" onClick={() => { setFilterText(""); searchRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => setSearchOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Search">
              <Search className="w-4 h-4" />
            </button>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewBom(true)}>
            <Plus className="w-3.5 h-3.5" />
            New BOM
          </Button>
        </div>
      </div>

      {boms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
          <ClipboardList className="w-10 h-10 opacity-25" />
          <p className="text-sm font-medium">No BOMs created for this product yet.</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowNewBom(true)}>
            <Plus className="w-3.5 h-3.5" />
            Create first BOM
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filteredBoms}
          fixedColumns={fixedColumns}
          filterFields={[]}
          hideColumnToggle
          onPinColumn={(colId) => {
            setFixedIds((prev) =>
              prev.includes(colId) ? prev.filter((x) => x !== colId) : [...prev, colId]
            );
          }}
        />
      )}

      <NewBOMDialog
        open={showNewBom}
        onClose={() => setShowNewBom(false)}
        products={[product]}
        preselectedProduct={product}
        onCreated={handleCreated}
      />
    </div>
  );
}