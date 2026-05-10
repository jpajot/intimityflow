import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileSearch, Loader2, Search, X } from "lucide-react";
import DataTable from "@/components/DataTable";
import { usePageOptions } from "@/lib/PageOptionsContext";
import ViewDrawerContent from "@/components/ViewDrawerContent";
import RFQCreateDialog from "@/components/rfq/RFQCreateDialog";

const STATUS_COLORS = {
  draft:         "bg-gray-100 text-gray-600 border-gray-200",
  submitted:     "bg-blue-100 text-blue-700 border-blue-200",
  in_collection: "bg-amber-100 text-amber-700 border-amber-200",
  closed:        "bg-green-100 text-green-700 border-green-200",
  archived:      "bg-gray-100 text-gray-400 border-gray-200",
};

const STATUS_OPTIONS = ["draft", "submitted", "in_collection", "closed", "archived"];

const PAGE_KEY = "project_rfqs_list";

const ALL_FIELDS = [
  { id: "code",            label: "Code" },
  { id: "name",            label: "Name" },
  { id: "round",           label: "Round" },
  { id: "status",          label: "Status" },
  { id: "due_date",        label: "Due Date" },
  { id: "target_currency", label: "Target Currency" },
  { id: "created_date",    label: "Created" },
  { id: "created_by",      label: "Created By" },
];

const DEFAULT_COLUMN_IDS = ["code", "name", "round", "status", "due_date", "target_currency", "created_date", "created_by"];

