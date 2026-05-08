import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { usePageOptions } from "@/lib/PageOptionsContext";
import { usePersistedQuickFilters } from "@/hooks/usePersistedQuickFilters";
import { applyQuickFilters } from "@/components/QuickFiltersPanel";
import QuickFiltersPanel from "@/components/QuickFiltersPanel";
import DataTable from "@/components/DataTable";
import ChangeManagementViewDrawer from "@/components/change-management/ChangeManagementViewDrawer";
import {
  FlowBadge, StatusBadge, PriorityBadge, ReasonBadge, originLabel,
} from "@/components/change-management/EcoBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Pencil, RefreshCw, Search, X, ExternalLink, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const PAGE_KEY = "change_management_ecos";
const PAGE_SIZE = 50;

// ── Field definitions ──────────────────────────────────────────────────────────
const ALL_FIELDS = [
  { id: "eco_number",      label: "ECO #" },
  { id: "title",           label: "Title" },
  { id: "description",     label: "Description" },
  { id: "flow_type",       label: "Flow" },
  { id: "status",          label: "Status" },
  { id: "priority",        label: "Priority" },
  { id: "reason_category", label: "Reason" },
  { id: "origin",          label: "Origin" },
  { id: "requested_by",    label: "Requested By" },
  { id: "requested_at",    label: "Requested At" },
  { id: "approver_id",     label: "Approver" },
  { id: "approved_at",     label: "Approved At" },
  { id: "applied_at",      label: "Applied At" },
  { id: "closed_at",       label: "Closed At" },
  { id: "target_effective_date", label: "Effective Date" },
];

const QF_FIELDS = [
  { id: "eco_number",      label: "ECO #",         getValue: (r) => r.eco_number || "" },
  { id: "title",           label: "Title",          getValue: (r) => r.title || "" },
  { id: "status",          label: "Status",         getValue: (r) => r.status || "" },
  { id: "flow_type",       label: "Flow Type",      getValue: (r) => r.flow_type || "" },
  { id: "priority",        label: "Priority",       getValue: (r) => r.priority || "" },
  { id: "reason_category", label: "Reason",         getValue: (r) => r.reason_category || "" },
  { id: "origin",          label: "Origin",         getValue: (r) => r.origin || "" },
  { id: "requested_by",    label: "Requested By",   getValue: (r) => r.requested_by || "" },
  { id: "requested_at",    label: "Requested At",   getValue: (r) => r.requested_at || "" },
];

const DEFAULT_COLUMNS = [
  "eco_number", "title", "flow_type", "status", "priority",
  "reason_category", "origin", "requested_by",
];

// ── Cell renderers ─────────────────────────────────────────────────────────────
function RelTime({ value }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="text-xs text-muted-foreground" title={new Date(value).toLocaleString()}>
      {formatDistanceToNow(new Date(value), { addSuffix: true })}
    </span>
  );
}

