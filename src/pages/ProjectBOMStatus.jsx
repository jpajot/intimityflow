import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronRight, AlertTriangle, Search, ExternalLink } from "lucide-react";
import { format, isAfter, isBefore, parseISO } from "date-fns";

const STATUS_COLORS = {
  draft: "bg-blue-100 text-blue-700 border-blue-300",
  in_review: "bg-amber-100 text-amber-700 border-amber-300",
  released: "bg-green-100 text-green-700 border-green-300",
  superseded: "bg-purple-100 text-purple-700 border-purple-300",
  obsolete: "bg-gray-100 text-gray-500 border-gray-300",
};

function isActiveToday(bom) {
  if (bom.status !== "released") return false;
  const today = new Date();
  if (bom.valid_from && isBefore(today, parseISO(bom.valid_from))) return false;
  if (bom.valid_until && isAfter(today, parseISO(bom.valid_until))) return false;
  return true;
}

export default function ProjectBOMStatus({ projectId, project, linkedStyles }) {
  const navigate = useNavigate();
  const [boms, setBoms] = useState([]);
  const [bols, setBols] = useState([]);
  const [routings, setRoutings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showMissingPanel, setShowMissingPanel] = useState(false);

  // Products in this project
  const projectProductIds = useMemo(() => new Set(linkedStyles.map((s) => s.id)), [linkedStyles]);

  useEffect(() => {
    if (!projectProductIds.size) { setLoading(false); return; }
    Promise.all([
      base44.entities.BOM.list("-updated_date", 1000),
      base44.entities.BOL.list("-created_date", 500),
      base44.entities.SupplierRouting.list("name", 500),
    ]).then(([b, bl, r]) => {
      // Only BOMs for products in this project
      setBoms(b.filter((bom) => projectProductIds.has(bom.product_id)));
      setBols(bl);
      setRoutings(r);
      setLoading(false);
    });
  }, [projectProductIds]);

  const filtered = useMemo(() => {
    return boms.filter((b) => {
      if (filterType !== "all" && b.bom_type !== filterType) return false;
      if (filterStatus !== "all" && b.status !== filterStatus) return false;
      if (search.trim()) {
        const prod = linkedStyles.find((p) => p.id === b.product_id);
        const q = search.toLowerCase();
        if (!prod?.name?.toLowerCase().includes(q) && !prod?.code?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [boms, filterType, filterStatus, search, linkedStyles]);

  // Products with zero BOMs
  const productsWithNoBOM = useMemo(() => {
    const bomProductIds = new Set(boms.map((b) => b.product_id));
    return linkedStyles.filter((p) => !bomProductIds.has(p.id));
  }, [boms, linkedStyles]);

  // Group by product, then bom_type
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((b) => {
      const prod = linkedStyles.find((p) => p.id === b.product_id);
      if (!map[b.product_id]) {
        map[b.product_id] = {
          product: prod,
          dev: [],
          prod: [],
        };
      }
      if (b.bom_type === "production") map[b.product_id].prod.push(b);
      else map[b.product_id].dev.push(b);
    });
    return Object.values(map).sort((a, b) =>
      (a.product?.code || "").localeCompare(b.product?.code || "")
    );
  }, [filtered, linkedStyles]);

  const getBOL = (bomId) => bols.find((bl) => bl.bom_id === bomId);
  const getRouting = (routingId) => routings.find((r) => r.id === routingId);

  const rowClass = (bom) => {
    if (["superseded", "obsolete"].includes(bom.status)) return "opacity-50";
    if (bom.status === "draft") return "border-l-2 border-l-blue-300";
    if (bom.status === "in_review") return "border-l-2 border-l-amber-400";
    if (bom.status === "released" && isActiveToday(bom)) return "border-l-2 border-l-green-500";
    return "";
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Page description */}
      <p className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-3 py-2">
        Read-only view of BOMs and BOLs for products linked to this project. To create or edit a BOM, open the Product directly.
      </p>

      {/* Missing BOMs banner */}
      {productsWithNoBOM.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="flex-1 text-xs">
            <span className="font-semibold text-amber-800">{productsWithNoBOM.length} Product{productsWithNoBOM.length > 1 ? "s" : ""} in this project have no BOM yet.</span>
          </div>
          <Button size="sm" variant="outline" className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => setShowMissingPanel((v) => !v)}>
            {showMissingPanel ? "Hide" : "View list"}
          </Button>
        </div>
      )}

      {showMissingPanel && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Products without any BOM</p>
          {productsWithNoBOM.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              {p.images?.[0] && <img src={p.images[0]} className="w-6 h-6 rounded object-cover border border-border shrink-0" alt="" />}
              <span className="text-xs font-mono text-muted-foreground">{p.code}</span>
              <span className="text-xs flex-1">{p.name}</span>
              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => navigate(`/products/${p.id}`)}>
                <ExternalLink className="w-3 h-3" /> Open Product
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[140px]">
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
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          No BOMs found for products in this project.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Product</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Type</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Revision</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Status</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Valid From</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Valid Until</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Active?</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Routing</th>
                <th className="px-2 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => {
                const allBOMs = [...group.dev, ...group.prod];
                return allBOMs.map((bom, idx) => {
                  const bol = getBOL(bom.id);
                  const routing = bom.selected_routing_id ? getRouting(bom.selected_routing_id) : null;
                  const active = isActiveToday(bom);
                  const rows = [];

                  // BOM row
                  rows.push(
                    <tr key={bom.id} className={`border-b border-border last:border-0 hover:bg-muted/10 transition-colors ${rowClass(bom)}`}>
                      <td className="px-3 py-2.5">
                        {idx === 0 && (
                          <div className="flex items-center gap-2">
                            {group.product?.images?.[0] && <img src={group.product.images[0]} className="w-6 h-6 rounded object-cover border border-border shrink-0" alt="" />}
                            <div>
                              <span className="font-mono text-muted-foreground mr-1">{group.product?.code}</span>
                              <span className="font-medium">{group.product?.name}</span>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{bom.bom_type}</Badge>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground">Rev {bom.revision_code} · v{bom.version}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[bom.status] || ""}`}>
                          {bom.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{bom.valid_from ? format(new Date(bom.valid_from), "dd MMM yy") : "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{bom.valid_until ? format(new Date(bom.valid_until), "dd MMM yy") : "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={`w-2 h-2 rounded-full inline-block ${active ? "bg-green-500" : "bg-gray-300"}`} title={active ? "Active today" : "Not active"} />
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{routing?.name || "—"}</td>
                      <td className="px-2 py-2.5">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => navigate(`/boms/${bom.id}`)}>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );

                  // BOL row (indented, under production BOM)
                  if (bol && bom.bom_type === "production") {
                    rows.push(
                      <tr key={`bol-${bol.id}`} className="border-b border-border last:border-0 bg-muted/5">
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2 pl-6">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-700 border-indigo-200">BOL</Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">↳ {routing?.name || "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[bom.status] || ""}`}>
                            {bom.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-muted-foreground">—</td>
                        <td className="px-3 py-2">
                          <span className={`w-2 h-2 rounded-full inline-block ${active ? "bg-green-500" : "bg-gray-300"}`} />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {bol.source_routing_snapshot_at ? format(new Date(bol.source_routing_snapshot_at), "dd MMM yy") : "—"}
                        </td>
                        <td className="px-2 py-2"></td>
                      </tr>
                    );
                  }

                  return rows;
                });
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}