import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Row-level sourcing block for a BOMLine.
 * Shows primary supplier info, or a warning if no approved suppliers exist.
 */
export default function BOMSourcingBlock({ line, comp, uom }) {
  const navigate = useNavigate();
  const [primarySupplier, setPrimarySupplier] = useState(null); // { approvedSupplier, supplier }
  const [noSuppliers, setNoSuppliers] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!line.component_product_id) return;
    let cancelled = false;
    const load = async () => {
      const approved = await base44.entities.ApprovedSupplier.filter({
        product_id: line.component_product_id,
        is_primary: true,
        status: "active",
      });
      if (cancelled) return;
      if (approved.length === 0) {
        // Check if there are any at all
        const all = await base44.entities.ApprovedSupplier.filter({ product_id: line.component_product_id });
        if (cancelled) return;
        setNoSuppliers(all.length === 0);
        setLoaded(true);
        return;
      }
      const as = approved[0];
      const suppliers = await base44.entities.Supplier.filter({ id: as.supplier_id });
      if (cancelled) return;
      setPrimarySupplier({ as, supplier: suppliers[0] || null });
      setLoaded(true);
    };
    load();
    return () => { cancelled = true; };
  }, [line.component_product_id]);

  if (!loaded) return null;

  const openSourcing = () => navigate(`/products/${line.component_product_id}?tab=suppliers`);

  if (noSuppliers) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-amber-600 mt-1">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>No awarded supplier</span>
        <button
          type="button"
          onClick={openSourcing}
          className="ml-0.5 underline hover:text-amber-800 transition-colors"
          title="Open component sourcing"
        >
          <ExternalLink className="w-2.5 h-2.5 inline" />
        </button>
      </div>
    );
  }

  if (!primarySupplier) return null;

  const { as, supplier } = primarySupplier;
  const cost = as.unit_cost != null ? `${as.unit_cost} ${as.currency || ""}/${uom || ""}`.trim() : null;
  const lt = as.lead_time_days != null ? `${as.lead_time_days}d` : null;

  return (
    <div
      className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1 cursor-pointer hover:text-foreground transition-colors"
      onClick={openSourcing}
      title="Open component sourcing"
    >
      {as.supplier_reference && (
        <span className="font-mono text-foreground/70">{as.supplier_reference}</span>
      )}
      {as.supplier_reference && supplier?.name && <span>@</span>}
      {supplier?.name && <span className="font-medium">{supplier.name}</span>}
      {cost && <span className="text-muted-foreground/70">· {cost}</span>}
      {lt && <span className="text-muted-foreground/70">· {lt}</span>}
      <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-40" />
    </div>
  );
}