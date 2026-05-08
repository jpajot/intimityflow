import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import React from "react";
import { base44 } from "@/api/base44Client";
import { usePageOptions } from "@/lib/PageOptionsContext";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Search, X, FileStack, ClipboardList, SplitSquareVertical, List, ExternalLink, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import ChangeManagementViewDrawer from "@/components/change-management/ChangeManagementViewDrawer";
import QuickFiltersPanel from "@/components/QuickFiltersPanel";
import { applyQuickFilters } from "@/components/QuickFiltersPanel";
import DataTable from "@/components/DataTable";
import { FlowBadge, PriorityBadge } from "@/components/change-management/EcoBadges";

const PAGE_KEY = "change_management_pending";
const PAGE_SIZE = 50;

// ── Constants ──────────────────────────────────────────────────────────────────
const NON_TERMINAL_STATUSES = ["pending", "notified", "under_review"];

const STATUS_CONFIG = {
  pending:           "bg-slate-100 text-slate-600",
  notified:          "bg-yellow-100 text-yellow-700",
  under_review:      "bg-blue-100 text-blue-700",
  adopted:           "bg-green-100 text-green-700",
  rejected:          "bg-red-100 text-red-700",
  pinned:            "bg-purple-100 text-purple-700",
  superseded:        "bg-slate-200 text-slate-500",
  partially_adopted: "bg-emerald-100 text-emerald-700",
  not_applicable:    "bg-gray-100 text-gray-500",
};

const DOWNSTREAM_ICONS = {
  BOM:            <FileStack className="w-3.5 h-3.5 shrink-0" />,
  BOL:            <ClipboardList className="w-3.5 h-3.5 shrink-0" />,
  BOMLineVariant: <SplitSquareVertical className="w-3.5 h-3.5 shrink-0" />,
  BOMLine:        <List className="w-3.5 h-3.5 shrink-0" />,
};

// ── Quick Filter fields ────────────────────────────────────────────────────────
const QF_FIELDS = [
  { id: "flow_type",         label: "Flow Type",         getValue: (r) => r.flow_type || "" },
  { id: "priority",          label: "Priority",          getValue: (r) => r.priority || "" },
  { id: "propagation_status", label: "Status",           getValue: (r) => r.propagation_status || "" },
  { id: "downstream_type",   label: "Downstream Type",   getValue: (r) => r.downstream_type || "" },
  { id: "downstream_label",  label: "Downstream Label",  getValue: (r) => r.downstream_label || "" },
  { id: "created_date",      label: "Created Date",      getValue: (r) => r.created_date || "" },
];

const COLUMN_DEFS_BASE = {
  eco_number:          { label: "ECO",        width: 110 },
  flow_type:           { label: "Flow",       width: 70 },
  downstream_label:    { label: "Downstream", width: 300 },
  priority:            { label: "Priority",   width: 100 },
  propagation_status:  { label: "Status",     width: 130 },
  created_date:        { label: "Created",    width: 140 },
};

