import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { formatDistanceToNow, format } from "date-fns";
import {
  FlowBadge, StatusBadge, PriorityBadge, ReasonBadge,
  FLOW_CONFIG,
} from "@/components/change-management/EcoBadges";
import {
  ArrowLeft, Loader2, CheckCircle2, Clock, X, RefreshCw,
  Archive, FileStack, ClipboardList, SplitSquareVertical, List,
  Plus, CheckCheck, GitMerge, ChevronDown, ChevronUp, Pencil, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import AffectedItemEditor from "@/components/change-management/AffectedItemEditor";
import EcoTransitionButtons from "@/components/change-management/EcoTransitionButtons";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(value) {
  if (!value) return "—";
  return format(new Date(value), "d MMM yyyy, HH:mm");
}

function fmtRel(value) {
  if (!value) return null;
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function FullDate({ value }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span title={fmtRel(value)} className="text-sm">
      {fmt(value)}
    </span>
  );
}

function originLabel(origin) {
  if (!origin) return "—";
  return origin.split("_").map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(" ");
}

// ── Label-value field in metadata card ────────────────────────────────────────
function Field({ label, children, span = 1 }) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : ""}>
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</dt>
      <dd className="text-sm">{children ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, subtitle, count, children }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/20">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {title}{count !== undefined ? ` (${count})` : ""}
          </h2>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

// ── Item type → route resolver ─────────────────────────────────────────────────
function resolveItemLink(item_type, item_id) {
  switch (item_type) {
    case "BOM": return `/boms/${item_id}`;
    case "Product": return `/products/${item_id}`;
    case "ProductColor": return null; // need parent product_id — render plain
    case "ApprovedSupplier": return null; // no dedicated route
    case "ProductColorSupplierLink": return null;
    case "BOMLine": return null; // no standalone route
    case "BOMLineVariant": return null; // no standalone route
    case "SupplierRouting": return null; // embedded in product
    case "SupplierRoutingStep": return null;
    case "ProductRevision": return null; // Phase 17
    default: return null;
  }
}

// ── Downstream type → route resolver ──────────────────────────────────────────
function resolveDownstreamLink(dtype, did) {
  switch (dtype) {
    case "BOM": return `/boms/${did}`;
    case "BOL": return `/boms/${did}`; // no dedicated BOL route; link parent BOM
    case "BOMLine": return null;
    case "BOMLineVariant": return null;
    default: return null;
  }
}

// ── Downstream type icons ──────────────────────────────────────────────────────
const DTYPE_ICON = {
  BOM: <FileStack className="w-3.5 h-3.5 shrink-0" />,
  BOL: <ClipboardList className="w-3.5 h-3.5 shrink-0" />,
  BOMLineVariant: <SplitSquareVertical className="w-3.5 h-3.5 shrink-0" />,
  BOMLine: <List className="w-3.5 h-3.5 shrink-0" />,
};

// ── Propagation status badge ───────────────────────────────────────────────────
const PROP_STATUS_CONFIG = {
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
const NON_TERMINAL = ["pending", "notified", "under_review"];

function PropStatusBadge({ value }) {
  const cls = PROP_STATUS_CONFIG[value] || "bg-muted text-muted-foreground";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>
      {(value || "—").replace(/_/g, " ")}
    </span>
  );
}

// ── Change kind badge ──────────────────────────────────────────────────────────
const KIND_CONFIG = {
  add:      "bg-green-100 text-green-700",
  modify:   "bg-blue-100 text-blue-700",
  remove:   "bg-red-100 text-red-700",
  reassign: "bg-amber-100 text-amber-700",
  release:  "bg-purple-100 text-purple-700",
};
function ChangeKindBadge({ value }) {
  const cls = KIND_CONFIG[value] || "bg-muted text-muted-foreground";
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>{value || "—"}</span>;
}