function buildColumns(navigate) {
  return [
    {
      id: "eco_number", label: "ECO #", width: 110,
      sortKey: (r) => r.eco_number || "",
      render: (r) => (
        <button type="button" onClick={() => navigate(`/change-management/ecos/${r.id}`)}
          className="font-mono text-xs font-semibold text-primary hover:underline" title={r.title}>
          {r.eco_number}
        </button>
      ),
    },
    {
      id: "title", label: "Title", width: 220,
      sortKey: (r) => r.title || "",
      render: (r) => (
        <span className="text-xs font-medium truncate block max-w-[200px]" title={r.title}>
          {r.title || "—"}
        </span>
      ),
    },
    {
      id: "description", label: "Description", width: 240,
      sortKey: (r) => r.description || "",
      render: (r) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[220px]" title={r.description}>
          {r.description || "—"}
        </span>
      ),
    },
    {
      id: "flow_type", label: "Flow", width: 70,
      sortKey: (r) => r.flow_type || "",
      render: (r) => <FlowBadge value={r.flow_type} />,
    },
    {
      id: "status", label: "Status", width: 110,
      sortKey: (r) => r.status || "",
      render: (r) => <StatusBadge value={r.status} />,
    },
    {
      id: "priority", label: "Priority", width: 90,
      sortKey: (r) => r.priority || "",
      render: (r) => <PriorityBadge value={r.priority} />,
    },
    {
      id: "reason_category", label: "Reason", width: 130,
      sortKey: (r) => r.reason_category || "",
      render: (r) => <ReasonBadge value={r.reason_category} />,
    },
    {
      id: "origin", label: "Origin", width: 140,
      sortKey: (r) => r.origin || "",
      render: (r) => <span className="text-xs">{originLabel(r.origin)}</span>,
    },
    {
      id: "requested_by", label: "Requested By", width: 180,
      sortKey: (r) => r.requested_by || "",
      render: (r) => <span className="text-xs text-muted-foreground truncate block max-w-[160px]">{r.requested_by || "—"}</span>,
    },
    {
      id: "requested_at", label: "Requested At", width: 130,
      sortKey: (r) => r.requested_at || "",
      render: (r) => <RelTime value={r.requested_at} />,
    },
    {
      id: "approver_id", label: "Approver", width: 180,
      sortKey: (r) => r.approver_id || "",
      render: (r) => <span className="text-xs text-muted-foreground">{r.approver_id || "—"}</span>,
    },
    {
      id: "approved_at", label: "Approved At", width: 130,
      sortKey: (r) => r.approved_at || "",
      render: (r) => <RelTime value={r.approved_at} />,
    },
    {
      id: "applied_at", label: "Applied At", width: 130,
      sortKey: (r) => r.applied_at || "",
      render: (r) => <RelTime value={r.applied_at} />,
    },
    {
      id: "closed_at", label: "Closed At", width: 130,
      sortKey: (r) => r.closed_at || "",
      render: (r) => <RelTime value={r.closed_at} />,
    },
    {
      id: "target_effective_date", label: "Effective Date", width: 130,
      sortKey: (r) => r.target_effective_date || "",
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.target_effective_date ? new Date(r.target_effective_date).toLocaleDateString() : "—"}
        </span>
      ),
    },
    // Always-visible actions column
    {
      id: "_actions", label: "", width: 90,
      render: (r) => (
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary"
          onClick={() => navigate(`/change-management/ecos/${r.id}`)}>
          Open <ExternalLink className="w-3 h-3" />
        </Button>
      ),
    },
  ];
}

