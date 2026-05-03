import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2, Search, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import BOMLineDestructiveConfirmDialog from "./BOMLineDestructiveConfirmDialog.jsx";

const SIZE_VARIATION_MODE_OPTIONS = [
  { value: "consumption_grading", label: "Consumption grading" },
  { value: "component_size_mapping", label: "Component size mapping" },
  { value: "base_size_with_optional_grading", label: "Base size + optional grading" },
  { value: "both", label: "Both" },
];

/**
 * Compute which BOMLineVariant records will be deleted given the set of field changes.
 * Returns an array of variant IDs to delete.
 */
function computeCascade(draft, original, variants) {
  const affected = new Set();

  const swappingComponent = draft.component_product_id !== original.component_product_id;
  if (swappingComponent) {
    // All variants on this line are deleted
    variants.forEach((v) => affected.add(v.id));
    return [...affected];
  }

  const turningOffColor = original.varies_by_color && !draft.varies_by_color;
  const turningOffSize = original.varies_by_size && !draft.varies_by_size;
  const turningOffCam = original.varies_by_color_and_more && !draft.varies_by_color_and_more;
  const turningOffSupplier = original.varies_by_supplier && !draft.varies_by_supplier;

  variants.forEach((v) => {
    if (turningOffColor && v.product_color_id) affected.add(v.id);
    if (turningOffSize && v.size_id) affected.add(v.id);
    if (turningOffCam && v.product_color_and_more_id) affected.add(v.id);
    if (turningOffSupplier && v.parent_approved_supplier_id) affected.add(v.id);
  });

  return [...affected];
}

function buildConfirmDescription(draft, original, variants, allProducts) {
  const swapping = draft.component_product_id !== original.component_product_id;
  if (swapping) {
    const oldComp = allProducts.find((p) => p.id === original.component_product_id);
    const newComp = allProducts.find((p) => p.id === draft.component_product_id);
    return (
      <p>
        Swapping the component from <strong>{oldComp ? `${oldComp.code || ""} ${oldComp.name}`.trim() : "—"}</strong> to{" "}
        <strong>{newComp ? `${newComp.code || ""} ${newComp.name}`.trim() : "—"}</strong> will delete{" "}
        <strong>all {variants.length} variant records</strong> on this line. This cannot be undone.
      </p>
    );
  }

  const lines = [];
  if (original.varies_by_color && !draft.varies_by_color) {
    const n = variants.filter((v) => v.product_color_id).length;
    if (n > 0) lines.push(`Disabling "Varies by color" will delete ${n} colorway resolution${n !== 1 ? "s" : ""}.`);
  }
  if (original.varies_by_size && !draft.varies_by_size) {
    const n = variants.filter((v) => v.size_id).length;
    if (n > 0) lines.push(`Disabling "Varies by size" will delete ${n} size variant${n !== 1 ? "s" : ""}.`);
  }
  if (original.varies_by_color_and_more && !draft.varies_by_color_and_more) {
    const n = variants.filter((v) => v.product_color_and_more_id).length;
    if (n > 0) lines.push(`Disabling "Varies by Color & More" will delete ${n} variant${n !== 1 ? "s" : ""}.`);
  }
  if (original.varies_by_supplier && !draft.varies_by_supplier) {
    const n = variants.filter((v) => v.parent_approved_supplier_id).length;
    if (n > 0) lines.push(`Disabling "Varies by supplier" will delete ${n} supplier variant${n !== 1 ? "s" : ""}.`);
  }

  return (
    <div className="space-y-1">
      {lines.map((l, i) => <p key={i}>{l}</p>)}
      <p className="text-muted-foreground text-xs mt-2">This cannot be undone.</p>
    </div>
  );
}

