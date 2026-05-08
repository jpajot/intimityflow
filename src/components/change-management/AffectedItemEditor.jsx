/**
 * AffectedItemEditor
 * Modal for adding or editing an ECOAffectedItem on a manual ECO.
 * Sections: Entity selection → Snapshot capture → Where-used preview + item label.
 */
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, X, Download, AlertCircle, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// ── Constants ──────────────────────────────────────────────────────────────────

const ITEM_TYPES = [
  { value: "BOM",                     label: "BOM" },
  { value: "BOMLine",                 label: "BOM Line" },
  { value: "BOMLineVariant",          label: "BOM Line Variant" },
  { value: "SupplierRouting",         label: "Supplier Routing" },
  { value: "SupplierRoutingStep",     label: "Supplier Routing Step" },
  { value: "ApprovedSupplier",        label: "Approved Supplier" },
  { value: "ProductColorSupplierLink",label: "Product Color Supplier Link" },
  { value: "ProductColor",            label: "Product Color" },
  { value: "Product",                 label: "Product" },
  { value: "ProductRevision",         label: "Product Revision" },
];

const CHANGE_KINDS = [
  { value: "modify",   label: "Modify existing" },
  { value: "add",      label: "Add new" },
  { value: "remove",   label: "Remove existing" },
  { value: "reassign", label: "Reassign / re-link" },
  { value: "release",  label: "Release (state transition)" },
];

// ── JSON textarea component ────────────────────────────────────────────────────
function JsonTextarea({ value, onChange, placeholder, disabled }) {
  const [error, setError] = useState(null);

  const handleBlur = () => {
    if (!value.trim() || value.trim() === "{}") { setError(null); return; }
    try { JSON.parse(value); setError(null); }
    catch { setError("Invalid JSON"); }
  };

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => { onChange(e.target.value); setError(null); }}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        rows={6}
        className={`w-full rounded-md border text-xs font-mono p-2 resize-y bg-background
          ${disabled ? "opacity-40 cursor-not-allowed" : ""}
          ${error ? "border-destructive" : "border-input"}
          focus:outline-none focus:ring-1 focus:ring-ring`}
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

