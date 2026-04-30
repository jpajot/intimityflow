import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, AlertTriangle, Clock, CheckCircle2, Building2, GitBranch, XCircle } from "lucide-react";

function StatCard({ icon: Icon, label, count, color, items, products, onClick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border p-4 space-y-2 cursor-pointer hover:shadow-md transition-all ${color}`} onClick={() => setOpen((v) => !v)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <span className="text-2xl font-bold">{count}</span>
      </div>
      {open && items?.length > 0 && (
        <div className="border-t border-current/20 pt-2 space-y-1 max-h-48 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 py-1 cursor-pointer hover:opacity-80"
              onClick={(e) => { e.stopPropagation(); onClick && onClick(item); }}>
              <div className="w-6 h-6 rounded bg-current/10 shrink-0 flex items-center justify-center overflow-hidden">
                {item.images?.[0] ? <img src={item.images[0]} alt={item.name} className="w-full h-full object-contain" /> : <Building2 className="w-3 h-3" />}
              </div>
              <p className="text-xs font-medium truncate">{item.name}</p>
              <span className="text-[10px] ml-auto opacity-70">{item.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectSourcingDashboard({ projectId, linkedStyles }) {
  const navigate = useNavigate();
  const [approvedSuppliers, setApprovedSuppliers] = useState([]);
  const [routings, setRoutings] = useState([]);
  const [routingSteps, setRoutingSteps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!linkedStyles || linkedStyles.length === 0) { setLoading(false); return; }
    const productIds = linkedStyles.map((p) => p.id);
    Promise.all([
      base44.entities.ApprovedSupplier.list("-created_date", 2000),
      base44.entities.SupplierRouting.list("-created_date", 1000),
      base44.entities.SupplierRoutingStep.list("-created_date", 2000),
    ]).then(([apps, rts, steps]) => {
      setApprovedSuppliers(apps.filter((a) => productIds.includes(a.product_id)));
      setRoutings(rts.filter((r) => productIds.includes(r.product_id)));
      setRoutingSteps(steps);
      setLoading(false);
    });
  }, [linkedStyles]);

  const stats = useMemo(() => {
    if (!linkedStyles) return {};
    const today = new Date();
    const in60 = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

    const noSourcing = linkedStyles.filter((p) => {
      const hasPrimary = approvedSuppliers.some((a) => a.product_id === p.id && a.is_primary && a.status === "active");
      const hasDefaultRouting = routings.some((r) => r.product_id === p.id && r.is_default && r.status === "active");
      return !hasPrimary && !hasDefaultRouting;
    });

    const pendingApproval = linkedStyles.filter((p) =>
      approvedSuppliers.some((a) => a.product_id === p.id && a.is_primary && a.status === "pending_approval")
    );

    const expiringSoon = linkedStyles.filter((p) => {
      const primary = approvedSuppliers.find((a) => a.product_id === p.id && a.is_primary);
      if (primary?.valid_until) {
        const d = new Date(primary.valid_until);
        if (d >= today && d <= in60) return true;
      }
      const defaultRt = routings.find((r) => r.product_id === p.id && r.is_default);
      if (defaultRt?.valid_until) {
        const d = new Date(defaultRt.valid_until);
        if (d >= today && d <= in60) return true;
      }
      return false;
    });

    const incompleteRoutings = routings.filter((r) => {
      const steps = routingSteps.filter((s) => s.supplier_routing_id === r.id);
      return steps.some((s) => !s.supplier_id);
    });
    const incompleteRoutingProducts = linkedStyles.filter((p) =>
      incompleteRoutings.some((r) => r.product_id === p.id)
    );

    return { noSourcing, pendingApproval, expiringSoon, incompleteRoutingProducts };
  }, [linkedStyles, approvedSuppliers, routings, routingSteps]);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  const total = linkedStyles?.length || 0;
  const ready = total - (stats.noSourcing?.length || 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{ready} of {total} products have an active sourcing path</p>
        </div>
        <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: total > 0 ? `${(ready / total) * 100}%` : "0%" }} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard
          icon={XCircle}
          label="No sourcing path"
          count={stats.noSourcing?.length || 0}
          color="bg-red-50/60 border-red-200 text-red-700"
          items={stats.noSourcing}
          onClick={(p) => navigate(`/products/${p.id}`)}
        />
        <StatCard
          icon={Clock}
          label="Pending approval"
          count={stats.pendingApproval?.length || 0}
          color="bg-amber-50/60 border-amber-200 text-amber-700"
          items={stats.pendingApproval}
          onClick={(p) => navigate(`/products/${p.id}`)}
        />
        <StatCard
          icon={AlertTriangle}
          label="Expiring within 60 days"
          count={stats.expiringSoon?.length || 0}
          color="bg-orange-50/60 border-orange-200 text-orange-700"
          items={stats.expiringSoon}
          onClick={(p) => navigate(`/products/${p.id}`)}
        />
        <StatCard
          icon={GitBranch}
          label="Routings missing suppliers"
          count={stats.incompleteRoutingProducts?.length || 0}
          color="bg-yellow-50/60 border-yellow-200 text-yellow-700"
          items={stats.incompleteRoutingProducts}
          onClick={(p) => navigate(`/products/${p.id}`)}
        />
      </div>
    </div>
  );
}