// ── InlineSearch ───────────────────────────────────────────────────────────────
function InlineSearch({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleBlur = () => { if (!value) setOpen(false); };

  const handleClear = () => { onChange(""); setOpen(false); };

  if (!open) {
    return (
      <button type="button" onClick={handleOpen}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Search">
        <Search className="w-4 h-4" />
      </button>
    );
  }
  return (
    <div className="relative flex items-center">
      <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      <Input ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur} placeholder="Search downstream label, ECO…"
        className="pl-8 pr-7 h-8 text-xs w-64" />
      {value && (
        <button type="button" onClick={handleClear} className="absolute right-2 text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Column builder ─────────────────────────────────────────────────────────────
function buildColumns(ecoMap, navigate) {
  return [
    {
      id: "eco_number", label: "ECO", width: 110,
      sortKey: (r) => ecoMap[r.eco_id]?.eco_number || "",
      render: (r) => {
        const eco = ecoMap[r.eco_id];
        return (
          <button type="button" onClick={() => navigate(`/change-management/ecos/${r.eco_id}`)}
            className="font-mono text-xs font-semibold text-primary hover:underline"
            title={eco?.title || ""}>
            {eco?.eco_number || r.eco_id?.slice(-6) || "—"}
          </button>
        );
      },
    },
    {
      id: "flow_type", label: "Flow", width: 70,
      sortKey: (r) => r.flow_type || "",
      render: (r) => <FlowBadge value={r.flow_type} />,
    },
    {
      id: "downstream_label", label: "Downstream", width: 300,
      sortKey: (r) => r.downstream_label || "",
      render: (r) => (
        <span className="flex items-center gap-1.5 text-xs text-foreground max-w-[280px]">
          <span className="text-muted-foreground shrink-0">{DOWNSTREAM_ICONS[r.downstream_type]}</span>
          <span className="truncate" title={r.downstream_label}>{r.downstream_label || "—"}</span>
        </span>
      ),
    },
    {
      id: "priority", label: "Priority", width: 100,
      sortKey: (r) => r.priority || "",
      render: (r) => <PriorityBadge value={r.priority} />,
    },
    {
      id: "propagation_status", label: "Status", width: 130,
      sortKey: (r) => r.propagation_status || "",
      render: (r) => (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_CONFIG[r.propagation_status] || "bg-muted text-muted-foreground"}`}>
          {(r.propagation_status || "—").replace(/_/g, " ")}
        </span>
      ),
    },
    {
      id: "created_date", label: "Created", width: 140,
      sortKey: (r) => r.created_date || "",
      render: (r) => r.created_date ? (
        <span className="text-xs text-muted-foreground" title={new Date(r.created_date).toLocaleString()}>
          {formatDistanceToNow(new Date(r.created_date), { addSuffix: true })}
        </span>
      ) : "—",
    },
    {
      id: "_actions", label: "", width: 110,
      render: (r) => (
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary"
          onClick={() => navigate(`/change-management/ecos/${r.eco_id}`)}>
          View ECO <ExternalLink className="w-3 h-3" />
        </Button>
      ),
    },
  ];
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PendingReviewsPage() {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();

  // View state
  const [activeViewId, setActiveViewId] = useState("default");
  const [activeView, setActiveView] = useState(null);
  const [showViewMenu, setShowViewMenu] = useState(false);

  // Data
  const [rows, setRows] = useState([]);
  const [ecoMap, setEcoMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Search (inline magnifier)
  const [search, setSearch] = useState("");

  // Quick Filters (ephemeral)
  const [quickFilters, setQuickFilters] = useState([]);
  const [showQF, setShowQF] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);

  // Pinned columns
  const [pinnedCols, setPinnedCols] = useState([]);
  const handlePinColumn = (colId) => {
    setPinnedCols((prev) => prev.includes(colId) ? prev.filter((c) => c !== colId) : [...prev, colId]);
  };

  // Load user
  useEffect(() => {
    base44.auth.me().then((u) => setUser(u)).catch(() => {});
  }, []);

  // Load active view config
  useEffect(() => {
    if (activeViewId === "default") { setActiveView(null); return; }
    base44.entities.ListViewConfig.filter({ id: activeViewId }).then((res) => {
      setActiveView(res[0] || null);
    });
  }, [activeViewId]);

  // Clear QF on view switch
  const handleSelectView = (id) => {
    setActiveViewId(id);
    setQuickFilters([]);
    setShowQF(false);
    setPage(0);
  };

  // Fetch rows based on active view filters
  useEffect(() => {
    setLoading(true);
    setPage(0);
    const fetchData = async () => {
      const allRows = await base44.entities.ECOAffectedDownstream.filter(
        { propagation_status: { $in: NON_TERMINAL_STATUSES } },
        "-created_date",
        500
      );

      // Apply view-level filters (client-side)
      const viewFilters = activeView?.filters_config?.filters || [];
      let filtered = allRows;
      for (const f of viewFilters) {
        if (f.field === "propagation_status") {
          filtered = filtered.filter((r) => f.values.includes(r.propagation_status));
        } else if (f.field === "flow_type") {
          filtered = filtered.filter((r) => f.values.includes(r.flow_type));
        } else if (f.field === "priority") {
          filtered = filtered.filter((r) => f.values.includes(r.priority));
        } else if (f.field === "_mine_only" && user) {
          const ecoIds = [...new Set(filtered.map((r) => r.eco_id).filter(Boolean))];
          const ecos = ecoIds.length > 0
            ? await base44.entities.ECO.filter({ id: { $in: ecoIds } }, "-created_date", 500)
            : [];
          const myEcoIds = new Set(
            ecos.filter((e) => e.requested_by === user.email || e.approver_id === user.email).map((e) => e.id)
          );
          filtered = filtered.filter((r) => myEcoIds.has(r.eco_id) || r.created_by === user.email);
        }
      }

      setRows(filtered);

      // Batch-fetch ECOs
      const ecoIds = [...new Set(filtered.map((r) => r.eco_id).filter(Boolean))];
      if (ecoIds.length > 0) {
        const ecos = await base44.entities.ECO.filter({ id: { $in: ecoIds } }, "-created_date", 500);
        const map = {};
        ecos.forEach((e) => { map[e.id] = e; });
        setEcoMap(map);
      } else {
        setEcoMap({});
      }
      setLoading(false);
    };
    fetchData();
  }, [activeView, user]);

  // Columns (memoised per ecoMap)
  const allColumns = useMemo(() => buildColumns(ecoMap, navigate), [ecoMap, navigate]);

  // Active column ids from view or default
  const columnIds = activeView?.column_ids?.length > 0
    ? activeView.column_ids
    : ["eco_number", "flow_type", "downstream_label", "priority", "propagation_status", "created_date"];

  const displayColumns = [
    ...columnIds.map((id) => allColumns.find((c) => c.id === id)).filter(Boolean),
    allColumns.find((c) => c.id === "_actions"),
  ].filter(Boolean);

  // Register options menu
  useEffect(() => {
    setOptions({
      filterBadge: quickFilters.length > 0 ? quickFilters.length : null,
      items: [
        {
          label: "Manage Views", icon: Pencil,
          onClick: () => { setShowViewMenu((v) => !v); setShowQF(false); },
          custom: true,
        },
        {
          label: "Quick Filters", icon: Filter,
          onClick: () => { setShowQF((v) => !v); setShowViewMenu(false); },
          custom: true,
          badge: quickFilters.length > 0 ? quickFilters.length : null,
        },
      ],
      customContent: showViewMenu ? (
        <ChangeManagementViewDrawer
          pageKey={PAGE_KEY}
          activeViewId={activeViewId}
          onSelectView={handleSelectView}
          allFields={Object.entries(COLUMN_DEFS_BASE).map(([id, { label }]) => ({ id, label }))}
          displayMode="list"
        />
      ) : showQF ? (
        <QuickFiltersPanel
          fields={QF_FIELDS}
          activeFilters={quickFilters}
          onApply={(f) => { setQuickFilters(f); setPage(0); }}
        />
      ) : null,
    });
  }, [setOptions, showViewMenu, showQF, activeViewId, quickFilters]);

  // Apply quick filters
  const qfRows = useMemo(() => applyQuickFilters(rows, quickFilters), [rows, quickFilters]);

  // Apply search
  const processed = useMemo(() => {
    let result = qfRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.downstream_label?.toLowerCase().includes(q) ||
        ecoMap[r.eco_id]?.eco_number?.toLowerCase().includes(q) ||
        ecoMap[r.eco_id]?.title?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [qfRows, search, ecoMap]);

  const totalPages = Math.ceil(processed.length / PAGE_SIZE);
  const visible = processed.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2 border-b border-border bg-background">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Change Management</p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-display font-semibold">Pending Reviews</h1>
            <span className="text-sm text-muted-foreground">
              {loading ? "…" : `${processed.length} change${processed.length !== 1 ? "s" : ""} awaiting attention`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <InlineSearch value={search} onChange={(v) => { setSearch(v); setPage(0); }} />
          </div>
        </div>
        {activeView && (
          <div className="mt-1">
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-md font-medium">
              {activeView.name}
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto px-4 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <p className="font-medium text-sm">No items match this view.</p>
            <p className="text-xs">Try switching views or adjusting filters.</p>
          </div>
        ) : (
          <DataTable
            columns={displayColumns}
            rows={visible}
            fixedColumns={[...(activeView?.fixed_column_ids || []), ...pinnedCols]}
            hideColumnToggle
            onPinColumn={handlePinColumn}
          />
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-border bg-background text-xs text-muted-foreground">
          <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, processed.length)} of {processed.length}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span>{page + 1} / {totalPages}</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}