// ── Entity search helper ───────────────────────────────────────────────────────
async function searchEntities(itemType, query) {
  const q = (query || "").toLowerCase().trim();
  switch (itemType) {
    case "Product": {
      const rows = await base44.entities.Product.list("-created_date", 200);
      const filtered = rows.filter(r =>
        `${r.code || ""} ${r.name || ""}`.toLowerCase().includes(q)
      );
      return filtered.slice(0, 10).map(r => ({
        id: r.id,
        label: `${r.code || ""} ${r.name}`.trim(),
        record: r,
      }));
    }
    case "ProductColor": {
      const rows = await base44.entities.ProductColor.list("-created_date", 500);
      const filtered = rows.filter(r =>
        `${r.color_name || ""} ${r.colorway_code || ""}`.toLowerCase().includes(q)
      );
      const productIds = [...new Set(filtered.slice(0, 20).map(r => r.product_id))];
      let productMap = {};
      if (productIds.length > 0) {
        const prods = await base44.entities.Product.filter({ id: { $in: productIds } }, "-created_date", 50);
        prods.forEach(p => { productMap[p.id] = p; });
      }
      return filtered.slice(0, 10).map(r => {
        const prod = productMap[r.product_id];
        return {
          id: r.id,
          label: `${prod ? prod.name : "?"} — ${r.color_name}${r.colorway_code ? ` (${r.colorway_code})` : ""}`,
          record: r,
        };
      });
    }
    case "BOM": {
      const rows = await base44.entities.BOM.list("-created_date", 200);
      const productIds = [...new Set(rows.map(r => r.product_id))];
      let productMap = {};
      if (productIds.length > 0) {
        const prods = await base44.entities.Product.filter({ id: { $in: productIds } }, "-created_date", 200);
        prods.forEach(p => { productMap[p.id] = p; });
      }
      const labeled = rows.map(r => {
        const prod = productMap[r.product_id];
        return {
          id: r.id,
          label: `${r.bom_type === "production" ? "Prod" : "Dev"} BOM rev ${r.revision_code || "?"} v${r.version || 1} — ${prod ? prod.name : r.product_id}`,
          record: r,
        };
      });
      return labeled.filter(r => r.label.toLowerCase().includes(q)).slice(0, 10);
    }
    case "BOMLine": {
      const rows = await base44.entities.BOMLine.list("-created_date", 300);
      const filtered = rows.filter(r =>
        `${r.component_role || ""} ${r.bom_id || ""}`.toLowerCase().includes(q)
      );
      return filtered.slice(0, 10).map(r => ({
        id: r.id,
        label: `BOMLine #${r.position ?? "?"} — ${r.component_role || "—"} (BOM: ${r.bom_id.slice(-6)})`,
        record: r,
      }));
    }
    case "BOMLineVariant": {
      const rows = await base44.entities.BOMLineVariant.list("-created_date", 300);
      const filtered = rows.filter(r =>
        `${r.bom_line_id || ""}`.toLowerCase().includes(q)
      );
      return filtered.slice(0, 10).map(r => ({
        id: r.id,
        label: `BOMLineVariant (line: ${r.bom_line_id?.slice(-6)}) color:${r.product_color_id?.slice(-6) || "—"}`,
        record: r,
      }));
    }
    case "SupplierRouting": {
      const rows = await base44.entities.SupplierRouting.list("-created_date", 200);
      const productIds = [...new Set(rows.map(r => r.product_id))];
      let productMap = {};
      if (productIds.length > 0) {
        const prods = await base44.entities.Product.filter({ id: { $in: productIds } }, "-created_date", 100);
        prods.forEach(p => { productMap[p.id] = p; });
      }
      const labeled = rows.map(r => {
        const prod = productMap[r.product_id];
        return {
          id: r.id,
          label: `${r.name} (${prod ? prod.name : r.product_id})`,
          record: r,
        };
      });
      return labeled.filter(r => r.label.toLowerCase().includes(q)).slice(0, 10);
    }
    case "SupplierRoutingStep": {
      const rows = await base44.entities.SupplierRoutingStep.list("-created_date", 300);
      const filtered = rows.filter(r =>
        `${r.step_type || ""} ${r.description || ""}`.toLowerCase().includes(q)
      );
      return filtered.slice(0, 10).map(r => ({
        id: r.id,
        label: `Step ${r.sequence} — ${r.step_type || "—"} (routing: ${r.supplier_routing_id?.slice(-6)})`,
        record: r,
      }));
    }
    case "ApprovedSupplier": {
      const rows = await base44.entities.ApprovedSupplier.list("-created_date", 200);
      const productIds = [...new Set(rows.map(r => r.product_id))];
      let productMap = {};
      if (productIds.length > 0) {
        const prods = await base44.entities.Product.filter({ id: { $in: productIds } }, "-created_date", 100);
        prods.forEach(p => { productMap[p.id] = p; });
      }
      const labeled = rows.map(r => {
        const prod = productMap[r.product_id];
        return {
          id: r.id,
          label: `${prod ? prod.name : r.product_id} — supplier: ${r.supplier_id?.slice(-6)} rank ${r.rank ?? "?"}`,
          record: r,
        };
      });
      return labeled.filter(r => r.label.toLowerCase().includes(q)).slice(0, 10);
    }
    case "ProductColorSupplierLink": {
      const rows = await base44.entities.ProductColorSupplierLink.list("-created_date", 200);
      return rows.filter(r =>
        `${r.product_color_id || ""} ${r.approved_supplier_id || ""}`.toLowerCase().includes(q)
      ).slice(0, 10).map(r => ({
        id: r.id,
        label: `ProductColorSupplierLink (color: ${r.product_color_id?.slice(-6)} / supplier: ${r.approved_supplier_id?.slice(-6)})`,
        record: r,
      }));
    }
    case "ProductRevision": {
      const rows = await base44.entities.ProductRevision.list("-created_date", 200);
      const filtered = rows.filter(r =>
        `${r.revision_code || ""} ${r.target_type || ""} ${r.revision_context || ""}`.toLowerCase().includes(q)
      );
      const productIds = [...new Set(filtered.slice(0, 20).map(r => r.product_id))];
      let productMap = {};
      if (productIds.length > 0) {
        const prods = await base44.entities.Product.filter({ id: { $in: productIds } }, "-created_date", 50);
        prods.forEach(p => { productMap[p.id] = p; });
      }
      return filtered.slice(0, 10).map(r => {
        const prod = productMap[r.product_id];
        return {
          id: r.id,
          label: `${prod ? prod.name : r.product_id} — ${r.target_type} rev ${r.revision_code || "?"}`,
          record: r,
        };
      });
    }
    default: return [];
  }
}

