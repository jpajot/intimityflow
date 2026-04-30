import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, Trash2, Info, Package, GitBranch, X, Plus } from "lucide-react";
import { useRegisterSubNav } from "../hooks/useRegisterSubNav";
import { usePageOptions } from "@/lib/PageOptionsContext";

const EMPTY_SUPPLIER = {
  name: "", legal_name: "", country: "", region: "", city: "",
  primary_contact_name: "", primary_contact_email: "", primary_contact_phone: "",
  capabilities: [], certifications: [], lead_time_default_days: "",
  moq_policy: "", payment_terms_default: "", currency_default: "",
  status: "active", status_reason: "", notes: "",
};

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const { setOptions } = usePageOptions();

  const [supplier, setSupplier] = useState(EMPTY_SUPPLIER);
  const [lovValues, setLovValues] = useState([]);
  const [approvedLinks, setApprovedLinks] = useState([]);
  const [routingSteps, setRoutingSteps] = useState([]);
  const [products, setProducts] = useState([]);
  const [routings, setRoutings] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const autoSaveTimer = { current: null };

  const subNavItems = isNew ? [] : [
    { id: "profile", label: "Profile", icon: Info },
    { id: "products", label: "Sourced Products", count: new Set(approvedLinks.map((a) => a.product_id)).size, icon: Package },
    { id: "routing", label: "Routing Participation", count: routingSteps.length, icon: GitBranch },
  ];
  useRegisterSubNav(subNavItems, activeTab, setActiveTab, supplier.name || "New Supplier");

  useEffect(() => {
    setOptions({ items: [] });
  }, [setOptions]);

  useEffect(() => {
    base44.entities.ListOfValues.list("name", 5000).then(setLovValues);
    if (!isNew) {
      loadData();
    }
  }, [id]);

  const getLov = (category) => lovValues.filter((v) => v.category === category).map((v) => v.name);

  const loadData = async () => {
    setLoading(true);
    const [sup, apps, steps, prods, rts] = await Promise.all([
      base44.entities.Supplier.filter({ id }),
      base44.entities.ApprovedSupplier.filter({ supplier_id: id }),
      base44.entities.SupplierRoutingStep.filter({ supplier_id: id }),
      base44.entities.Product.list("name", 500),
      base44.entities.SupplierRouting.list("name", 500),
    ]);
    if (sup[0]) setSupplier(sup[0]);
    setApprovedLinks(apps);
    setRoutingSteps(steps);
    setProducts(prods);
    setRoutings(rts);
    setLoading(false);
  };

  const updateField = (field, value) => {
    setSupplier((s) => {
      const updated = { ...s, [field]: value };
      if (!isNew) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => {
          const { id: _, created_date, updated_date, created_by, ...data } = updated;
          base44.entities.Supplier.update(updated.id, data);
        }, 800);
      }
      return updated;
    });
  };

  const toggleArrayValue = (field, val) => {
    const arr = supplier[field] || [];
    updateField(field, arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const handleSave = async () => {
    setSaving(true);
    if (isNew) {
      let code = "";
      try {
        const res = await base44.functions.invoke("generateCode", { entity_name: "Supplier", entity_type: "Supplier" });
        code = res.data?.code || "";
      } catch (_) {}
      const created = await base44.entities.Supplier.create({ ...supplier, code });
      navigate(`/suppliers/${created.id}`, { replace: true });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    await base44.entities.Supplier.delete(supplier.id);
    navigate("/suppliers");
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  const uniqueProductIds = [...new Set(approvedLinks.map((a) => a.product_id))];

  return (
    <div className="px-2 py-2 space-y-4 pb-20 sm:pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/suppliers")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {isNew ? "New Supplier" : supplier.name}
          </h1>
          {supplier.code && <p className="text-xs text-muted-foreground font-mono">{supplier.code}</p>}
        </div>
        {!isNew && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete this supplier record.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Profile Tab */}
      {(isNew || activeTab === "profile") && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-5">
          {/* Identity */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Identity</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Trading Name *</Label>
                <Input value={supplier.name || ""} onChange={(e) => updateField("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Legal Name</Label>
                <Input value={supplier.legal_name || ""} onChange={(e) => updateField("legal_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Country</Label>
                <Input value={supplier.country || ""} onChange={(e) => updateField("country", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Region</Label>
                <Select value={supplier.region || "none"} onValueChange={(v) => updateField("region", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select region…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {getLov("supplier_region").map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">City</Label>
                <Input value={supplier.city || ""} onChange={(e) => updateField("city", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={supplier.status || "active"} onValueChange={(v) => updateField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(getLov("supplier_status").length > 0 ? getLov("supplier_status") : ["active", "on_hold", "inactive", "blacklisted"]).map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Primary Contact</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={supplier.primary_contact_name || ""} onChange={(e) => updateField("primary_contact_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={supplier.primary_contact_email || ""} onChange={(e) => updateField("primary_contact_email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={supplier.primary_contact_phone || ""} onChange={(e) => updateField("primary_contact_phone", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Capabilities */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Capabilities</h3>
            <div className="flex flex-wrap gap-1.5">
              {getLov("supplier_capability").map((cap) => {
                const active = (supplier.capabilities || []).includes(cap);
                return (
                  <button key={cap} type="button" onClick={() => toggleArrayValue("capabilities", cap)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}>
                    {cap.replace(/_/g, " ")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Certifications */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Certifications</h3>
            <div className="flex flex-wrap gap-1.5">
              {getLov("supplier_certification").map((cert) => {
                const active = (supplier.certifications || []).includes(cert);
                return (
                  <button key={cert} type="button" onClick={() => toggleArrayValue("certifications", cert)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors uppercase tracking-wide ${active ? "bg-green-600 text-white border-green-600" : "bg-background text-muted-foreground border-border hover:border-green-400"}`}>
                    {cert.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Commercial Terms */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Default Commercial Terms</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Lead Time (days)</Label>
                <Input type="number" value={supplier.lead_time_default_days ?? ""} onChange={(e) => { const v = e.target.value; updateField("lead_time_default_days", v === "" ? null : parseFloat(v)); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Default Currency</Label>
                <Select value={supplier.currency_default || "none"} onValueChange={(v) => updateField("currency_default", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {getLov("currency").map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Terms</Label>
                <Select value={supplier.payment_terms_default || "none"} onValueChange={(v) => updateField("payment_terms_default", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {getLov("payment_terms").map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs">MOQ Policy</Label>
              <Textarea value={supplier.moq_policy || ""} onChange={(e) => updateField("moq_policy", e.target.value)} rows={2} />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={supplier.notes || ""} onChange={(e) => updateField("notes", e.target.value)} rows={3} />
          </div>

          {isNew && (
            <Button onClick={handleSave} disabled={saving || !supplier.name} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Supplier
            </Button>
          )}
        </div>
      )}

      {/* Sourced Products Tab */}
      {!isNew && activeTab === "products" && (
        <div className="space-y-2">
          {uniqueProductIds.length === 0 ? (
            <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">No products sourced from this supplier yet.</p>
            </div>
          ) : uniqueProductIds.map((pid) => {
            const prod = products.find((p) => p.id === pid);
            const link = approvedLinks.find((a) => a.product_id === pid);
            if (!prod) return null;
            return (
              <div key={pid} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border hover:border-primary/40 cursor-pointer transition-all"
                onClick={() => navigate(`/products/${pid}`)}>
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  {prod.images?.[0] ? <img src={prod.images[0]} alt={prod.name} className="w-full h-full object-contain rounded-md" /> : <Package className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{prod.name}</p>
                  <p className="text-xs text-muted-foreground">{prod.type} · {prod.category}</p>
                </div>
                {link?.is_primary && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">Primary</span>}
                {link?.rank && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">Rank {link.rank}</span>}
                {link?.unit_cost && <span className="text-xs text-muted-foreground">{link.unit_cost} {link.currency}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Routing Participation Tab */}
      {!isNew && activeTab === "routing" && (
        <div className="space-y-2">
          {routingSteps.length === 0 ? (
            <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">This supplier is not part of any manufacturing routing.</p>
            </div>
          ) : routingSteps.map((step) => {
            const routing = routings.find((r) => r.id === step.supplier_routing_id);
            const product = routing ? products.find((p) => p.id === routing.product_id) : null;
            return (
              <div key={step.id} className="p-3 bg-card rounded-xl border border-border">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{step.sequence}</span>
                  <span className="text-sm font-medium">{step.step_type?.replace(/_/g, " ")}</span>
                  {routing && <span className="text-xs text-muted-foreground">in "{routing.name}"</span>}
                  {product && (
                    <button type="button" onClick={() => navigate(`/products/${product.id}`)}
                      className="text-xs text-primary hover:underline">{product.name}</button>
                  )}
                </div>
                {step.description && <p className="text-xs text-muted-foreground mt-1 ml-8">{step.description}</p>}
                {(step.unit_cost || step.lead_time_days) && (
                  <div className="flex gap-3 mt-1 ml-8">
                    {step.unit_cost && <span className="text-xs text-muted-foreground">{step.unit_cost} {step.currency}</span>}
                    {step.lead_time_days && <span className="text-xs text-muted-foreground">{step.lead_time_days}d lead time</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}