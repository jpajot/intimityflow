import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, GitBranch, ChevronRight, Search } from "lucide-react";
import { format } from "date-fns";
import NewBOMDialog from "../components/bom/NewBOMDialog";
import { usePageOptions } from "@/lib/PageOptionsContext";

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  in_review: "bg-amber-100 text-amber-700 border-amber-300",
  released: "bg-green-100 text-green-700 border-green-300",
  superseded: "bg-purple-100 text-purple-700 border-purple-300",
  obsolete: "bg-red-100 text-red-700 border-red-300",
};

export default function BOMList({ projectId, products }) {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    base44.entities.BOM.filter({ project_id: projectId }).then((data) => {
      setBoms(data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      setLoading(false);
    });
  }, [projectId]);

  useEffect(() => {
    setOptions({
      items: [
        { label: "New BOM", icon: Plus, onClick: () => setShowNew(true), className: "text-primary hover:bg-primary/10" },
      ],
    });
  }, [setOptions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return boms;
    const q = search.toLowerCase();
    return boms.filter((b) => {
      const prod = products.find((p) => p.id === b.product_id);
      return (
        prod?.name?.toLowerCase().includes(q) ||
        prod?.code?.toLowerCase().includes(q) ||
        b.bom_type?.toLowerCase().includes(q) ||
        b.status?.toLowerCase().includes(q)
      );
    });
  }, [boms, search, products]);

  // Group by bom_type
  const grouped = useMemo(() => {
    const groups = { development: [], production: [] };
    filtered.forEach((b) => {
      const key = b.bom_type || "development";
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    });
    return groups;
  }, [filtered]);

  const handleCreated = (newBom) => {
    setBoms((prev) => [newBom, ...prev]);
    navigate(`/boms/${newBom.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-1">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search BOMs…"
          className="pl-8 h-8 text-xs"
        />
      </div>

      {boms.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <GitBranch className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No BOMs yet for this project.</p>
          <Button size="sm" variant="outline" onClick={() => setShowNew(true)} className="mt-3 gap-1">
            <Plus className="w-3.5 h-3.5" /> New BOM
          </Button>
        </div>
      ) : (
        Object.entries(grouped).map(([type, items]) => items.length === 0 ? null : (
          <div key={type} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 capitalize">
              {type} BOMs <span className="font-normal ml-1">({items.length})</span>
            </p>
            <div className="space-y-1.5">
              {items.map((bom) => {
                const prod = products.find((p) => p.id === bom.product_id);
                return (
                  <button
                    key={bom.id}
                    type="button"
                    onClick={() => navigate(`/boms/${bom.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-card rounded-xl border border-border hover:border-primary/40 hover:bg-accent/30 transition-all text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {prod ? `${prod.code || ""} ${prod.name}`.trim() : "Unknown Product"}
                        </span>
                        <span className="text-xs text-muted-foreground">Rev {bom.revision_code} · v{bom.version}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[bom.status] || ""}`}>
                          {bom.status}
                        </Badge>
                        {bom.source_change_pending && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-300">
                            ⚠ source changed
                          </Badge>
                        )}
                        {bom.released_at && (
                          <span className="text-[10px] text-muted-foreground">Released {format(new Date(bom.released_at), "dd MMM yyyy")}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      <NewBOMDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        projectId={projectId}
        products={products}
        onCreated={handleCreated}
      />
    </div>
  );
}