// ── Entity picker sub-component ────────────────────────────────────────────────
function EntityPicker({ itemType, value, onSelect, disabled }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  const runSearch = useCallback(async (q) => {
    if (!itemType) return;
    setSearching(true);
    const res = await searchEntities(itemType, q).catch(() => []);
    setResults(res);
    setSearching(false);
    setOpen(true);
  }, [itemType]);

  useEffect(() => {
    if (!disabled && itemType) {
      const timer = setTimeout(() => runSearch(query), 250);
      return () => clearTimeout(timer);
    }
  }, [query, itemType, disabled, runSearch]);

  // Reset when item type changes
  useEffect(() => {
    setQuery("");
    setResults([]);
    setOpen(false);
  }, [itemType]);

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-muted/30">
        <span className="flex-1 text-sm truncate">{value.label}</span>
        <button type="button" onClick={() => { onSelect(null); setQuery(""); setOpen(false); }}
          className="text-muted-foreground hover:text-destructive shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); else runSearch(query); }}
          placeholder={disabled ? "Select a type first…" : "Search…"}
          disabled={disabled}
          className="pl-8 h-9 text-sm"
        />
        {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {results.map((r) => (
            <button key={r.id} type="button"
              onClick={() => { onSelect(r); setOpen(false); setQuery(""); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors border-b border-border/40 last:border-0">
              <div className="font-medium text-foreground truncate">{r.label}</div>
              <div className="text-muted-foreground font-mono">{r.id.slice(-12)}</div>
            </button>
          ))}
        </div>
      )}
      {open && !searching && results.length === 0 && query.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl px-3 py-3 text-xs text-muted-foreground">
          No results found.
        </div>
      )}
    </div>
  );
}

