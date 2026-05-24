/**
 * RoutingLifecycleSection
 * Supports two modes:
 *   mode="multi"  — lists all routings for a product (Product → Suppliers tab, Section B)
 *   mode="single" — renders one specific routing by routingId (BOM → Manufacturing Operations tab)
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, ChevronRight, Trash2, MoreHorizontal, Loader2, Building2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROUTING_TYPE_CHIP = {
  development: { label: "DEV", bg: "#6B7280", text: "#fff" },
  production:  { label: "PROD", bg: "#10B981", text: "#fff" },
  sample:      { label: "SAMPLE", bg: "#F59E0B", text: "#fff" },
};

const ROUTING_TYPE_ORDER = { development: 0, production: 1, sample: 2 };

const STATUS_BADGE = {
  draft:       "bg-gray-100 text-gray-600 border-gray-200",
  in_review:   "bg-blue-100 text-blue-700 border-blue-200",
  released:    "bg-green-100 text-green-700 border-green-200",
  superseded:  "bg-gray-100 text-gray-400 border-gray-200 line-through",
  obsolete:    "bg-red-100 text-red-700 border-red-200",
};

function RoutingTypeChip({ type }) {
  const cfg = ROUTING_TYPE_CHIP[type] || { label: type?.toUpperCase() || "—", bg: "#9CA3AF", text: "#fff" };
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] || "bg-muted text-muted-foreground border-border";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      {status?.replace(/_/g, " ")}
    </span>
  );
}

function sortRoutings(routings) {
  return [...routings].sort((a, b) => {
    const ta = ROUTING_TYPE_ORDER[a.routing_type] ?? 9;
    const tb = ROUTING_TYPE_ORDER[b.routing_type] ?? 9;
    if (ta !== tb) return ta - tb;
    const na = (a.name || "").localeCompare(b.name || "");
    if (na !== 0) return na;
    const ra = a.revision_code || "";
    const rb = b.revision_code || "";
    if (rb !== ra) return rb.localeCompare(ra);
    return (b.version || 0) - (a.version || 0);
  });
}

function computeNextRevisionCode(existingCodes) {
  if (!existingCodes || existingCodes.length === 0) return "A";
  const codes = existingCodes.filter(Boolean).map((c) => c.toUpperCase());
  codes.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });
  const last = codes[codes.length - 1];
  const chars = last.split("");
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] < "Z") { chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1); break; }
    chars[i] = "A";
    i--;
  }
  if (i < 0) chars.unshift("A");
  return chars.join("");
}

function formatDate(iso) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso; }
}

// ─── Confirmation Dialog ───────────────────────────────────────────────────────
function ConfirmDialog({ open, title, body, confirmLabel, confirmVariant = "default", onConfirm, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground whitespace-pre-line">{body}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create New Version Dialog ────────────────────────────────────────────────
function CreateVersionDialog({ open, routing, onClose, onCreated }) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const newVersion = (routing?.version || 0) + 1;

  const handleCreate = async () => {
    setSaving(true);
    const newRouting = await base44.entities.SupplierRouting.create({
      product_id: routing.product_id,
      name: routing.name,
      routing_type: routing.routing_type,
      revision_code: routing.revision_code,
      version: newVersion,
      status: "draft",
      is_default: false,
      derived_from_routing_id: routing.id,
      derived_from_revision_code: routing.revision_code,
      notes: notes || undefined,
    });
    const sourceSteps = await base44.entities.SupplierRoutingStep.filter({ supplier_routing_id: routing.id });
    if (sourceSteps.length > 0) {
      await Promise.all(sourceSteps.map((s) =>
        base44.entities.SupplierRoutingStep.create({
          supplier_routing_id: newRouting.id,
          sequence: s.sequence,
          step_type: s.step_type,
          supplier_id: s.supplier_id,
          unit_cost: s.unit_cost,
          currency_id: s.currency_id,
          lead_time_days: s.lead_time_days,
          ships_to_next: s.ships_to_next,
          input_description: s.input_description,
          output_description: s.output_description,
          description: s.description,
        })
      ));
    }
    setSaving(false);
    onCreated(newRouting);
  };

  if (!routing) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create new version of Rev {routing.revision_code || "—"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><span className="font-medium text-foreground">Name:</span> {routing.name}</p>
          <p><span className="font-medium text-foreground">Routing Type:</span> {routing.routing_type}</p>
          <p><span className="font-medium text-foreground">Current Revision:</span> Rev {routing.revision_code || "—"} v{routing.version || "—"}</p>
          <p><span className="font-medium text-foreground">New Version:</span> Rev {routing.revision_code || "—"} v{newVersion}</p>
        </div>
        <div className="space-y-1.5 mt-2">
          <Label className="text-xs">Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes for this version" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Creating…" : `Create v${newVersion}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create New Revision Dialog ───────────────────────────────────────────────
function CreateRevisionDialog({ open, routing, allRoutings, onClose, onCreated }) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const siblingCodes = allRoutings
    .filter((r) => r.product_id === routing?.product_id && r.routing_type === routing?.routing_type)
    .map((r) => r.revision_code)
    .filter(Boolean);
  const nextCode = computeNextRevisionCode(siblingCodes);

  const handleCreate = async () => {
    if (!notes.trim()) return;
    setSaving(true);
    const newRouting = await base44.entities.SupplierRouting.create({
      product_id: routing.product_id,
      name: routing.name,
      routing_type: routing.routing_type,
      revision_code: nextCode,
      version: 1,
      status: "draft",
      is_default: false,
      derived_from_routing_id: routing.id,
      derived_from_revision_code: routing.revision_code,
      notes: notes,
    });
    const sourceSteps = await base44.entities.SupplierRoutingStep.filter({ supplier_routing_id: routing.id });
    if (sourceSteps.length > 0) {
      await Promise.all(sourceSteps.map((s) =>
        base44.entities.SupplierRoutingStep.create({
          supplier_routing_id: newRouting.id,
          sequence: s.sequence,
          step_type: s.step_type,
          supplier_id: s.supplier_id,
          unit_cost: s.unit_cost,
          currency_id: s.currency_id,
          lead_time_days: s.lead_time_days,
          ships_to_next: s.ships_to_next,
          input_description: s.input_description,
          output_description: s.output_description,
          description: s.description,
        })
      ));
    }
    setSaving(false);
    onCreated(newRouting);
  };

  if (!routing) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create new revision of {routing.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><span className="font-medium text-foreground">Name:</span> {routing.name}</p>
          <p><span className="font-medium text-foreground">Routing Type:</span> {routing.routing_type}</p>
          <p><span className="font-medium text-foreground">Current Revision:</span> Rev {routing.revision_code || "—"} v{routing.version || "—"}</p>
          <p><span className="font-medium text-foreground">New Revision:</span> Rev {nextCode} v1</p>
        </div>
        <div className="space-y-1.5 mt-2">
          <Label className="text-xs">Why this revision? <span className="text-destructive">*</span></Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Required — describe the reason for creating a new revision" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving || !notes.trim()}>
            {saving ? "Creating…" : `Create Rev ${nextCode}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Derive Production Routing Dialog ────────────────────────────────────────
function DeriveProductionDialog({ open, routing, onClose, onCreated }) {
  const [name, setName] = useState(routing?.name || "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const routingId = routing?.id;
  useState(() => { setName(routing?.name || ""); setNotes(""); }, [routingId]);

  const isDev = routing?.routing_type === "development";
  const sourceChipLabel = isDev ? "DEV" : "PROD";
  const title = isDev
    ? "Derive Production Routing from this Dev Routing"
    : "Derive Alternate Production Routing";
  const confirmLabel = isDev ? "Derive Production Routing" : "Derive Alternate Routing";

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const newRouting = await base44.entities.SupplierRouting.create({
      product_id: routing.product_id,
      name: name.trim(),
      routing_type: "production",
      revision_code: "A",
      version: 1,
      status: "draft",
      is_default: false,
      derived_from_routing_id: routing.id,
      derived_from_revision_code: routing.revision_code,
      notes: notes || "",
      pending_eco_review_count: 0,
    });
    const sourceSteps = await base44.entities.SupplierRoutingStep.filter({ supplier_routing_id: routing.id });
    if (sourceSteps.length > 0) {
      await Promise.all(sourceSteps.map((s) =>
        base44.entities.SupplierRoutingStep.create({
          supplier_routing_id: newRouting.id,
          sequence: s.sequence,
          step_type: s.step_type,
          supplier_id: s.supplier_id,
          unit_cost: s.unit_cost,
          currency_id: s.currency_id,
          lead_time_days: s.lead_time_days,
          ships_to_next: s.ships_to_next,
          input_description: s.input_description,
          output_description: s.output_description,
          description: s.description,
          notes: s.notes,
        })
      ));
    }
    setSaving(false);
    onCreated(newRouting);
  };

  if (!routing) return null;

  const chipCfg = ROUTING_TYPE_CHIP[routing.routing_type] || ROUTING_TYPE_CHIP.development;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5 space-y-1 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-muted-foreground">Source:</span>
            <span className="font-medium">{routing.name}</span>
            <span className="font-bold px-1 py-px rounded text-[9px]"
              style={{ backgroundColor: chipCfg.bg, color: chipCfg.text }}>
              {sourceChipLabel}
            </span>
            <span className="text-muted-foreground font-mono">
              Rev {routing.revision_code || "—"} v{routing.version || "—"}
            </span>
            <StatusBadge status={routing.status} />
          </div>
          <p className="text-muted-foreground">
            New Production Routing: <span className="font-medium text-foreground">Rev A · v1 (draft)</span>
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. EU Production Route" />
            <p className="text-[11px] text-muted-foreground">Rename the production routing to distinguish it from the source if needed.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Why this production routing? Any context to record." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? "Creating…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Routing Header (shared between modes) ────────────────────────────────────
function RoutingHeader({ routing, steps, allRoutings, onToggleDefault, onStatusChange, onSelectRouting, onNewVersion, onNewRevision, onDeriveProduction }) {
  const [confirmDialog, setConfirmDialog] = useState(null);

  const totalLeadTime = steps.reduce((sum, s) => sum + (Number(s.lead_time_days) || 0), 0);
  const isReadOnly = ["released", "superseded", "obsolete"].includes(routing.status);

  const derivedFrom = routing.derived_from_routing_id
    ? allRoutings.find((r) => r.id === routing.derived_from_routing_id)
    : null;
  const supersededBy = routing.superseded_by_id
    ? allRoutings.find((r) => r.id === routing.superseded_by_id)
    : (routing.superseded_by_version_id
      ? allRoutings.find((r) => r.id === routing.superseded_by_version_id)
      : null);

  const metaParts = [];
  if (["released", "superseded", "obsolete"].includes(routing.status)) {
    if (routing.released_by && routing.released_at) {
      metaParts.push(`Released by ${routing.released_by} on ${formatDate(routing.released_at)}`);
    }
  }
  if (routing.valid_from || routing.valid_until) {
    metaParts.push(`Valid: ${routing.valid_from || "—"} → ${routing.valid_until || "∞"}`);
  }

  const handleRelease = async () => {
    const me = await base44.auth.me();
    await onStatusChange(routing.id, "released", {
      released_at: new Date().toISOString(),
      released_by: me?.email || "",
    });
    setConfirmDialog(null);
  };

  const handleMarkObsolete = async () => {
    await onStatusChange(routing.id, "obsolete", {});
    setConfirmDialog(null);
  };

  const handleRestoreToDraft = async () => {
    await onStatusChange(routing.id, "draft", { released_at: null, released_by: null });
    setConfirmDialog(null);
  };

  return (
    <div className="space-y-2">
      {/* Main header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-bold">{routing.name}</span>

        <div className="flex items-center gap-1">
          <Switch
            id={`default-${routing.id}`}
            checked={routing.is_default}
            onCheckedChange={() => !isReadOnly && onToggleDefault(routing)}
            disabled={isReadOnly}
          />
          <Label htmlFor={`default-${routing.id}`} className="text-xs cursor-pointer">Default</Label>
        </div>

        <RoutingTypeChip type={routing.routing_type} />

        <span className="text-xs text-muted-foreground font-mono">
          Rev {routing.revision_code || "—"} · v{routing.version || "—"}
        </span>

        <StatusBadge status={routing.status} />

        {totalLeadTime > 0 && (
          <span className="text-xs text-muted-foreground">{totalLeadTime}d total</span>
        )}

        {routing.pending_eco_review_count > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
            {routing.pending_eco_review_count} ECO pending
          </span>
        )}

        {/* Lifecycle action buttons */}
        {routing.status === "draft" && (
          <div className="flex items-center gap-1.5 ml-auto">
            <Button size="sm" className="h-7 text-xs" onClick={() => onStatusChange(routing.id, "in_review", {})}>
              Submit for Review
            </Button>
            {routing.routing_type !== "sample" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onDeriveProduction}>
                    {routing.routing_type === "development"
                      ? "Derive Production Routing from this Dev Routing"
                      : "Derive Alternate Production Routing"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {routing.status === "in_review" && (
          <div className="flex gap-1.5 ml-auto items-center">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onStatusChange(routing.id, "draft", {})}>
              Back to Draft
            </Button>
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => setConfirmDialog({ type: "release" })}>
              Release
            </Button>
            {routing.routing_type !== "sample" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onDeriveProduction}>
                    {routing.routing_type === "development"
                      ? "Derive Production Routing from this Dev Routing"
                      : "Derive Alternate Production Routing"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {routing.status === "released" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 ml-auto">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onNewVersion}>Create New Version</DropdownMenuItem>
              <DropdownMenuItem onClick={onNewRevision}>Create New Revision</DropdownMenuItem>
              {routing.routing_type !== "sample" && (
                <DropdownMenuItem onClick={onDeriveProduction}>
                  {routing.routing_type === "development"
                    ? "Derive Production Routing from this Dev Routing"
                    : "Derive Alternate Production Routing"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDialog({ type: "obsolete" })}>
                Mark Obsolete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {routing.status === "superseded" && routing.routing_type !== "sample" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 ml-auto">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDeriveProduction}>
                {routing.routing_type === "development"
                  ? "Derive Production Routing from this Dev Routing"
                  : "Derive Alternate Production Routing"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {routing.status === "obsolete" && (
          <div className="flex items-center gap-1.5 ml-auto">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmDialog({ type: "restore" })}>
              Restore to Draft
            </Button>
            {routing.routing_type !== "sample" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onDeriveProduction}>
                    {routing.routing_type === "development"
                      ? "Derive Production Routing from this Dev Routing"
                      : "Derive Alternate Production Routing"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      {/* Meta row */}
      {(metaParts.length > 0 || derivedFrom || supersededBy) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          {metaParts.map((p, i) => <span key={i}>{p}</span>)}
          {derivedFrom && (
            <button
              type="button"
              className="text-[11px] text-primary underline-offset-2 hover:underline"
              onClick={() => onSelectRouting(derivedFrom.id)}
            >
              Derived from {derivedFrom.name} Rev {routing.derived_from_revision_code || derivedFrom.revision_code || "—"}
            </button>
          )}
          {supersededBy && (
            <button
              type="button"
              className="text-[11px] text-primary underline-offset-2 hover:underline"
              onClick={() => onSelectRouting(supersededBy.id)}
            >
              Superseded by {supersededBy.name} Rev {supersededBy.revision_code || "—"} v{supersededBy.version || "—"}
            </button>
          )}
        </div>
      )}

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmDialog?.type === "release"}
        title="Release this routing?"
        body={`Releasing locks all steps from further edits. To change a released routing you must create a new revision or new version.\nRouting: ${routing.name} — Rev ${routing.revision_code || "—"} v${routing.version || "—"}`}
        confirmLabel="Release"
        onConfirm={handleRelease}
        onClose={() => setConfirmDialog(null)}
      />
      <ConfirmDialog
        open={confirmDialog?.type === "obsolete"}
        title="Mark this routing obsolete?"
        body="Obsolete routings are hidden from default views and cannot be referenced by new BOMs. This action can be reversed from the obsolete state."
        confirmLabel="Mark Obsolete"
        confirmVariant="destructive"
        onConfirm={handleMarkObsolete}
        onClose={() => setConfirmDialog(null)}
      />
      <ConfirmDialog
        open={confirmDialog?.type === "restore"}
        title="Restore this routing to draft?"
        body="This routing will return to draft status and become editable again. Released metadata will be cleared."
        confirmLabel="Restore"
        onConfirm={handleRestoreToDraft}
        onClose={() => setConfirmDialog(null)}
      />
    </div>
  );
}

// ─── Step Cards (shared between modes) ────────────────────────────────────────
function StepCards({ steps, routing, allSuppliers, currencies, onAddStep, onEditStep }) {
  const isReadOnly = ["released", "superseded", "obsolete"].includes(routing?.status);
  const tooltip = isReadOnly
    ? `This routing is ${routing.status}. To make changes, create a new version or revision.`
    : undefined;

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2 min-w-max pb-2">
        {steps.map((step, idx) => {
          const sup = allSuppliers.find((s) => s.id === step.supplier_id);
          return (
            <div key={step.id} className="flex items-center gap-2">
              <div
                title={tooltip}
                className={`w-44 rounded-lg border border-border bg-muted/30 p-3 transition-all ${
                  isReadOnly
                    ? "cursor-default opacity-75"
                    : "cursor-pointer hover:border-primary/50 hover:bg-primary/5"
                }`}
                onClick={() => !isReadOnly && onEditStep(step)}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{step.sequence}</span>
                  <span className="text-xs font-semibold capitalize">{step.step_type?.replace(/_/g, " ")}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{sup?.name || "No supplier"}</p>
                <div className="flex gap-2 mt-1.5 text-[10px] text-muted-foreground">
                  {step.lead_time_days && <span>{step.lead_time_days}d</span>}
                  {step.unit_cost && <span>·</span>}
                  {step.unit_cost && <span>{step.unit_cost} {currencies.find((c) => c.id === step.currency_id)?.code || "—"}</span>}
                </div>
                {step.ships_to_next && idx < steps.length - 1 && (
                  <p className="text-[9px] text-primary mt-1">ships to next ↘</p>
                )}
              </div>
              {idx < steps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </div>
          );
        })}

        {!isReadOnly && (
          <Button
            variant="outline"
            size="sm"
            className="h-auto min-h-[88px] w-36 text-xs border-dashed flex-col gap-1"
            onClick={onAddStep}
          >
            <Plus className="w-4 h-4" />
            Add step
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Shared routing body (header + step cards + dialogs) ──────────────────────
function RoutingBody({
  routing,
  steps,
  allRoutings,
  allSuppliers,
  currencies,
  onToggleDefault,
  onStatusChange,
  onSelectRouting,
  onDeleteRouting,
  onAddStep,
  onEditStep,
  onNewRoutingAdded,
  // In single mode, after create we do NOT auto-switch, so caller can pass a no-op
  disableAutoSwitch,
}) {
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  const [showCreateRevision, setShowCreateRevision] = useState(false);
  const [showDeriveProduction, setShowDeriveProduction] = useState(false);

  const isReadOnly = ["released", "superseded", "obsolete"].includes(routing?.status);

  if (!routing) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <RoutingHeader
            routing={routing}
            steps={steps}
            allRoutings={allRoutings}
            onToggleDefault={onToggleDefault}
            onStatusChange={onStatusChange}
            onSelectRouting={onSelectRouting}
            onNewVersion={() => setShowCreateVersion(true)}
            onNewRevision={() => setShowCreateRevision(true)}
            onDeriveProduction={() => setShowDeriveProduction(true)}
          />
        </div>
        {!isReadOnly && onDeleteRouting && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive h-7 text-xs shrink-0"
            onClick={() => onDeleteRouting(routing.id)}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Delete routing
          </Button>
        )}
      </div>

      <StepCards
        steps={steps}
        routing={routing}
        allSuppliers={allSuppliers}
        currencies={currencies}
        onAddStep={() => onAddStep(routing.id)}
        onEditStep={onEditStep}
      />

      {steps.some((s) => s.unit_cost) && (
        <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Total step cost:{" "}
          {steps.reduce((sum, s) => sum + (Number(s.unit_cost) || 0), 0).toFixed(2)}{" "}
          (mixed currencies may apply) ·{" "}
          {steps.reduce((sum, s) => sum + (Number(s.lead_time_days) || 0), 0)}d total lead time
        </div>
      )}

      <CreateVersionDialog
        open={showCreateVersion}
        routing={routing}
        onClose={() => setShowCreateVersion(false)}
        onCreated={(newR) => {
          setShowCreateVersion(false);
          if (!disableAutoSwitch) onNewRoutingAdded(newR);
          else onNewRoutingAdded(newR); // always notify parent, parent decides what to do
        }}
      />
      <CreateRevisionDialog
        open={showCreateRevision}
        routing={routing}
        allRoutings={allRoutings}
        onClose={() => setShowCreateRevision(false)}
        onCreated={(newR) => {
          setShowCreateRevision(false);
          onNewRoutingAdded(newR);
        }}
      />
      <DeriveProductionDialog
        open={showDeriveProduction}
        routing={routing}
        onClose={() => setShowDeriveProduction(false)}
        onCreated={(newR) => {
          setShowDeriveProduction(false);
          onNewRoutingAdded(newR);
        }}
      />
    </div>
  );
}

// ─── Routing Step Modal (shared, used in both single and multi modes) ─────────
function RoutingStepModal({ open, onClose, onSave, onDelete, suppliers, lovValues, currencies, existing }) {
  const [form, setForm] = useState({ step_type: "", supplier_id: "", description: "", unit_cost: "", currency_id: "", lead_time_days: "", ships_to_next: true, input_description: "", output_description: "", notes: "" });
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (open) {
      if (existing) setForm({ ...existing, unit_cost: existing.unit_cost || "", lead_time_days: existing.lead_time_days || "" });
      else setForm({ step_type: "", supplier_id: "", description: "", unit_cost: "", currency_id: "", lead_time_days: "", ships_to_next: true, input_description: "", output_description: "", notes: "" });
      setSearch(existing ? (suppliers.find((s) => s.id === existing.supplier_id)?.name || "") : "");
    }
  }, [open, existing]);

  const getLov = (cat) => lovValues.filter((v) => v.category === cat).map((v) => v.name);
  const filteredSuppliers = suppliers.filter((s) => !search || s.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{existing ? "Edit Step" : "Add Routing Step"}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Step Type *</Label>
              <Select value={form.step_type || "none"} onValueChange={(v) => setForm((f) => ({ ...f, step_type: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  {getLov("routing_step_type").map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lead Time (days)</Label>
              <Input type="number" value={form.lead_time_days || ""} onChange={(e) => setForm((f) => ({ ...f, lead_time_days: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Supplier</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search supplier…" className="h-8 text-xs mb-1" />
            <div className="border border-border rounded-lg max-h-32 overflow-y-auto">
              {filteredSuppliers.map((s) => (
                <button key={s.id} type="button" onClick={() => { setForm((f) => ({ ...f, supplier_id: s.id })); setSearch(s.name); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${form.supplier_id === s.id ? "bg-primary/10 text-primary" : ""}`}>
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={form.description || ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What this supplier does at this step" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Unit Cost</Label>
              <Input type="number" value={form.unit_cost || ""} onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Select value={form.currency_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, currency_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {currencies.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Input description</Label>
              <Input value={form.input_description || ""} onChange={(e) => setForm((f) => ({ ...f, input_description: e.target.value }))} placeholder="What arrives" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Output description</Label>
              <Input value={form.output_description || ""} onChange={(e) => setForm((f) => ({ ...f, output_description: e.target.value }))} placeholder="What leaves" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ships-next-single" checked={!!form.ships_to_next} onCheckedChange={(v) => setForm((f) => ({ ...f, ships_to_next: v }))} />
            <Label htmlFor="ships-next-single" className="text-sm cursor-pointer">Ships directly to next step</Label>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {existing && onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete} className="mr-auto">Delete step</Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.step_type}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Single mode (BOM detail → Manufacturing Operations tab) ──────────────────
function SingleModeSection({ routingId, onRoutingCreated }) {
  const navigate = useNavigate();
  const [routing, setRouting] = useState(null);
  const [steps, setSteps] = useState([]);
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [lovValues, setLovValues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Step modal state
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [targetRoutingId, setTargetRoutingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const [routings, suppliersRes, currenciesRes, lovsRes] = await Promise.all([
      base44.entities.SupplierRouting.filter({ id: routingId }),
      base44.entities.Supplier.list("name", 500),
      base44.entities.Currency.filter({ is_active: true }),
      base44.entities.ListOfValues.list("name", 2000),
    ]);
    const r = routings[0] || null;
    setRouting(r);
    if (r) {
      const stepsRes = await base44.entities.SupplierRoutingStep.filter({ supplier_routing_id: routingId });
      setSteps(stepsRes.sort((a, b) => a.sequence - b.sequence));
    }
    setAllSuppliers(suppliersRes);
    setCurrencies(currenciesRes);
    setLovValues(lovsRes);
    setLoading(false);
  };

  useEffect(() => {
    if (routingId) load();
  }, [routingId]);

  const handleStatusChange = async (rId, newStatus, extra) => {
    await base44.entities.SupplierRouting.update(rId, { status: newStatus, ...extra });
    await load();
  };

  const handleToggleDefault = async (r) => {
    const newVal = !r.is_default;
    if (newVal) {
      const siblings = await base44.entities.SupplierRouting.filter({ product_id: r.product_id, routing_type: r.routing_type, is_default: true });
      await Promise.all(siblings.filter((s) => s.id !== r.id).map((s) =>
        base44.entities.SupplierRouting.update(s.id, { is_default: false })
      ));
    }
    await base44.entities.SupplierRouting.update(r.id, { is_default: newVal });
    await load();
  };

  const handleAddStep = (rId) => {
    setEditingStep(null);
    setTargetRoutingId(rId);
    setShowStepModal(true);
  };

  const handleEditStep = (step) => {
    setEditingStep(step);
    setTargetRoutingId(step.supplier_routing_id);
    setShowStepModal(true);
  };

  const handleSaveStep = async (form) => {
    const rId = targetRoutingId;
    if (editingStep) {
      await base44.entities.SupplierRoutingStep.update(editingStep.id, {
        step_type: form.step_type,
        supplier_id: form.supplier_id,
        description: form.description,
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        currency_id: form.currency_id || null,
        lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
        ships_to_next: form.ships_to_next,
        input_description: form.input_description,
        output_description: form.output_description,
        notes: form.notes,
      });
    } else {
      const seq = steps.filter((s) => s.supplier_routing_id === rId).length + 1;
      await base44.entities.SupplierRoutingStep.create({
        supplier_routing_id: rId,
        sequence: seq,
        step_type: form.step_type,
        supplier_id: form.supplier_id,
        description: form.description,
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        currency_id: form.currency_id || null,
        lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
        ships_to_next: form.ships_to_next,
        input_description: form.input_description,
        output_description: form.output_description,
        notes: form.notes,
      });
    }
    setShowStepModal(false);
    setEditingStep(null);
    await load();
  };

  const handleDeleteStep = async () => {
    const deletedStep = editingStep;
    const rId = deletedStep.supplier_routing_id;
    await base44.entities.SupplierRoutingStep.delete(deletedStep.id);
    const remaining = steps.filter((s) => s.id !== deletedStep.id && s.supplier_routing_id === rId)
      .sort((a, b) => a.sequence - b.sequence);
    await Promise.all(remaining.map((s, i) =>
      base44.entities.SupplierRoutingStep.update(s.id, { sequence: i + 1 })
    ));
    setShowStepModal(false);
    setEditingStep(null);
    await load();
  };

  // In single mode: after a new routing version/revision is created, stay on original routing
  // but reload to get fresh data (the new routing may affect the list used by allRoutings for meta)
  const handleNewRoutingAdded = async (newR) => {
    await load();
    if (onRoutingCreated) onRoutingCreated(newR);
  };

  // Navigate to product suppliers tab — best-effort navigation without deep-link selection
  const handleSelectRouting = (linkedRoutingId) => {
    if (routing?.product_id) {
      navigate(`/products/${routing.product_id}?tab=suppliers`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!routing) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Routing not found.
      </div>
    );
  }

  return (
    <>
      <RoutingBody
        routing={routing}
        steps={steps}
        allRoutings={[routing]}
        allSuppliers={allSuppliers}
        currencies={currencies}
        onToggleDefault={handleToggleDefault}
        onStatusChange={handleStatusChange}
        onSelectRouting={handleSelectRouting}
        onDeleteRouting={null}
        onAddStep={handleAddStep}
        onEditStep={handleEditStep}
        onNewRoutingAdded={handleNewRoutingAdded}
        disableAutoSwitch={true}
      />
      <RoutingStepModal
        open={showStepModal}
        onClose={() => { setShowStepModal(false); setEditingStep(null); }}
        onSave={handleSaveStep}
        onDelete={editingStep ? handleDeleteStep : null}
        suppliers={allSuppliers}
        lovValues={lovValues}
        currencies={currencies}
        existing={editingStep}
      />
    </>
  );
}

// ─── Multi mode (Product → Suppliers tab, Section B) — existing behavior ──────
function MultiModeSection({
  routings,
  routingSteps,
  selectedRoutingId,
  setSelectedRoutingId,
  allSuppliers,
  currencies,
  onToggleDefault,
  onStatusChange,
  onAddStep,
  onEditStep,
  onAddRouting,
  onDeleteRouting,
  onNewRoutingAdded,
}) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [showObsolete, setShowObsolete] = useState(false);

  const sorted = sortRoutings(routings);

  const HIDDEN_STATUSES = ["obsolete", "superseded"];
  const filteredSorted = sorted.filter((r) => {
    if (typeFilter !== "all" && r.routing_type !== typeFilter) return false;
    if (!showObsolete && HIDDEN_STATUSES.includes(r.status)) return false;
    return true;
  });

  const visibleIds = new Set(filteredSorted.map((r) => r.id));
  const effectiveSelectedId = visibleIds.has(selectedRoutingId)
    ? selectedRoutingId
    : (filteredSorted[0]?.id || null);

  const selectedRouting = routings.find((r) => r.id === effectiveSelectedId);
  const selectedSteps = routingSteps
    .filter((s) => s.supplier_routing_id === effectiveSelectedId)
    .sort((a, b) => a.sequence - b.sequence);

  const TYPE_FILTER_OPTIONS = [
    { value: "all", label: "All" },
    { value: "development", label: "Development" },
    { value: "production", label: "Production" },
    { value: "sample", label: "Sample" },
  ];

  const filterRow = (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex gap-1.5">
        {TYPE_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTypeFilter(opt.value)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              typeFilter === opt.value
                ? "bg-foreground text-background border-foreground"
                : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          className="w-3.5 h-3.5 accent-foreground"
          checked={showObsolete}
          onChange={(e) => setShowObsolete(e.target.checked)}
        />
        <span className="text-xs text-muted-foreground">Include obsolete and superseded</span>
      </label>
    </div>
  );

  if (routings.length === 0) {
    return (
      <div className="space-y-3">
        {filterRow}
        <p className="text-sm text-muted-foreground text-center py-4">
          No routings defined. Add one for multi-supplier manufacturing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filterRow}

      {filteredSorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-3">No routings match the current filters.</p>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {filteredSorted.map((r) => {
            const chip = ROUTING_TYPE_CHIP[r.routing_type];
            const revLabel = `Rev ${r.revision_code || "—"} v${r.version || "—"}`;
            const isSelected = effectiveSelectedId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRoutingId(r.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border hover:bg-muted"
                }`}
              >
                {r.is_default && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
                <span>{r.name}</span>
                {chip && (
                  <span
                    className="text-[9px] font-bold px-1 py-px rounded"
                    style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : chip.bg, color: isSelected ? "#fff" : chip.text }}
                  >
                    {chip.label}
                  </span>
                )}
                <span className={isSelected ? "text-primary-foreground/70" : "text-muted-foreground"} style={{ fontSize: 10 }}>
                  {revLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedRouting && filteredSorted.length > 0 && (
        <RoutingBody
          routing={selectedRouting}
          steps={selectedSteps}
          allRoutings={routings}
          allSuppliers={allSuppliers}
          currencies={currencies}
          onToggleDefault={onToggleDefault}
          onStatusChange={onStatusChange}
          onSelectRouting={setSelectedRoutingId}
          onDeleteRouting={onDeleteRouting}
          onAddStep={onAddStep}
          onEditStep={onEditStep}
          onNewRoutingAdded={(newR) => {
            onNewRoutingAdded(newR);
            setSelectedRoutingId(newR.id); // multi mode: auto-switch to newly created routing
          }}
          disableAutoSwitch={false}
        />
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function RoutingLifecycleSection(props) {
  const { mode } = props;

  if (mode === "single") {
    return <SingleModeSection routingId={props.routingId} onRoutingCreated={props.onRoutingCreated} />;
  }

  // mode === "multi" — pass through all existing props
  return (
    <MultiModeSection
      routings={props.routings}
      routingSteps={props.routingSteps}
      selectedRoutingId={props.selectedRoutingId}
      setSelectedRoutingId={props.setSelectedRoutingId}
      allSuppliers={props.allSuppliers}
      currencies={props.currencies}
      onToggleDefault={props.onToggleDefault}
      onStatusChange={props.onStatusChange}
      onAddStep={props.onAddStep}
      onEditStep={props.onEditStep}
      onAddRouting={props.onAddRouting}
      onDeleteRouting={props.onDeleteRouting}
      onNewRoutingAdded={props.onNewRoutingAdded}
    />
  );
}