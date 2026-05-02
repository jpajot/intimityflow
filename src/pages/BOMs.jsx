import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, GitBranch, ChevronRight, Search } from "lucide-react";
import { format, isAfter, isBefore, parseISO } from "date-fns";
import { usePageOptions } from "@/lib/PageOptionsContext";
import NewBOMDialog from "../components/bom/NewBOMDialog";

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  in_review: "bg-amber-100 text-amber-700 border-amber-300",
  released: "bg-green-100 text-green-700 border-green-300",
  superseded: "bg-purple-100 text-purple-700 border-purple-300",
  obsolete: "bg-red-100 text-red-700 border-red-300",
};

function isActiveToday(bom) {
  if (bom.status !== "released") return false;
  const today = new Date();
  if (bom.valid_from && isBefore(today, parseISO(bom.valid_from))) return false;
  if (bom.valid_until && isAfter(today, parseISO(bom.valid_until))) return false;
  return true;
}

export default function BOMs() {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();
  const [boms, setBoms] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterValidity, setFilterValidity] = useState("all");
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.BOM.list("-created_date", 500),
      base44.entities.Product.list("-created_date", 2000),
    ]).then(([b, p]) => {
      setBoms(b);
      setProducts(p);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setOptions({
      items: [
        { label: "New BOM", icon: Plus, onClick: () => setShowNew(true), className: "text-primary hover:bg-primary/10" },
      ],
    });
  }, [setOptions]);

  const filtered = useMemo(() => {
    return boms.filter((b) => {
      const prod = products.find((p) => p.id === b.product_id);
      if (filterType !== "all" && b.bom_type !== filterType) return false;
      if (filterStatus !== "all" && b.status !== filterStatus) return false;
      if (filterValidity !== "all") {
        const today = new Date();
        if (filterValidity === "active_today" && !isActiveToday(b)) return false;
        if (filterValidity === "draft" && b.status !== "draft") return false;
        if (filterValidity === "expired" && !(b.valid_until && isAfter(today, parseISO(b.valid_until)))) return false;
        if (filterValidity === "future" && !(b.valid_from && isBefore(today, parseISO(b.valid_from)))) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          prod?.name?.toLowerCase().includes(q) ||
          prod?.code?.toLowerCase().includes(q) ||
          b.status?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [boms, search, filterType, filterStatus, filterValidity, products]);

  // Group by product
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((b) => {
      const prod = products.find((p) => p.id === b.product_id);
      const key = b.product_id || "__none";
      if (!map[key]) map[key] = { name: prod ? `${prod.code || ""} ${prod.name}`.trim() : "Unknown Product", items: [] };
      map[key].items.push(b);
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered, products]);

  const handleCreated = (newBom) => {
    setBoms((prev) => [newBom, ...prev]);
    navigate(`/boms/${newBom.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-semibold tracking-tight flex-1">Bills of Materials</h1>
        <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New BOM
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product…" className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="development">Development</SelectItem>
            <SelectItem value="production">Production</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="released">Released</SelectItem>
            <SelectItem value="superseded">Superseded</SelectItem>
            <SelectItem value="obsolete">Obsolete</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterValidity} onValueChange={setFilterValidity}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Validity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Validity</SelectItem>
            <SelectItem value="active_today">Active Today</SelectItem>
            <SelectItem value="draft">Draft (no validity)</SelectItem>
            <SelectItem value="future">Future (not yet active)</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed border-border">
          <GitBranch className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{boms.length === 0 ? "No BOMs yet. Create one to get started." : "No results match your filters."}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.name} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                {group.name} <span className="font-normal ml-1">({group.items.length})</span>
              </p>
              <div className="space-y-1.5">
                {group.items.map((bom) => {
                  const active = isActiveToday(bom);
                  return (
                    <button
                      key={bom.id}
                      type="button"
                      onClick={() => navigate(`/boms/${bom.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-card rounded-xl border border-border hover:border-primary/40 hover:bg-accent/30 transition-all text-left group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">Rev {bom.revision_code} · v{bom.version}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{bom.bom_type}</Badge>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[bom.status] || ""}`}>
                            {bom.status}
                          </Badge>
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" title="Active today" />}
                          {bom.source_change_pending && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-300">
                              ⚠ source changed
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px] text-muted-foreground">
                          {bom.valid_from && <span>From {format(new Date(bom.valid_from), "dd MMM yyyy")}</span>}
                          {bom.valid_until && <span>Until {format(new Date(bom.valid_until), "dd MMM yyyy")}</span>}
                          {bom.released_at && <span>Released {format(new Date(bom.released_at), "dd MMM yyyy")}</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewBOMDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        products={products}
        onCreated={handleCreated}
      />
    </div>
  );
}