import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search, Building2, Globe, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { usePageOptions } from "@/lib/PageOptionsContext";

const STATUS_COLORS = {
  active: "bg-green-100 text-green-700 border-green-200",
  on_hold: "bg-yellow-100 text-yellow-700 border-yellow-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  blacklisted: "bg-red-100 text-red-700 border-red-200",
};

export default function Suppliers() {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();
  const [suppliers, setSuppliers] = useState([]);
  const [approvedSuppliers, setApprovedSuppliers] = useState([]);
  const [lovValues, setLovValues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCapability, setFilterCapability] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    setOptions({
      items: [
        { label: "New Supplier", icon: Plus, onClick: () => navigate("/suppliers/new"), className: "text-primary hover:bg-primary/10" },
      ],
    });
  }, [setOptions, navigate]);

  useEffect(() => {
    Promise.all([
      base44.entities.Supplier.list("name", 500),
      base44.entities.ApprovedSupplier.list("-created_date", 2000),
      base44.entities.ListOfValues.list("name", 5000),
    ]).then(([sups, apps, lovs]) => {
      setSuppliers(sups);
      setApprovedSuppliers(apps);
      setLovValues(lovs);
      setLoading(false);
    });
  }, []);

  const getLovOptions = (category) =>
    lovValues.filter((v) => v.category === category).map((v) => v.name);

  const capabilityOptions = useMemo(() => getLovOptions("supplier_capability"), [lovValues]);
  const regionOptions = useMemo(() => getLovOptions("supplier_region"), [lovValues]);
  const statusOptions = useMemo(() => getLovOptions("supplier_status"), [lovValues]);

  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      if (search && !s.name?.toLowerCase().includes(search.toLowerCase()) &&
        !s.code?.toLowerCase().includes(search.toLowerCase()) &&
        !s.country?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCapability && !(s.capabilities || []).includes(filterCapability)) return false;
      if (filterRegion && s.region !== filterRegion) return false;
      if (filterStatus && s.status !== filterStatus) return false;
      return true;
    });
  }, [suppliers, search, filterCapability, filterRegion, filterStatus]);

  const getProductCount = (supplierId) =>
    new Set(approvedSuppliers.filter((a) => a.supplier_id === supplierId).map((a) => a.product_id)).size;

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="px-2 py-2 space-y-4 pb-20 sm:pb-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Suppliers</h1>
        <p className="text-muted-foreground text-sm mt-1">{suppliers.length} suppliers</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers…" className="pl-8 h-8 text-xs" />
        </div>
        <select value={filterCapability} onChange={(e) => setFilterCapability(e.target.value)}
          className="h-8 text-xs rounded-md border border-input bg-background px-2 text-muted-foreground">
          <option value="">All capabilities</option>
          {capabilityOptions.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
        </select>
        <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}
          className="h-8 text-xs rounded-md border border-input bg-background px-2 text-muted-foreground">
          <option value="">All regions</option>
          {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="h-8 text-xs rounded-md border border-input bg-background px-2 text-muted-foreground">
          <option value="">All statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{suppliers.length === 0 ? "No suppliers yet. Add one to get started." : "No suppliers match your filters."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => navigate(`/suppliers/${s.id}`)}
              className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/40 hover:shadow-sm cursor-pointer transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{s.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                  {s.status && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${STATUS_COLORS[s.status] || "bg-muted text-muted-foreground border-border"}`}>
                      {s.status.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {s.country && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Globe className="w-3 h-3" />{s.country}{s.region ? ` · ${s.region}` : ""}
                    </span>
                  )}
                  {(s.capabilities || []).slice(0, 4).map((cap) => (
                    <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                      {cap.replace(/_/g, " ")}
                    </span>
                  ))}
                  {(s.capabilities || []).length > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{(s.capabilities || []).length - 4}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold">{getProductCount(s.id)}</p>
                <p className="text-xs text-muted-foreground">products</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}