// ── Where-used preview ─────────────────────────────────────────────────────────
function WhereUsedPreview({ itemType, itemId }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!itemType || !itemId) { setResult(null); setError(null); return; }
    setLoading(true);
    setResult(null);
    setError(null);
    base44.functions.invoke("getWhereUsed", { entity_type: itemType, entity_id: itemId })
      .then(res => { setResult(res.data); setLoading(false); })
      .catch(err => { setError(err?.message || "Error"); setLoading(false); });
  }, [itemType, itemId]);

  if (!itemId) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Downstream impact preview</p>
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Computing…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5" /> Could not compute downstream impact. {error}
        </div>
      )}
      {result && !loading && (
        <>
          {result.groups
            ?.filter(g => g.count > 0)
            .map(g => (
              <div key={g.relationship_key} className="flex items-center justify-between text-xs">
                <span className="text-foreground truncate mr-2">{g.relationship}</span>
                <span className="shrink-0 px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">{g.count}</span>
              </div>
            ))
          }
          {result.groups?.every(g => g.count === 0) && (
            <p className="text-xs text-muted-foreground">No downstream artifacts found.</p>
          )}
          {result.groups?.some(g => g.count > 0) && (
            <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              These will be auto-tracked as Affected Downstream rows when the ECO is approved.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Compute field diffs (mirrors addEcoAffectedItem backend logic) ─────────────
function computeFieldDiffs(before, after) {
  if (!before || !after) return [];
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  const diffs = [];
  for (const field of keys) {
    const b = before[field] ?? null;
    const a = after[field] ?? null;
    if (b === null && a === null) continue;
    if (JSON.stringify(b) !== JSON.stringify(a)) diffs.push({ field, before: b, after: a });
  }
  return diffs;
}

function safeParseJson(str) {
  if (!str || str.trim() === "" || str.trim() === "{}") return {};
  try { return JSON.parse(str); } catch { return null; }
}

function isValidJson(str) {
  if (!str || str.trim() === "" || str.trim() === "{}") return true;
  try { JSON.parse(str); return true; } catch { return false; }
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AffectedItemEditor({ open, onClose, onSaved, ecoId, existingItem }) {
  const { toast } = useToast();
  const isEditMode = !!existingItem;

  // Section 1
  const [itemType, setItemType] = useState("");
  const [pickedEntity, setPickedEntity] = useState(null); // { id, label, record }
  const [changeKind, setChangeKind] = useState("modify");

  // Section 2 (JSON strings)
  const [beforeJson, setBeforeJson] = useState("{}");
  const [afterJson, setAfterJson] = useState("{}");
  const [capturingBefore, setCapturingBefore] = useState(false);

  // Section 3
  const [itemLabel, setItemLabel] = useState("");

  const [saving, setSaving] = useState(false);

  // ── Init for edit mode ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (isEditMode && existingItem) {
      setItemType(existingItem.item_type || "");
      setPickedEntity(existingItem.item_id ? { id: existingItem.item_id, label: existingItem.item_label || existingItem.item_id } : null);
      setChangeKind(existingItem.change_kind || "modify");
      setBeforeJson(existingItem.before_snapshot ? JSON.stringify(existingItem.before_snapshot, null, 2) : "{}");
      setAfterJson(existingItem.after_snapshot ? JSON.stringify(existingItem.after_snapshot, null, 2) : "{}");
      setItemLabel(existingItem.item_label || "");
    } else {
      // Reset for create mode
      setItemType("");
      setPickedEntity(null);
      setChangeKind("modify");
      setBeforeJson("{}");
      setAfterJson("{}");
      setItemLabel("");
    }
  }, [open, isEditMode, existingItem]);

  // Auto-set item_label when entity picked
  const handlePickEntity = (entity) => {
    setPickedEntity(entity);
    if (entity && !isEditMode) setItemLabel(entity.label);
  };

  // Capture current state of the entity
  const handleCaptureBefore = async () => {
    if (!pickedEntity || !itemType) return;
    setCapturingBefore(true);
    try {
      const entityObj = base44.entities[itemType];
      const rows = await entityObj.filter({ id: pickedEntity.id });
      if (rows.length > 0) {
        const { id: _id, created_date: _c, updated_date: _u, created_by: _cb, created_by_id: _cbid, ...rest } = rows[0];
        const json = JSON.stringify(rest, null, 2);
        setBeforeJson(json);
        // For modify/reassign/release, seed after_snapshot from before
        if (["modify", "reassign", "release"].includes(changeKind)) {
          setAfterJson(json);
        }
      }
    } catch (e) {
      toast({ title: "Could not capture state", description: e.message, variant: "destructive" });
    }
    setCapturingBefore(false);
  };

  // Show/hide snapshot sections based on change_kind
  const showBefore = changeKind !== "add";
  const showAfter = changeKind !== "remove";

  // ── Validation ───────────────────────────────────────────────────────────────
  const jsonBeforeValid = isValidJson(beforeJson);
  const jsonAfterValid = isValidJson(afterJson);

  const canSave =
    itemType &&
    pickedEntity &&
    changeKind &&
    jsonBeforeValid &&
    jsonAfterValid;

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const parsedBefore = showBefore ? safeParseJson(beforeJson) : {};
    const parsedAfter = showAfter ? safeParseJson(afterJson) : {};

    setSaving(true);
    try {
      if (isEditMode) {
        // Direct SDK update, recompute field_diffs
        const field_diffs = computeFieldDiffs(parsedBefore, parsedAfter);
        await base44.entities.ECOAffectedItem.update(existingItem.id, {
          item_type: itemType,
          item_id: pickedEntity.id,
          item_label: itemLabel || pickedEntity.label,
          change_kind: changeKind,
          before_snapshot: parsedBefore || null,
          after_snapshot: parsedAfter || null,
          field_diffs,
        });
        toast({ title: "Affected item updated." });
      } else {
        const res = await base44.functions.invoke("addEcoAffectedItem", {
          eco_id: ecoId,
          item_type: itemType,
          item_id: pickedEntity.id,
          item_label: itemLabel || pickedEntity.label,
          change_kind: changeKind,
          before_snapshot: parsedBefore || null,
          after_snapshot: parsedAfter || null,
          notes: null,
        });
        if (res.data?.error) throw new Error(res.data.error);
        toast({ title: "Affected item added." });
      }
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: isEditMode ? "Could not update item" : "Could not add item", description: err?.response?.data?.error || err?.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const section2Disabled = !pickedEntity || !changeKind;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isEditMode ? "Edit affected item" : "Add affected item"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ── Section 1 — Entity selection ──────────────────────────────── */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">1. Entity selection</p>

            <div className="space-y-1.5">
              <Label className="text-xs">Item type <span className="text-destructive">*</span></Label>
              <Select value={itemType} onValueChange={(v) => { setItemType(v); setPickedEntity(null); setItemLabel(""); setBeforeJson("{}"); setAfterJson("{}"); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select entity type…" />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">What kind of entity does this change target?</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Target entity <span className="text-destructive">*</span></Label>
              <EntityPicker
                itemType={itemType}
                value={pickedEntity}
                onSelect={handlePickEntity}
                disabled={!itemType}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Change kind <span className="text-destructive">*</span></Label>
              <Select value={changeKind} onValueChange={setChangeKind} disabled={!pickedEntity}>
                <SelectTrigger>
                  <SelectValue placeholder="Select change kind…" />
                </SelectTrigger>
                <SelectContent>
                  {CHANGE_KINDS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">What kind of change is being proposed?</p>
            </div>
          </div>

          {/* ── Section 2 — Snapshot capture ──────────────────────────────── */}
          <div className={`space-y-4 ${section2Disabled ? "opacity-40 pointer-events-none" : ""}`}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">2. Snapshot capture</p>

            {showBefore && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Before snapshot</Label>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                    onClick={handleCaptureBefore} disabled={!pickedEntity || capturingBefore}>
                    {capturingBefore ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    Capture current state
                  </Button>
                </div>
                <JsonTextarea
                  value={beforeJson}
                  onChange={setBeforeJson}
                  placeholder='{}'
                  disabled={section2Disabled}
                />
                <p className="text-xs text-muted-foreground">
                  The state of the entity BEFORE this change. Click "Capture current state" for the system to fill it in.
                </p>
              </div>
            )}

            {showAfter && (
              <div className="space-y-2">
                <Label className="text-xs">After snapshot</Label>
                <JsonTextarea
                  value={afterJson}
                  onChange={setAfterJson}
                  placeholder='{}'
                  disabled={section2Disabled}
                />
                <p className="text-xs text-muted-foreground">
                  The state of the entity AFTER this change.{" "}
                  {["modify", "reassign", "release"].includes(changeKind) &&
                    "For Modify, edit the captured before-snapshot to show the proposed changes."}
                </p>
              </div>
            )}
          </div>

          {/* ── Section 3 — Where-used + item label ───────────────────────── */}
          <div className={`space-y-4 ${!pickedEntity ? "opacity-40 pointer-events-none" : ""}`}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">3. Label & downstream</p>

            <div className="space-y-1.5">
              <Label className="text-xs">Item label</Label>
              <Input
                value={itemLabel}
                onChange={(e) => setItemLabel(e.target.value)}
                placeholder={pickedEntity?.label || "Auto-computed from entity…"}
                disabled={!pickedEntity}
              />
              <p className="text-xs text-muted-foreground">Human-readable label saved with the affected item record.</p>
            </div>

            <WhereUsedPreview itemType={itemType} itemId={pickedEntity?.id} />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="gap-2 min-w-[80px]"
            title={!canSave ? "Pick a target entity to continue" : undefined}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}