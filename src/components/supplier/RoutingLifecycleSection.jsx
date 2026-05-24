/**
 * RoutingLifecycleSection
 * Handles Section B (Manufacturing Routings) for the Product → Suppliers tab.
 * Covers: enriched dropdown, lifecycle header, status actions, create-version/revision dialogs, read-only step enforcement.
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, ChevronRight, Building2, Trash2, MoreHorizontal
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
  // Sort: single letters A-Z, then AA, AB... simple lexicographic for short codes
  codes.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });
  const last = codes[codes.length - 1];
  // Increment: "A"→"B", ..., "Z"→"AA", "AA"→"AB", ..., "AZ"→"BA"
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
    // Clone steps from source routing
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

  // Compute next revision code from all routings of same product+type
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
    // Clone steps from source routing
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

  // Reset fields when routing changes
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
    // Clone steps
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

        {/* Read-only source summary */}
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
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. EU Production Route"
            />
            <p className="text-[11px] text-muted-foreground">
              Rename the production routing to distinguish it from the source if needed.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Why this production routing? Any context to record."
            />
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

// ─── Routing Header ───────────────────────────────────────────────────────────
function RoutingHeader({ routing, steps, allRoutings, onToggleDefault, onStatusChange, onSelectRouting, onNewVersion, onNewRevision, onDeriveProduction }) {
  const [confirmDialog, setConfirmDialog] = useState(null); // { type, ... }

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
  if (routing.status === "released" || routing.status === "superseded" || routing.status === "obsolete") {
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

        {/* is_default toggle */}
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

// ─── Step Cards ───────────────────────────────────────────────────────────────
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

// ─── Main export ──────────────────────────────────────────────────────────────
export default function RoutingLifecycleSection({
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
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  const [showCreateRevision, setShowCreateRevision] = useState(false);
  const [showDeriveProduction, setShowDeriveProduction] = useState(false);

  const sorted = sortRoutings(routings);
  const selectedRouting = routings.find((r) => r.id === selectedRoutingId);
  const selectedSteps = routingSteps
    .filter((s) => s.supplier_routing_id === selectedRoutingId)
    .sort((a, b) => a.sequence - b.sequence);

  const isReadOnly = ["released", "superseded", "obsolete"].includes(selectedRouting?.status);

  if (routings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No routings defined. Add one for multi-supplier manufacturing.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Routing selector ──────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {sorted.map((r) => {
          const chip = ROUTING_TYPE_CHIP[r.routing_type];
          const revLabel = `Rev ${r.revision_code || "—"} v${r.version || "—"}`;
          const isSelected = selectedRoutingId === r.id;
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

      {/* ─── Selected routing detail ──────────────────────────────────────── */}
      {selectedRouting && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <RoutingHeader
                routing={selectedRouting}
                steps={selectedSteps}
                allRoutings={routings}
                onToggleDefault={onToggleDefault}
                onStatusChange={onStatusChange}
                onSelectRouting={setSelectedRoutingId}
                onNewVersion={() => setShowCreateVersion(true)}
                onNewRevision={() => setShowCreateRevision(true)}
                onDeriveProduction={() => setShowDeriveProduction(true)}
              />
            </div>
            {!isReadOnly && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive h-7 text-xs shrink-0"
                onClick={() => onDeleteRouting(selectedRouting.id)}
              >
                <Trash2 className="w-3 h-3 mr-1" /> Delete routing
              </Button>
            )}
          </div>

          {/* Step cards */}
          <StepCards
            steps={selectedSteps}
            routing={selectedRouting}
            allSuppliers={allSuppliers}
            currencies={currencies}
            onAddStep={() => onAddStep(selectedRoutingId)}
            onEditStep={onEditStep}
          />

          {/* Cost summary */}
          {selectedSteps.some((s) => s.unit_cost) && (
            <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Total step cost:{" "}
              {selectedSteps.reduce((sum, s) => sum + (Number(s.unit_cost) || 0), 0).toFixed(2)}{" "}
              (mixed currencies may apply) ·{" "}
              {selectedSteps.reduce((sum, s) => sum + (Number(s.lead_time_days) || 0), 0)}d total lead time
            </div>
          )}
        </div>
      )}

      {/* ─── Create Version / Revision dialogs ──────────────────────────── */}
      <CreateVersionDialog
        open={showCreateVersion}
        routing={selectedRouting}
        onClose={() => setShowCreateVersion(false)}
        onCreated={(newR) => {
          setShowCreateVersion(false);
          onNewRoutingAdded(newR);
        }}
      />
      <CreateRevisionDialog
        open={showCreateRevision}
        routing={selectedRouting}
        allRoutings={routings}
        onClose={() => setShowCreateRevision(false)}
        onCreated={(newR) => {
          setShowCreateRevision(false);
          onNewRoutingAdded(newR);
        }}
      />
      <DeriveProductionDialog
        open={showDeriveProduction}
        routing={selectedRouting}
        onClose={() => setShowDeriveProduction(false)}
        onCreated={(newR) => {
          setShowDeriveProduction(false);
          onNewRoutingAdded(newR);
        }}
      />
    </div>
  );
}