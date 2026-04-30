import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";

export default function ProductUOMSection({ product, lovValues, onUpdate, isReadOnly = false }) {
  const uomOptions = useMemo(() => lovValues.filter((v) => v.category === "uom"), [lovValues]);

  const hasPurchasingUom = !!product.default_uom_for_purchasing &&
    product.default_uom_for_purchasing !== product.default_uom;

  return (
    <div className="space-y-3 bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Unit of Measure</h3>
        {!product.default_uom && (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">
            <AlertTriangle className="w-3 h-3" /> Required for BOM use
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Default UOM */}
        <div className="space-y-1.5">
          <Label className="text-xs">Default UOM <span className="text-muted-foreground font-normal">(consumption)</span></Label>
          {isReadOnly ? (
            <p className="text-sm">{product.default_uom || "—"}</p>
          ) : (
            <Select
              value={product.default_uom || "none"}
              onValueChange={(v) => onUpdate("default_uom", v === "none" ? "" : v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select UOM…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {uomOptions.map((u) => (
                  <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Purchasing UOM */}
        <div className="space-y-1.5">
          <Label className="text-xs">Purchasing UOM <span className="text-muted-foreground font-normal">(optional)</span></Label>
          {isReadOnly ? (
            <p className="text-sm">{product.default_uom_for_purchasing || "—"}</p>
          ) : (
            <Select
              value={product.default_uom_for_purchasing || "none"}
              onValueChange={(v) => {
                onUpdate("default_uom_for_purchasing", v === "none" ? "" : v);
                if (v === "none") onUpdate("uom_conversion_factor", null);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Same as default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Same as default</SelectItem>
                {uomOptions.map((u) => (
                  <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Conversion factor */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            Conversion Factor
            {hasPurchasingUom && product.default_uom && (
              <span className="text-muted-foreground font-normal ml-1">
                ({product.default_uom} per {product.default_uom_for_purchasing})
              </span>
            )}
          </Label>
          {isReadOnly ? (
            <p className="text-sm">{product.uom_conversion_factor ?? "—"}</p>
          ) : (
            <Input
              type="number"
              value={product.uom_conversion_factor ?? ""}
              onChange={(e) => onUpdate("uom_conversion_factor", parseFloat(e.target.value) || null)}
              placeholder={hasPurchasingUom ? "e.g. 50" : "N/A"}
              disabled={!hasPurchasingUom}
              className="h-8 text-xs"
            />
          )}
          {hasPurchasingUom && product.uom_conversion_factor && (
            <p className="text-[10px] text-muted-foreground">
              1 {product.default_uom_for_purchasing} = {product.uom_conversion_factor} {product.default_uom}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}