// ── Field diffs popover ────────────────────────────────────────────────────────
function FieldDiffsPopover({ diffs }) {
  const [open, setOpen] = useState(false);
  if (!diffs || diffs.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors flex items-center gap-1"
      >
        {diffs.length} change{diffs.length !== 1 ? "s" : ""}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[240px] max-w-[320px] space-y-2">
          {diffs.map((d, i) => (
            <div key={i} className="text-xs space-y-0.5">
              <div className="font-semibold text-foreground font-mono">{d.field}</div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="line-through">{d.before === null || d.before === undefined ? "null" : String(d.before)}</span>
                <span>→</span>
                <span className="text-foreground font-medium">{d.after === null || d.after === undefined ? "null" : String(d.after)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Timeline event types ───────────────────────────────────────────────────────
function TimelineEvent({ icon, title, time, detail }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 text-muted-foreground">
          {icon}
        </div>
        <div className="flex-1 w-px bg-border mt-1" />
      </div>
      <div className="pb-4 min-w-0">
        <p className="text-sm font-medium leading-snug">{title}</p>
        {time && (
          <p className="text-xs text-muted-foreground mt-0.5" title={fmt(time)}>
            {fmtRel(time)}
          </p>
        )}
        {detail && <p className="text-xs text-muted-foreground mt-0.5 italic">{detail}</p>}
      </div>
    </div>
  );
}

// ── Skeleton placeholder ───────────────────────────────────────────────────────
function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function PageSkeleton() {
  return (
    <div className="px-4 py-6 space-y-6 max-w-4xl">
      <Skeleton className="h-5 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-80" />
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function EcoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [eco, setEco] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const [affectedItems, setAffectedItems] = useState([]);
  const [affectedDownstream, setAffectedDownstream] = useState([]);
  const [sourceEcr, setSourceEcr] = useState(null);

  // Resulting artifact label map: { id → label }
  const [artifactLabels, setArtifactLabels] = useState({});

  const [itemsError, setItemsError] = useState(false);
  const [downstreamError, setDownstreamError] = useState(false);

  // ── AffectedItem editor state ─────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // null = create, record = edit
  const [removeTarget, setRemoveTarget] = useState(null); // item to confirm-delete

  // ── Full refresh (called after transitions) ───────────────────────────────────
  const refreshAll = () => {
    setLoading(true);
    setEco(null);
    setAffectedItems([]);
    setAffectedDownstream([]);
    base44.entities.ECO.filter({ id })
      .then(async (rows) => {
        if (rows.length === 0) { setNotFound(true); setLoading(false); return; }
        const ecoRow = rows[0];
        setEco(ecoRow);
        const [itemsRes, downstreamRes] = await Promise.allSettled([
          base44.entities.ECOAffectedItem.filter({ eco_id: id }, "created_date", 200),
          base44.entities.ECOAffectedDownstream.filter({ eco_id: id }, "created_date", 200),
        ]);
        if (itemsRes.status === "fulfilled") setAffectedItems(itemsRes.value);
        if (downstreamRes.status === "fulfilled") setAffectedDownstream(downstreamRes.value);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  };

  // ── Fetch ECO ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setEco(null);
    setAffectedItems([]);
    setAffectedDownstream([]);
    setSourceEcr(null);

    base44.entities.ECO.filter({ id })
      .then(async (rows) => {
        if (rows.length === 0) { setNotFound(true); setLoading(false); return; }
        const ecoRow = rows[0];
        setEco(ecoRow);

        // Parallel secondary fetches
        const [itemsRes, downstreamRes, ecrRes] = await Promise.allSettled([
          base44.entities.ECOAffectedItem.filter({ eco_id: id }, "created_date", 200),
          base44.entities.ECOAffectedDownstream.filter({ eco_id: id }, "created_date", 200),
          ecoRow.source_ecr_id
            ? base44.entities.ECR.filter({ id: ecoRow.source_ecr_id })
            : Promise.resolve([]),
        ]);

        const items = itemsRes.status === "fulfilled" ? itemsRes.value : [];
        const downstream = downstreamRes.status === "fulfilled" ? downstreamRes.value : [];
        if (itemsRes.status === "rejected") setItemsError(true);
        if (downstreamRes.status === "rejected") setDownstreamError(true);
        if (ecrRes.status === "fulfilled" && ecrRes.value.length > 0) setSourceEcr(ecrRes.value[0]);

        setAffectedItems(items);
        setAffectedDownstream(downstream);

        // Batch-resolve resulting artifacts for downstream rows
        const bomIds = downstream
          .filter((r) => r.resulting_artifact_type === "BOM" && r.resulting_artifact_id)
          .map((r) => r.resulting_artifact_id);

        if (bomIds.length > 0) {
          try {
            const boms = await base44.entities.BOM.filter({ id: { $in: bomIds } }, "created_date", 100);
            const labelMap = {};
            boms.forEach((b) => {
              labelMap[b.id] = `BOM rev ${b.revision_code || "?"} v${b.version || 1}`;
            });
            setArtifactLabels(labelMap);
          } catch (_) { /* non-fatal */ }
        }

        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  // ── Sorted downstream (non-terminal first) ───────────────────────────────────
  const sortedDownstream = useMemo(() => {
    const nonTerminal = affectedDownstream.filter((r) => NON_TERMINAL.includes(r.propagation_status));
    const terminal = affectedDownstream.filter((r) => !NON_TERMINAL.includes(r.propagation_status));
    return [...nonTerminal, ...terminal];
  }, [affectedDownstream]);

  // ── Downstream summary counts ─────────────────────────────────────────────────
  const { nPending, nReview, nResolved } = useMemo(() => {
    const TERMINAL_STATUSES = ["adopted", "partially_adopted", "rejected", "pinned", "superseded", "not_applicable"];
    return {
      nPending: affectedDownstream.filter((r) => r.propagation_status === "pending" || r.propagation_status === "notified").length,
      nReview: affectedDownstream.filter((r) => r.propagation_status === "under_review").length,
      nResolved: affectedDownstream.filter((r) => TERMINAL_STATUSES.includes(r.propagation_status)).length,
    };
  }, [affectedDownstream]);

  // ── Timeline events ───────────────────────────────────────────────────────────
  const timelineEvents = useMemo(() => {
    if (!eco) return [];
    const events = [];

    // ECO created
    const flowCfg = FLOW_CONFIG[eco.flow_type];
    events.push({
      key: "created",
      icon: <Plus className="w-3.5 h-3.5" />,
      title: `ECO created by ${eco.requested_by || "system"}`,
      time: eco.requested_at,
      detail: `${eco.requested_by || "System"} filed this ${flowCfg?.label || eco.flow_type || ""} ECO.`,
    });

    // Source ECR conversion
    if (eco.source_ecr_id && sourceEcr) {
      events.push({
        key: "ecr",
        icon: <GitMerge className="w-3.5 h-3.5" />,
        title: `Converted from ${sourceEcr.ecr_number}`,
        time: eco.requested_at,
        detail: null,
      });
    }

    // Auto-applied: origin != "manual" means system-triggered, auto-approved-and-applied in one action
    const isAutoApplied =
      eco.applied_at &&
      eco.origin !== "manual" &&
      (eco.status === "applied" || eco.status === "closed");

    if (isAutoApplied) {
      events.push({
        key: "auto_applied",
        icon: <CheckCheck className="w-3.5 h-3.5" />,
        title: "Auto-applied",
        time: eco.applied_at,
        detail: "ECO was automatically approved and applied.",
      });
    } else {
      if (eco.approved_at) {
        const isRejected = eco.status === "rejected";
        events.push({
          key: "approved",
          icon: isRejected ? <X className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />,
          title: isRejected
            ? `Rejected by ${eco.approver_id || "—"}`
            : `Approved by ${eco.approver_id || "—"}`,
          time: eco.approved_at,
          detail: isRejected ? eco.rejection_reason : null,
        });
      }
      if (eco.applied_at) {
        events.push({
          key: "applied",
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          title: "Applied",
          time: eco.applied_at,
          detail: null,
        });
      }
    }

    if (eco.status === "cancelled" && eco.closed_at) {
      events.push({
        key: "cancelled",
        icon: <X className="w-3.5 h-3.5" />,
        title: "Cancelled",
        time: eco.closed_at,
        detail: eco.cancellation_reason,
      });
    }

    if (eco.closed_at && eco.status !== "cancelled") {
      events.push({
        key: "closed",
        icon: <Archive className="w-3.5 h-3.5" />,
        title: "Closed",
        time: eco.closed_at,
        detail: null,
      });
    }

    // Downstream terminal transitions
    affectedDownstream
      .filter((r) => r.reviewed_at)
      .forEach((r) => {
        events.push({
          key: `downstream_${r.id}`,
          icon: <RefreshCw className="w-3.5 h-3.5" />,
          title: `${(r.propagation_status || "").replace(/_/g, " ")} by ${r.reviewed_by || "system"}`,
          time: r.reviewed_at,
          detail: r.downstream_label,
        });
      });

    // Sort newest first
    return events.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
  }, [eco, sourceEcr, affectedDownstream]);

  // ── Render states ─────────────────────────────────────────────────────────────
  if (loading) return <PageSkeleton />;

  if (notFound) return (
    <div className="px-4 py-6 space-y-4 max-w-4xl">
      <Link
        to="/change-management/ecos"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to All ECOs
      </Link>
      <p className="text-muted-foreground">ECO not found.</p>
    </div>
  );

  // ── Editability gate ─────────────────────────────────────────────────────────
  const canEditItems =
    eco.origin === "manual" &&
    ["proposed", "under_review"].includes(eco.status);

  // ── Refresh affected items list ───────────────────────────────────────────────
  const refreshAffectedItems = () => {
    base44.entities.ECOAffectedItem.filter({ eco_id: id }, "created_date", 200)
      .then(setAffectedItems)
      .catch(() => {});
  };

  // ── Remove handler ────────────────────────────────────────────────────────────
  const handleRemoveItem = async () => {
    if (!removeTarget) return;
    try {
      await base44.entities.ECOAffectedItem.delete(removeTarget.id);
      setAffectedItems((prev) => prev.filter((i) => i.id !== removeTarget.id));
      toast({ title: "Affected item removed." });
    } catch (err) {
      toast({ title: "Could not remove item", description: err?.message, variant: "destructive" });
    }
    setRemoveTarget(null);
  };

  const showDisposition = eco.status === "rejected" || eco.status === "cancelled" || eco.notes;
  const downstreamSubtitle = affectedDownstream.length > 0
    ? `${nPending} pending, ${nReview} under review, ${nResolved} resolved`
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] overflow-hidden">
      {/* ── STICKY HEADER ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-3 pt-2 pb-2 border-b border-border bg-background z-10">
        <Link
          to="/change-management/ecos"
          className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Back to All ECOs"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {/* ECO number + title */}
        <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
          <h1 className="font-display font-semibold font-mono text-base shrink-0">{eco.eco_number}</h1>
          <span className="text-muted-foreground text-xs truncate hidden sm:block">{eco.title}</span>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge value={eco.status} />
          <PriorityBadge value={eco.priority} />
          <FlowBadge value={eco.flow_type} />
        </div>

        {/* Transition buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <EcoTransitionButtons
            eco={eco}
            affectedItems={affectedItems}
            affectedDownstream={affectedDownstream}
            onTransitioned={refreshAll}
          />
        </div>
      </div>

      {/* ── SCROLLABLE BODY ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-4 py-6 space-y-6 max-w-4xl">


      {/* ── TASK 2: Metadata card ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        {/* Group A — Identity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <Field label="ECO #">
            <span className="font-mono font-semibold">{eco.eco_number}</span>
          </Field>
          <Field label="Title">{eco.title}</Field>
          {eco.description && (
            <Field label="Description" span={2}>
              <span className="whitespace-pre-line leading-relaxed">{eco.description}</span>
            </Field>
          )}
        </div>

        <div className="border-t border-border" />

        {/* Group B — Classification */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
          <Field label="Status"><StatusBadge value={eco.status} /></Field>
          <Field label="Flow"><FlowBadge value={eco.flow_type} /></Field>
          <Field label="Origin">{originLabel(eco.origin)}</Field>
          <Field label="Reason"><ReasonBadge value={eco.reason_category} /></Field>
          <Field label="Priority"><PriorityBadge value={eco.priority} /></Field>
        </div>

        <div className="border-t border-border" />

        {/* Group C — Lifecycle */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
          <Field label="Requested By">{eco.requested_by || "—"}</Field>
          <Field label="Requested At"><FullDate value={eco.requested_at} /></Field>
          <Field label="Approver">{eco.approver_id || "—"}</Field>
          <Field label="Approved At"><FullDate value={eco.approved_at} /></Field>
          <Field label="Applied At"><FullDate value={eco.applied_at} /></Field>
          <Field label="Closed At"><FullDate value={eco.closed_at} /></Field>
          <Field label="Target Effective Date">
            {eco.target_effective_date ? new Date(eco.target_effective_date).toLocaleDateString() : "—"}
          </Field>
        </div>

        {/* Group D — Disposition (conditional) */}
        {showDisposition && (
          <>
            <div className="border-t border-border" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {eco.status === "rejected" && eco.rejection_reason && (
                <Field label="Rejection Reason" span={2}>
                  <span className="whitespace-pre-line text-destructive">{eco.rejection_reason}</span>
                </Field>
              )}
              {eco.status === "cancelled" && eco.cancellation_reason && (
                <Field label="Cancellation Reason" span={2}>
                  <span className="whitespace-pre-line">{eco.cancellation_reason}</span>
                </Field>
              )}
              {eco.notes && (
                <Field label="Notes" span={2}>
                  <span className="whitespace-pre-line">{eco.notes}</span>
                </Field>
              )}
            </div>
          </>
        )}

        {/* Group E — Source linkage (conditional) */}
        {eco.source_ecr_id && (
          <>
            <div className="border-t border-border" />
            <div className="grid grid-cols-1 gap-y-4">
              <Field label="Source ECR">
                {sourceEcr ? (
                  <Link
                    to={`/change-management/ecrs`}
                    className="text-primary hover:underline font-medium"
                    title={`ECR ID: ${eco.source_ecr_id}`}
                  >
                    {sourceEcr.ecr_number}
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-xs">{eco.source_ecr_id}</span>
                )}
              </Field>
            </div>
          </>
        )}
      </div>

      {/* ── TASK 3: Affected Items ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Affected Items ({affectedItems.length})
            </h2>
          </div>
          {canEditItems && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => { setEditingItem(null); setEditorOpen(true); }}
            >
              <Plus className="w-3 h-3" /> Add affected item
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
        {itemsError ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">Could not load affected items.</p>
            <Button
              size="sm" variant="outline" className="mt-3 text-xs"
              onClick={() =>
                base44.entities.ECOAffectedItem.filter({ eco_id: id }, "created_date", 200)
                  .then(setAffectedItems)
                  .then(() => setItemsError(false))
              }
            >
              Retry
            </Button>
          </div>
        ) : affectedItems.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">
            No affected items recorded for this ECO.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground w-32">Type</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Item</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground w-24">Change</th>
                <th className="px-4 py-2.5 text-center font-semibold text-muted-foreground w-16">Applied</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground w-32">Applied At</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground w-40">Applied By</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground w-28">Field Changes</th>
                {canEditItems && <th className="px-4 py-2.5 w-20" />}
              </tr>
            </thead>
            <tbody>
              {affectedItems.map((item) => {
                const route = resolveItemLink(item.item_type, item.item_id);
                return (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        {item.item_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {route ? (
                        <Link to={route} className="text-primary hover:underline truncate block max-w-[280px]" title={item.item_label}>
                          {item.item_label || item.item_id}
                        </Link>
                      ) : (
                        <span
                          className="text-foreground truncate block max-w-[280px]"
                          title={item.item_type === "ProductRevision"
                            ? "Revision history panel — coming in Phase 17"
                            : `No detail page wired for ${item.item_type}`}
                        >
                          {item.item_label || item.item_id}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3"><ChangeKindBadge value={item.change_kind} /></td>
                    <td className="px-4 py-3 text-center">
                      {item.applied ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <span title={item.application_error || "Not yet applied"}>
                          <Clock className="w-4 h-4 text-amber-500 mx-auto" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.applied_at ? (
                        <span title={fmt(item.applied_at)}>{fmtRel(item.applied_at)}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[160px]">
                      {item.applied_by || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <FieldDiffsPopover diffs={item.field_diffs} />
                    </td>
                    {canEditItems && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button type="button" title="Edit"
                            onClick={() => { setEditingItem(item); setEditorOpen(true); }}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" title="Remove"
                            onClick={() => setRemoveTarget(item)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        </div>
      </div>

      {/* ── TASK 4: Affected Downstream ───────────────────────────────────────── */}
      <Section
        title="Affected Downstream Artifacts"
        count={affectedDownstream.length}
        subtitle={downstreamSubtitle}
      >
        {downstreamError ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">Could not load downstream artifacts.</p>
            <Button
              size="sm" variant="outline" className="mt-3 text-xs"
              onClick={() =>
                base44.entities.ECOAffectedDownstream.filter({ eco_id: id }, "created_date", 200)
                  .then(setAffectedDownstream)
                  .then(() => setDownstreamError(false))
              }
            >
              Retry
            </Button>
          </div>
        ) : affectedDownstream.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">
            No downstream artifacts affected by this ECO.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-28">Status</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-28">Type</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Artifact</th>
                <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground w-12">Flow</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-20">Priority</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-36">Reviewed By</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-32">Reviewed At</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-28">Resulting</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-40">Notes</th>
              </tr>
            </thead>
            <tbody>
              {sortedDownstream.map((row) => {
                const artifactRoute = resolveDownstreamLink(row.downstream_type, row.downstream_id);
                const resultingRoute = row.resulting_artifact_type && row.resulting_artifact_id
                  ? resolveDownstreamLink(row.resulting_artifact_type, row.resulting_artifact_id)
                  : null;
                const resultingLabel = row.resulting_artifact_id
                  ? (artifactLabels[row.resulting_artifact_id] || `${row.resulting_artifact_type}: ${row.resulting_artifact_id.slice(-6)}`)
                  : null;
                const notes = row.decision_notes;
                return (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                    <td className="px-3 py-3"><PropStatusBadge value={row.propagation_status} /></td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        {DTYPE_ICON[row.downstream_type]}
                        <span className="text-xs">{row.downstream_type}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {artifactRoute ? (
                        <Link to={artifactRoute} className="text-primary hover:underline truncate block max-w-[220px]" title={row.downstream_label}>
                          {row.downstream_label || row.downstream_id}
                        </Link>
                      ) : (
                        <span className="truncate block max-w-[220px]" title={row.downstream_label}>
                          {row.downstream_label || row.downstream_id}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center"><FlowBadge value={row.flow_type} /></td>
                    <td className="px-3 py-3"><PriorityBadge value={row.priority} /></td>
                    <td className="px-3 py-3 text-muted-foreground truncate max-w-[140px]">{row.reviewed_by || "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {row.reviewed_at ? (
                        <span title={fmt(row.reviewed_at)} className="cursor-help">{fmtRel(row.reviewed_at)}</span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      {resultingLabel && resultingRoute ? (
                        <Link to={resultingRoute} className="text-primary hover:underline text-xs" title={resultingLabel}>
                          {resultingLabel}
                        </Link>
                      ) : resultingLabel ? (
                        <span className="text-xs text-muted-foreground" title={resultingLabel}>{resultingLabel}</span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {notes ? (
                        <span title={notes} className="cursor-help">
                          {notes.length > 80 ? notes.slice(0, 77) + "…" : notes}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* ── TASK 5: Activity Timeline ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-5">Activity</h2>
        <div className="space-y-0">
          {timelineEvents.map((ev, i) => (
            <TimelineEvent
              key={ev.key}
              icon={ev.icon}
              title={ev.title}
              time={ev.time}
              detail={ev.detail}
            />
          ))}
        </div>
      </div>
      </div>{/* end max-w-4xl */}
      </div>{/* end overflow-y-auto */}

      {/* ── AffectedItem editor modal ──────────────────────────────────────── */}
      {canEditItems && (
        <AffectedItemEditor
          open={editorOpen}
          onClose={() => { setEditorOpen(false); setEditingItem(null); }}
          onSaved={refreshAffectedItems}
          ecoId={id}
          existingItem={editingItem}
        />
      )}

      {/* ── Remove confirmation dialog ────────────────────────────────────── */}
      <AlertDialog open={!!removeTarget} onOpenChange={(v) => { if (!v) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this affected item?</AlertDialogTitle>
            <AlertDialogDescription>
              The downstream impact won't be tracked when the ECO is approved.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}