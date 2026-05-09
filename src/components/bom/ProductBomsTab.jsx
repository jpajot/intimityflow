import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, ClipboardList, ExternalLink, Layers } from "lucide-react";
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
  { id: "released_at", label: "Released At" },
  { id: "valid_from", label: "Valid From" },
  { id: "valid_until", label: "Valid Until" },
  { id: "notes", label: "Notes" },
  { id: "open", label: "" },
];

const DEFAULT_COLUMN_IDS = ["revision", "version", "status", "bom_type", "released_at", "notes", "open"];
const DEFAULT_FIXED_IDS = ["revision"];

function buildColumns(navigate) {
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
  const [loading, setLoading] = useState(true);
  const [showNewBom, setShowNewBom] = useState(false);
  const [activeViewId, setActiveViewId] = useState("default");
  const [columnIds, setColumnIds] = useState(DEFAULT_COLUMN_IDS);
  const [fixedIds, setFixedIds] = useState(DEFAULT_FIXED_IDS);

  const loadBoms = async () => {
    setLoading(true);
    const result = await base44.entities.BOM.filter({ product_id: product.id }, "-created_date", 100);
    setBoms(result);
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

  const allColumns = buildColumns(navigate);
  const columns = columnIds
    .map((id) => allColumns.find((c) => c.id === id))
    .filter(Boolean);
  const fixedColumns = fixedIds.filter((id) => columnIds.includes(id));

  const filterFields = [
    { getValue: (r) => r.revision_code },
    { getValue: (r) => r.status },
    { getValue: (r) => r.bom_type },
    { getValue: (r) => r.notes },
  ];

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-base">BOMs</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bills of Materials for {product.code ? `${product.code} ` : ""}{product.name}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNewBom(true)}>
          <Plus className="w-3.5 h-3.5" />
          New BOM
        </Button>
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
          rows={boms}
          fixedColumns={fixedColumns}
          filterFields={filterFields}
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