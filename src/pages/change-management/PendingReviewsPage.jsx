import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { usePageOptions } from "@/lib/PageOptionsContext";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Search, FileStack, ClipboardList, SplitSquareVertical, List, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import ChangeManagementViewDrawer from "@/components/change-management/ChangeManagementViewDrawer";

const PAGE_KEY = "change_management_pending";

// ── Constants ──────────────────────────────────────────────────────────────────
const NON_TERMINAL_STATUSES = ["pending", "notified", "under_review"];

const FLOW_CONFIG = {
  A_dev_bom_release:  { letter: "A", color: "bg-blue-100 text-blue-700 border-blue-300",   label: "Flow A — Dev BOM Release" },
  B_routing_change:   { letter: "B", color: "bg-purple-100 text-purple-700 border-purple-300", label: "Flow B — Routing Change" },
  C_sourcing_change:  { letter: "C", color: "bg-amber-100 text-amber-700 border-amber-300",  label: "Flow C — Sourcing Change" },
  D_component_revision: { letter: "D", color: "bg-green-100 text-green-700 border-green-300", label: "Flow D — Component Revision" },
  manual:             { letter: "M", color: "bg-slate-100 text-slate-600 border-slate-300",  label: "Manual" },
};

const PRIORITY_CONFIG = {
  low:      "bg-slate-100 text-slate-600 border-slate-300",
  normal:   "bg-blue-100 text-blue-700 border-blue-300",
  high:     "bg-orange-100 text-orange-700 border-orange-300",
  critical: "bg-red-100 text-red-700 border-red-300",
};

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

const PAGE_SIZE = 50;

