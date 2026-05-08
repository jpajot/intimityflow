import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Request cache to deduplicate queries across multiple BOMSourcingBlock instances
const requestCache = new Map();
const requestPending = new Map();

const cachedQuery = async (key, fn, ttl = 60000) => {
  // Check cache first
  if (requestCache.has(key)) {
    const { data, expiry } = requestCache.get(key);
    if (Date.now() < expiry) return data;
    requestCache.delete(key);
  }
  
  // Check if request is pending
  if (requestPending.has(key)) return requestPending.get(key);
  
  // Fire new request
  const promise = fn().then(data => {
    requestCache.set(key, { data, expiry: Date.now() + ttl });
    requestPending.delete(key);
    return data;
  }).catch(err => {
    requestPending.delete(key);
    throw err;
  });
  
  requestPending.set(key, promise);
  return promise;
};

/**
 * Row-level sourcing block for a BOMLine.
 * Shows primary supplier info, or a warning if no approved suppliers exist.
 */
export default function BOMSourcingBlock({ line, comp, uom }) {
  const navigate = useNavigate();
  const [primarySupplier, setPrimarySupplier] = useState(null); // { approvedSupplier, supplier }
  const [noSuppliers, setNoSuppliers] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const loadStartRef = useRef(Date.now());

  useEffect(() => {
    if (!line.component_product_id) return;
    let cancelled = false;
    const load = async () => {
      try {
        // Stagger requests by line index to avoid thundering herd
        const delayMs = Math.random() * 200; // 0-200ms random jitter
        await new Promise(r => setTimeout(r, delayMs));
        if (cancelled) return;

        // If line has a line-level override, resolve that supplier; else resolve primary
        let asRecord = null;
        if (line.line_level_approved_supplier_id) {
          const key = `as:${line.line_level_approved_supplier_id}`;
          const overrides = await cachedQuery(key, () => 
            base44.entities.ApprovedSupplier.filter({ id: line.line_level_approved_supplier_id })
          );
          if (!cancelled && overrides[0]) asRecord = overrides[0];
        }
        if (!asRecord) {
          const key = `primary:${line.component_product_id}`;
          const approved = await cachedQuery(key, () =>
            base44.entities.ApprovedSupplier.filter({
              product_id: line.component_product_id,
              is_primary: true,
              status: "active",
            })
          );
          if (cancelled) return;
          if (approved.length === 0) {
            const allKey = `all:${line.component_product_id}`;
            const all = await cachedQuery(allKey, () =>
              base44.entities.ApprovedSupplier.filter({ product_id: line.component_product_id })
            );
            if (cancelled) return;
            setNoSuppliers(all.length === 0);
            setLoaded(true);
            return;
          }
          asRecord = approved[0];
        }
        if (cancelled) return;
        
        const supplierKey = `supplier:${asRecord.supplier_id}`;
        const suppliers = await cachedQuery(supplierKey, () =>
          base44.entities.Supplier.filter({ id: asRecord.supplier_id })
        );
        if (cancelled) return;
        setPrimarySupplier({ as: asRecord, supplier: suppliers[0] || null, isOverride: !!line.line_level_approved_supplier_id });
        setLoaded(true);
      } catch (err) {
        console.error("[BOMSourcingBlock] Failed to load supplier data:", err);
        setLoaded(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [line.component_product_id, line.line_level_approved_supplier_id]);

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

  const { as, supplier, isOverride } = primarySupplier;
  const cost = as.unit_cost != null ? `${as.unit_cost} ${as.currency || ""}/${uom || ""}`.trim() : null;
  const lt = as.lead_time_days != null ? `${as.lead_time_days}d` : null;

  return (
    <div
      className="flex items-center gap-1 flex-wrap text-[10px] text-muted-foreground mt-1 cursor-pointer hover:text-foreground transition-colors"
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
      {isOverride && (
        <span className="px-1 py-0 rounded bg-amber-100 text-amber-700 border border-amber-200 text-[9px] font-medium">line override</span>
      )}
      <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-40" />
    </div>
  );
}