export default function BOMLineEditPanel({
  open,
  line,
  lineVariants = [],
  allProducts = [],
  lovValues = [],
  allSizes = [],
  bomId,
  user,
  onClose,
  onSaved, // (updatedLine, deletedVariantIds) => void
}) {
  const [draft, setDraft] = useState(null);
  const [productSearch, setProductSearch] = useState("");
  const [compStyleSizes, setCompStyleSizes] = useState([]);
  const [compApprovedSuppliers, setCompApprovedSuppliers] = useState([]);
  const [compSupplierMap, setCompSupplierMap] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null); // { cascadeIds, description }

  const roleOptions = useMemo(() => lovValues.filter((v) => v.category === "bom_line_role"), [lovValues]);
  const uomOptions = useMemo(() => lovValues.filter((v) => v.category === "uom"), [lovValues]);

  // Initialize draft from line
  useEffect(() => {
    if (line && open) {
      setDraft({ ...line });
      setProductSearch("");
    }
  }, [line, open]);

  // Load component's StyleSizes for base-size picker
  useEffect(() => {
    if (!draft?.component_product_id || !draft?.varies_by_size) { setCompStyleSizes([]); return; }
    base44.entities.StyleSize.filter({ product_id: draft.component_product_id })
      .then((ss) => setCompStyleSizes(ss.filter((s) => s.active !== false)));
  }, [draft?.component_product_id, draft?.varies_by_size]);

  // Load component's ApprovedSuppliers for line-level supplier override
  useEffect(() => {
    if (!draft?.component_product_id) { setCompApprovedSuppliers([]); setCompSupplierMap({}); return; }
    let cancelled = false;
    const load = async () => {
      const asList = await base44.entities.ApprovedSupplier.filter({
        product_id: draft.component_product_id,
        status: "active",
      });
      const sorted = asList.sort((a, b) => (a.rank || 99) - (b.rank || 99));
      if (cancelled) return;
      const ids = [...new Set(sorted.map((a) => a.supplier_id).filter(Boolean))];
      const sups = await Promise.all(ids.map((sid) =>
        base44.entities.Supplier.filter({ id: sid }).then((r) => r[0]).catch(() => null)
      ));
      if (cancelled) return;
      const map = {};
      sups.filter(Boolean).forEach((s) => { map[s.id] = s; });
      setCompApprovedSuppliers(sorted);
      setCompSupplierMap(map);
    };
    load();
    return () => { cancelled = true; };
  }, [draft?.component_product_id]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    return allProducts
      .filter((p) => !q || p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q))
      .slice(0, 50);
  }, [allProducts, productSearch]);

  const getSizeName = (sizeId) => {
    const s = allSizes.find((sz) => sz.id === sizeId);
    return s?.name || s?.size_code || sizeId;
  };

  const set = (field, value) => setDraft((d) => ({ ...d, [field]: value }));

  const cascadeIds = useMemo(() => {
    if (!draft || !line) return [];
    return computeCascade(draft, line, lineVariants);
  }, [draft, line, lineVariants]);

  const isDestructive = cascadeIds.length > 0;

  const handleSave = () => {
    if (isDestructive) {
      setConfirm({
        cascadeIds,
        description: buildConfirmDescription(draft, line, lineVariants.filter((v) => cascadeIds.includes(v.id)), allProducts),
      });
    } else {
      executeSave([]);
    }
  };

  const executeSave = async (idsToDelete) => {
    setSaving(true);
    setConfirm(null);

    const swappingComponent = draft.component_product_id !== line.component_product_id;

    // Re-resolve UOM if component swapped and not overridden
    let finalDraft = { ...draft };
    if (swappingComponent && !draft.uom_is_overridden) {
      const newComp = allProducts.find((p) => p.id === draft.component_product_id);
      finalDraft.uom = null; // null = inherit
      finalDraft.uom_is_overridden = false;
      // Also clear line_level_approved_supplier_id since it belonged to old component
      finalDraft.line_level_approved_supplier_id = null;
    }

    // Build changelog payload
    const changedFields = [];
    const allFields = Object.keys(finalDraft);
    allFields.forEach((f) => {
      if (f === "id" || f === "bom_id" || f === "created_date" || f === "updated_date" || f === "created_by") return;
      if (finalDraft[f] !== line[f]) {
        changedFields.push({ field: f, before: line[f], after: finalDraft[f] });
      }
    });

    // Delete cascaded variants
    if (idsToDelete.length > 0) {
      await Promise.all(idsToDelete.map((vid) => base44.entities.BOMLineVariant.delete(vid)));
    }

    // Update the line
    const { id, bom_id, created_date, updated_date, created_by, ...updatePayload } = finalDraft;
    await base44.entities.BOMLine.update(line.id, updatePayload);

    // Log
    await base44.entities.BOMChangeLog.create({
      bom_id: bomId,
      change_type: "line_modified",
      payload: {
        bom_line_id: line.id,
        changes: changedFields,
        deleted_variant_ids: idsToDelete,
        deleted_variant_count: idsToDelete.length,
      },
      triggered_by: user?.email || "",
      triggered_at: new Date().toISOString(),
    });

    setSaving(false);
    onSaved(finalDraft, idsToDelete);
  };

  if (!draft) return null;

  const selectedComp = allProducts.find((p) => p.id === draft.component_product_id);
  const isSwappingComponent = draft.component_product_id !== line?.component_product_id;

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent side="right" className="w-[420px] sm:w-[480px] overflow-y-auto flex flex-col gap-0 p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
            <SheetTitle className="text-base">Edit Component Line</SheetTitle>
            {isDestructive && (
              <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">
                  <strong>{cascadeIds.length} variant record{cascadeIds.length !== 1 ? "s" : ""} will be deleted</strong> if you save these changes.
                </p>
              </div>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Component product */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Component Product</Label>
              <div className="p-2.5 rounded-lg border border-border bg-muted/30 text-xs font-medium">
                {selectedComp ? `${selectedComp.code || ""} ${selectedComp.name}`.trim() : "—"}
                {isSwappingComponent && (
                  <span className="ml-2 text-[10px] text-amber-600 font-normal">(changed — all variants will be deleted)</span>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search to swap component…"
                  className="pl-7 h-7 text-xs"
                />
              </div>
              {productSearch && (
                <div className="border border-border rounded-lg max-h-36 overflow-y-auto divide-y divide-border">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { set("component_product_id", p.id); setProductSearch(""); }}
                      className={`w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors flex items-center gap-2
                        ${draft.component_product_id === p.id ? "bg-primary/10 text-primary" : ""}`}
                    >
                      <span className="font-mono text-muted-foreground">{p.code || "—"}</span>
                      <span>{p.name}</span>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No products found</p>
                  )}
                </div>
              )}
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Component Role</Label>
              <Select value={draft.component_role || ""} onValueChange={(v) => set("component_role", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select role…" /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Qty + UOM */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Base Quantity</Label>
                <Input
                  type="number"
                  value={draft.base_quantity ?? ""}
                  onChange={(e) => set("base_quantity", parseFloat(e.target.value) || null)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  UOM
                  {!draft.uom_is_overridden && selectedComp?.default_uom && (
                    <span className="ml-1 font-normal text-muted-foreground">(inherited: {selectedComp.default_uom})</span>
                  )}
                </Label>
                <Select
                  value={draft.uom || "__inherit__"}
                  onValueChange={(v) => {
                    const isOverride = v !== "__inherit__";
                    set("uom", isOverride ? v : null);
                    set("uom_is_overridden", isOverride);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__inherit__">— inherit from product —</SelectItem>
                    {uomOptions.map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Variation flags */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Varies by axis</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "varies_by_color", label: "Color" },
                  { key: "varies_by_size", label: "Size" },
                  { key: "varies_by_color_and_more", label: "Color & More" },
                  { key: "varies_by_supplier", label: "Supplier" },
                ].map(({ key, label }) => {
                  const willDelete = line[key] && !draft[key] && lineVariants.some((v) => {
                    if (key === "varies_by_color") return v.product_color_id;
                    if (key === "varies_by_size") return v.size_id;
                    if (key === "varies_by_color_and_more") return v.product_color_and_more_id;
                    if (key === "varies_by_supplier") return v.parent_approved_supplier_id;
                    return false;
                  });
                  return (
                    <label key={key} className="flex items-center gap-2 cursor-pointer select-none text-xs p-2 rounded border border-border hover:bg-muted/30 transition-colors">
                      <Checkbox checked={!!draft[key]} onCheckedChange={(v) => set(key, !!v)} />
                      <span>{label}</span>
                      {willDelete && <AlertTriangle className="w-3 h-3 text-destructive ml-auto" title="Disabling will delete variants" />}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Size variation controls */}
            {draft.varies_by_size && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Size Variation Mode</Label>
                <Select value={draft.size_variation_mode || ""} onValueChange={(v) => set("size_variation_mode", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select mode…" /></SelectTrigger>
                  <SelectContent>
                    {SIZE_VARIATION_MODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {["base_size_with_optional_grading", "component_size_mapping"].includes(draft.size_variation_mode) && compStyleSizes.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Base Component Size</Label>
                    <Select
                      value={draft.base_component_size_id || ""}
                      onValueChange={(v) => set("base_component_size_id", v || null)}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick base size…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>— none —</SelectItem>
                        {compStyleSizes.map((ss) => (
                          <SelectItem key={ss.size_id} value={ss.size_id}>{getSizeName(ss.size_id)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Line-level supplier override */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Line-level Supplier Override</Label>
              <p className="text-[11px] text-muted-foreground">
                Overrides the component's primary supplier for this BOM line only. Per-cell overrides are unaffected.
              </p>
              {compApprovedSuppliers.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No approved suppliers on this component.</p>
              ) : (
                <Select
                  value={draft.line_level_approved_supplier_id || "__default__"}
                  onValueChange={(v) => set("line_level_approved_supplier_id", v === "__default__" ? null : v)}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">— use component primary (default) —</SelectItem>
                    {compApprovedSuppliers.map((as) => {
                      const sup = compSupplierMap[as.supplier_id];
                      return (
                        <SelectItem key={as.id} value={as.id}>
                          {sup?.name || as.supplier_id}
                          {as.is_primary ? " (primary)" : ` · rank ${as.rank}`}
                          {as.supplier_reference ? ` · ${as.supplier_reference}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              {draft.line_level_approved_supplier_id && (
                <p className="text-[10px] text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Line override active — row sourcing differs from component primary.
                </p>
              )}
            </div>

            {/* Misc flags */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Flags</Label>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <Checkbox checked={!!draft.is_phantom} onCheckedChange={(v) => set("is_phantom", !!v)} />
                Phantom line (planning only, not consumed in production)
              </label>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notes</Label>
              <Textarea
                value={draft.notes || ""}
                onChange={(e) => set("notes", e.target.value)}
                className="text-xs min-h-[60px] resize-none"
                placeholder="Optional notes…"
              />
            </div>

            {/* Reference doc URL */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reference Document URL</Label>
              <div className="flex gap-2">
                <Input
                  value={draft.reference_doc_url || ""}
                  onChange={(e) => set("reference_doc_url", e.target.value)}
                  className="h-8 text-xs flex-1"
                  placeholder="https://…"
                />
                {draft.reference_doc_url && (
                  <a href={draft.reference_doc_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className={isDestructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              {isDestructive ? `Save (deletes ${cascadeIds.length} record${cascadeIds.length !== 1 ? "s" : ""})` : "Save changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {confirm && (
        <BOMLineDestructiveConfirmDialog
          open={true}
          title="This change will delete existing variant data"
          description={confirm.description}
          deleteCount={confirm.cascadeIds.length}
          onConfirm={() => executeSave(confirm.cascadeIds)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}