function buildColumns(roundMap, currencyMap) {
  return [
    {
      id: "code",
      label: "Code",
      width: 110,
      sortKey: (r) => r.code || "",
      render: (r) => <span className="font-mono text-xs font-semibold">{r.code || "—"}</span>,
    },
    {
      id: "name",
      label: "Name",
      width: 200,
      sortKey: (r) => r.name || "",
      render: (r) => <span className="text-sm font-medium">{r.name || "—"}</span>,
    },
    {
      id: "round",
      label: "Round",
      width: 110,
      sortKey: (r) => roundMap[r.round_id]?.label || "",
      render: (r) => {
        const round = roundMap[r.round_id];
        return round
          ? <span className="text-xs px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground">{round.label}</span>
          : <span className="text-xs text-muted-foreground/40">—</span>;
      },
    },
    {
      id: "status",
      label: "Status",
      width: 120,
      sortKey: (r) => r.status || "",
      render: (r) => (
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${STATUS_COLORS[r.status] || "bg-muted text-muted-foreground border-border"}`}>
          {(r.status || "").replace(/_/g, " ")}
        </span>
      ),
    },
    {
      id: "due_date",
      label: "Due Date",
      width: 120,
      sortKey: (r) => r.due_date || "",
      render: (r) => r.due_date
        ? <span className="text-xs text-muted-foreground">{new Date(r.due_date).toLocaleDateString()}</span>
        : <span className="text-xs text-muted-foreground/40">—</span>,
    },
    {
      id: "target_currency",
      label: "Target Currency",
      width: 130,
      sortKey: (r) => currencyMap[r.target_currency_id]?.code || "",
      render: (r) => {
        const curr = currencyMap[r.target_currency_id];
        return curr
          ? <span className="text-xs font-mono font-semibold">{curr.code}</span>
          : <span className="text-xs text-muted-foreground/40">—</span>;
      },
    },
    {
      id: "created_date",
      label: "Created",
      width: 150,
      sortKey: (r) => r.created_date || "",
      render: (r) => r.created_date
        ? <span className="text-xs text-muted-foreground">{new Date(r.created_date).toLocaleString()}</span>
        : <span className="text-xs text-muted-foreground/40">—</span>,
    },
    {
      id: "created_by",
      label: "Created By",
      width: 160,
      sortKey: (r) => r.created_by || "",
      render: (r) => <span className="text-xs text-muted-foreground truncate">{r.created_by || "—"}</span>,
    },
  ];
}

export default function ProjectRFQs({ projectId: propProjectId }) {
  const params = useParams();
  const projectId = propProjectId || params.projectId || params.id;
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();

  const [rfqs, setRfqs] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatuses, setFilterStatuses] = useState([]);
  const [filterRounds, setFilterRounds] = useState([]);

  // View
  const [activeViewId, setActiveViewId] = useState("default");
  const [columnIds, setColumnIds] = useState(DEFAULT_COLUMN_IDS);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [rfqList, roundList, currList] = await Promise.all([
        base44.entities.RFQ.filter({ project_id: projectId }, "-created_date", 500),
        base44.entities.RFQRound.list("sequence", 100),
        base44.entities.Currency.filter({ is_active: true }),
      ]);
      setRfqs(rfqList);
      setRounds(roundList);
      setCurrencies(currList);
      setLoading(false);
    };
    if (projectId) load();
  }, [projectId]);

  const roundMap = useMemo(() => {
    const m = {};
    rounds.forEach((r) => { m[r.id] = r; });
    return m;
  }, [rounds]);

  const currencyMap = useMemo(() => {
    const m = {};
    currencies.forEach((c) => { m[c.id] = c; });
    return m;
  }, [currencies]);

  // Register page options — Manage Views
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
  }, [activeViewId, handleSelectView, setOptions]);

  // Apply view config
  useEffect(() => {
    if (activeViewId === "default") { setColumnIds(DEFAULT_COLUMN_IDS); return; }
    base44.entities.ListViewConfig.filter({ id: activeViewId }).then((results) => {
      const v = results[0];
      if (v?.column_ids?.length) setColumnIds(v.column_ids);
      else setColumnIds(DEFAULT_COLUMN_IDS);
    });
  }, [activeViewId]);

  const allColumns = useMemo(() => buildColumns(roundMap, currencyMap), [roundMap, currencyMap]);
  const columns = useMemo(() => columnIds.map((id) => allColumns.find((c) => c.id === id)).filter(Boolean), [columnIds, allColumns]);

  const filteredRfqs = useMemo(() => {
    let list = rfqs;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.code || "").toLowerCase().includes(q) ||
        (r.name || "").toLowerCase().includes(q)
      );
    }
    if (filterStatuses.length > 0) {
      list = list.filter((r) => filterStatuses.includes(r.status));
    }
    if (filterRounds.length > 0) {
      list = list.filter((r) => filterRounds.includes(r.round_id));
    }
    return list;
  }, [rfqs, search, filterStatuses, filterRounds]);

  const toggleStatus = (s) => setFilterStatuses((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  const toggleRound = (id) => setFilterRounds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleRowClick = (row) => {
    navigate(`/projects/${projectId}/rfqs/${row.id}`);
  };

  const handleCreated = (created) => {
    setShowCreateDialog(false);
    navigate(`/projects/${projectId}/rfqs/${created.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-base">RFQs</h2>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-3.5 h-3.5" />
          New RFQ
        </Button>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code or name…"
            className="pl-8 h-8 text-xs w-52"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-1">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={`text-[10px] px-2 py-1 rounded border font-medium capitalize transition-colors ${
                filterStatuses.includes(s)
                  ? STATUS_COLORS[s] + " ring-1 ring-inset ring-current"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {/* Round filter */}
        {rounds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {rounds.filter((r) => r.is_active).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleRound(r.id)}
                className={`text-[10px] px-2 py-1 rounded border font-medium transition-colors ${
                  filterRounds.includes(r.id)
                    ? "bg-primary/10 text-primary border-primary/30 ring-1 ring-inset ring-primary/30"
                    : "bg-background border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        {/* Clear filters */}
        {(filterStatuses.length > 0 || filterRounds.length > 0) && (
          <button
            type="button"
            onClick={() => { setFilterStatuses([]); setFilterRounds([]); }}
            className="text-xs text-muted-foreground hover:text-destructive underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Empty state */}
      {rfqs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
          <FileSearch className="w-10 h-10 opacity-25" />
          <p className="text-sm font-medium">No RFQs yet for this project.</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-3.5 h-3.5" />
            New RFQ
          </Button>
        </div>
      ) : (
        <div
          onClick={(e) => {
            // Find the clicked row
            const tr = e.target.closest("tr");
            if (!tr) return;
            const rowId = tr.dataset.rowId;
            if (rowId) {
              const row = filteredRfqs.find((r) => r.id === rowId);
              if (row) handleRowClick(row);
            }
          }}
        >
          <ClickableDataTable
            columns={columns}
            rows={filteredRfqs}
            onRowClick={handleRowClick}
          />
        </div>
      )}
      {showCreateDialog && (
        <RFQCreateDialog
          projectId={projectId}
          onCreated={handleCreated}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}

// Thin wrapper around DataTable to make rows clickable without modifying DataTable
function ClickableDataTable({ columns, rows, onRowClick }) {
  const clickableColumns = useMemo(() =>
    columns.map((col) => ({
      ...col,
      render: (row) => (
        <div
          className="cursor-pointer"
          onClick={() => onRowClick(row)}
        >
          {col.render ? col.render(row) : "—"}
        </div>
      ),
    })),
    [columns, onRowClick]
  );

  return (
    <DataTable
      columns={clickableColumns}
      rows={rows}
      hideColumnToggle
    />
  );
}