// ── Column definitions ─────────────────────────────────────────────────────────
function renderCell(colId, row, ecoMap, navigate) {
  const eco = ecoMap[row.eco_id];
  switch (colId) {
    case "eco_number":
      return (
        <button type="button" onClick={() => navigate(`/change-management/ecos/${row.eco_id}`)}
          className="font-mono text-xs font-semibold text-primary hover:underline"
          title={eco?.title || ""}>
          {eco?.eco_number || row.eco_id?.slice(-6) || "—"}
        </button>
      );
    case "flow_type": {
      const cfg = FLOW_CONFIG[row.flow_type] || { letter: "?", color: "bg-slate-100 text-slate-600", label: row.flow_type };
      return (
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-bold border ${cfg.color}`} title={cfg.label}>
          {cfg.letter}
        </span>
      );
    }
    case "downstream_label":
      return (
        <span className="flex items-center gap-1.5 text-xs text-foreground max-w-[280px]">
          <span className="text-muted-foreground shrink-0">{DOWNSTREAM_ICONS[row.downstream_type]}</span>
          <span className="truncate" title={row.downstream_label}>{row.downstream_label || "—"}</span>
        </span>
      );
    case "priority":
      return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize ${PRIORITY_CONFIG[row.priority] || "bg-muted text-muted-foreground"}`}>{row.priority || "—"}</span>;
    case "propagation_status":
      return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_CONFIG[row.propagation_status] || "bg-muted text-muted-foreground"}`}>{(row.propagation_status || "—").replace(/_/g, " ")}</span>;
    case "created_date":
      return row.created_date ? (
        <span className="text-xs text-muted-foreground" title={new Date(row.created_date).toLocaleString()}>
          {formatDistanceToNow(new Date(row.created_date), { addSuffix: true })}
        </span>
      ) : "—";
    default:
      return <span className="text-xs text-muted-foreground">{String(row[colId] ?? "—")}</span>;
  }
}

const COLUMN_LABELS = {
  eco_number: "ECO",
  flow_type: "Flow",
  downstream_label: "Downstream",
  priority: "Priority",
  propagation_status: "Status",
  created_date: "Created",
};

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

  // Inline controls (ephemeral — don't modify saved view)
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [page, setPage] = useState(0);

  // Load user
  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
  }, []);

  // Load active view config
  useEffect(() => {
    if (activeViewId === "default") {
      setActiveView(null);
      return;
    }
    base44.entities.ListViewConfig.filter({ id: activeViewId }).then(res => {
      setActiveView(res[0] || null);
    });
  }, [activeViewId]);

  // Fetch rows based on active view filters
  useEffect(() => {
    setLoading(true);
    setPage(0);
    const fetchData = async () => {
      // Always filter to non-terminal statuses
      const allRows = await base44.entities.ECOAffectedDownstream.filter(
        { propagation_status: { $in: NON_TERMINAL_STATUSES } },
        "-created_date",
        500
      );

      // Apply view-level filters (client-side for pseudo-fields)
      const viewFilters = activeView?.filters_config?.filters || [];
      let filtered = allRows;

      for (const f of viewFilters) {
        if (f.field === "propagation_status") {
          filtered = filtered.filter(r => f.values.includes(r.propagation_status));
        } else if (f.field === "flow_type") {
          filtered = filtered.filter(r => f.values.includes(r.flow_type));
        } else if (f.field === "priority") {
          filtered = filtered.filter(r => f.values.includes(r.priority));
        } else if (f.field === "_mine_only" && user) {
          // Resolve ECOs for mine-only — batch
          const ecoIds = [...new Set(filtered.map(r => r.eco_id).filter(Boolean))];
          const ecos = ecoIds.length > 0
            ? await base44.entities.ECO.filter({ id: { $in: ecoIds } }, "-created_date", 500)
            : [];
          const myEcoIds = new Set(
            ecos.filter(e => e.requested_by === user.email || e.approver_id === user.email).map(e => e.id)
          );
          filtered = filtered.filter(r => myEcoIds.has(r.eco_id) || r.created_by === user.email);
        }
      }

      setRows(filtered);

      // Batch-fetch ECOs
      const ecoIds = [...new Set(filtered.map(r => r.eco_id).filter(Boolean))];
      if (ecoIds.length > 0) {
        const ecos = await base44.entities.ECO.filter({ id: { $in: ecoIds } }, "-created_date", 500);
        const map = {};
        ecos.forEach(e => { map[e.id] = e; });
        setEcoMap(map);
      } else {
        setEcoMap({});
      }
      setLoading(false);
    };
    fetchData();
  }, [activeView, user]);

  // Register options menu
  useEffect(() => {
    setOptions({
      items: [
        { label: "Manage Views", icon: Pencil, onClick: () => setShowViewMenu(v => !v), custom: true },
      ],
      customContent: showViewMenu ? (
        <ChangeManagementViewDrawer
          pageKey={PAGE_KEY}
          activeViewId={activeViewId}
          onSelectView={(id) => { setActiveViewId(id); setShowViewMenu(false); }}
          allFields={Object.entries(COLUMN_LABELS).map(([id, label]) => ({ id, label }))}
          displayMode="list"
        />
      ) : null,
    });
  }, [setOptions, showViewMenu, activeViewId]);

  // Inline search + sort (ephemeral)
  const processed = useMemo(() => {
    let result = [...rows];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.downstream_label?.toLowerCase().includes(q) ||
        ecoMap[r.eco_id]?.eco_number?.toLowerCase().includes(q) ||
        ecoMap[r.eco_id]?.title?.toLowerCase().includes(q)
      );
    }

    if (sortOrder === "newest") result.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    else if (sortOrder === "oldest") result.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    else if (sortOrder === "priority") {
      const order = { critical: 0, high: 1, normal: 2, low: 3 };
      result.sort((a, b) => (order[a.priority] ?? 4) - (order[b.priority] ?? 4));
    }

    return result;
  }, [rows, search, sortOrder, ecoMap]);

  const totalPages = Math.ceil(processed.length / PAGE_SIZE);
  const visible = processed.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Active column ids (from view or default)
  const columnIds = activeView?.column_ids?.length > 0
    ? activeView.column_ids
    : ["eco_number", "flow_type", "downstream_label", "priority", "propagation_status", "created_date"];

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2 border-b border-border bg-background">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Change Management</p>
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-display font-semibold">Pending Reviews</h1>
          <span className="text-sm text-muted-foreground">
            {loading ? "…" : `${processed.length} change${processed.length !== 1 ? "s" : ""} awaiting attention`}
          </span>
        </div>
      </div>

      {/* Inline controls bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-background">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rows…" className="h-8 pl-8 text-xs" />
        </div>
        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="h-8 text-xs w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="priority">Highest priority first</SelectItem>
          </SelectContent>
        </Select>
        {activeView && (
          <span className="text-xs text-muted-foreground px-2 py-1 bg-primary/10 text-primary rounded-md font-medium">
            {activeView.name}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
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
          <table className="w-full text-xs min-w-[700px]">
            <thead className="sticky top-0 z-[2] bg-card border-b border-border shadow-sm">
              <tr>
                {columnIds.map(colId => (
                  <th key={colId} className="px-3 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap">
                    {COLUMN_LABELS[colId] || colId}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(row => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors group">
                  {columnIds.map(colId => (
                    <td key={colId} className="px-3 py-2.5 align-middle">
                      {renderCell(colId, row, ecoMap, navigate)}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right">
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary"
                      onClick={() => navigate(`/change-management/ecos/${row.eco_id}`)}>
                      View ECO <ExternalLink className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-border bg-background text-xs text-muted-foreground">
          <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, processed.length)} of {processed.length}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <span>{page + 1} / {totalPages}</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}