// ── InlineSearch component ─────────────────────────────────────────────────────
function InlineSearch({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleBlur = () => {
    if (!value) setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" onClick={handleOpen}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Search ECOs">
        <Search className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="Search ECO #, title, description…"
        className="pl-8 pr-7 h-8 text-xs w-64"
      />
      {value && (
        <button type="button" onClick={handleClear}
          className="absolute right-2 text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AllEcosPage() {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();

  const [allEcos, setAllEcos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [user, setUser] = useState(null);

  // View
  const [activeViewId, setActiveViewId] = useState("default");
  const [activeView, setActiveView] = useState(null);
  const [showViewMenu, setShowViewMenu] = useState(false);

  // Search
  const [search, setSearch] = useState("");

  // Quick Filters (ephemeral — clear on view switch per locked decision)
  const [quickFilters, setQuickFilters] = useState([]);
  const [showQF, setShowQF] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);

  // Pinned columns
  const [pinnedCols, setPinnedCols] = useState([]);
  const handlePinColumn = (colId) => {
    setPinnedCols((prev) => prev.includes(colId) ? prev.filter((c) => c !== colId) : [...prev, colId]);
  };

  // Columns
  const allColumns = useMemo(() => buildColumns(navigate), [navigate]);

  // Load user
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Load ECOs
  useEffect(() => {
    setLoading(true);
    base44.entities.ECO.list("-created_date", 500).then((rows) => {
      setAllEcos(rows);
      setLoading(false);
    });
  }, [refreshKey]);

  // Load active view config
  useEffect(() => {
    if (activeViewId === "default") { setActiveView(null); return; }
    base44.entities.ListViewConfig.filter({ id: activeViewId }).then((res) => {
      setActiveView(res[0] || null);
    });
  }, [activeViewId]);

  // Clear quick filters on view switch (locked decision)
  const handleSelectView = (id) => {
    setActiveViewId(id);
    setQuickFilters([]);
    setShowQF(false);
    setPage(0);
  };

  // Options drawer
  useEffect(() => {
    setOptions({
      filterBadge: quickFilters.length > 0 ? quickFilters.length : null,
      items: [
        {
          label: "+ New ECO", icon: Plus,
          onClick: () => navigate("/change-management/manual"),
        },
        { divider: true },
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
          allFields={ALL_FIELDS}
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
  }, [setOptions, showViewMenu, showQF, activeViewId, quickFilters, navigate]);

  // Apply view's saved filters (client-side intersection)
  const viewFilteredRows = useMemo(() => {
    let rows = [...allEcos];
    if (!activeView?.filters_config?.filters?.length) return rows;
    for (const f of activeView.filters_config.filters) {
      if (!f.field || !f.values?.length) continue;
      rows = rows.filter((r) => {
        let val = r[f.field] ?? "";
        // Template substitution for current_user_email
        const resolvedValues = f.values.map((v) =>
          v === "{{current_user_email}}" && user ? user.email : v
        );
        return resolvedValues.some((v) =>
          String(val).toLowerCase().includes(String(v).toLowerCase())
        );
      });
    }
    return rows;
  }, [allEcos, activeView, user]);

  // Apply quick filters
  const qfRows = useMemo(
    () => applyQuickFilters(viewFilteredRows, quickFilters),
    [viewFilteredRows, quickFilters]
  );

  // Apply search
  const searchedRows = useMemo(() => {
    if (!search.trim()) return qfRows;
    const q = search.toLowerCase();
    return qfRows.filter(
      (r) =>
        r.eco_number?.toLowerCase().includes(q) ||
        r.title?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
    );
  }, [qfRows, search]);

  // Paginate
  const totalPages = Math.ceil(searchedRows.length / PAGE_SIZE);
  const visibleRows = searchedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Column selection from active view
  const columnIds = activeView?.column_ids?.length > 0 ? activeView.column_ids : DEFAULT_COLUMNS;
  // Include _actions always; build display columns = view columns + _actions
  const displayColumns = [
    ...columnIds.map((id) => allColumns.find((c) => c.id === id)).filter(Boolean),
    allColumns.find((c) => c.id === "_actions"),
  ].filter(Boolean);

  const fixedCols = activeView?.fixed_column_ids || [];

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2 border-b border-border bg-background">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Change Management</p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-display font-semibold">All ECOs</h1>
            <span className="text-sm text-muted-foreground">
              {loading ? "…" : `${searchedRows.length} ECO${searchedRows.length !== 1 ? "s" : ""}`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <InlineSearch value={search} onChange={(v) => { setSearch(v); setPage(0); }} />
            <button type="button" onClick={() => setRefreshKey((k) => k + 1)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        {activeView && (
          <div className="mt-1">
            <span className="text-xs text-muted-foreground px-2 py-0.5 bg-primary/10 text-primary rounded-md font-medium">
              {activeView.name}
            </span>
          </div>
        )}
      </div>

      {/* Table area */}
      <div className="flex-1 min-h-0 overflow-auto px-4 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : searchedRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <p className="font-medium text-sm">No ECOs match the current view and filters.</p>
          </div>
        ) : (
          <DataTable
            columns={displayColumns}
            rows={visibleRows}
            fixedColumns={[...fixedCols, ...pinnedCols]}
            hideColumnToggle
            onPinColumn={handlePinColumn}
          />
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-border bg-background text-xs text-muted-foreground">
          <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, searchedRows.length)} of {searchedRows.length}</span>
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