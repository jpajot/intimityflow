import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, ClipboardList, ExternalLink } from "lucide-react";
import NewBOMDialog from "./NewBOMDialog";

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  in_review: "bg-amber-100 text-amber-700 border-amber-300",
  released: "bg-green-100 text-green-700 border-green-300",
  superseded: "bg-purple-100 text-purple-700 border-purple-300",
  obsolete: "bg-red-100 text-red-700 border-red-300",
};

export default function ProductBomsTab({ product }) {
  const navigate = useNavigate();
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewBom, setShowNewBom] = useState(false);

  const loadBoms = async () => {
    setLoading(true);
    const result = await base44.entities.BOM.filter({ product_id: product.id }, "-created_date", 100);
    setBoms(result);
    setLoading(false);
  };

  useEffect(() => {
    loadBoms();
  }, [product.id]);

  const handleCreated = (newBom) => {
    setShowNewBom(false);
    navigate(`/boms/${newBom.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-base">BOMs</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Bills of Materials for {product.code ? `${product.code} ` : ""}{product.name}</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNewBom(true)}>
          <Plus className="w-3.5 h-3.5" />
          New BOM
        </Button>
      </div>

      {/* BOM list */}
      {boms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
          <ClipboardList className="w-10 h-10 opacity-25" />
          <p className="text-sm font-medium">No BOMs created for this product yet.</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowNewBom(true)}>
            <Plus className="w-3.5 h-3.5" />
            Create first BOM
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          {boms.map((bom, i) => (
            <div
              key={bom.id}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer ${i !== 0 ? "border-t border-border" : ""}`}
              onClick={() => navigate(`/boms/${bom.id}`)}
            >
              {/* Rev + version */}
              <div className="shrink-0 w-16 text-center">
                <p className="text-sm font-semibold text-foreground">Rev {bom.revision_code}</p>
                <p className="text-[11px] text-muted-foreground">v{bom.version}</p>
              </div>

              {/* Type + status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[bom.status] || "bg-muted text-muted-foreground border-border"}`}>
                    {bom.status}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground capitalize">
                    {bom.bom_type}
                  </span>
                  {bom.released_at && (
                    <span className="text-[11px] text-muted-foreground">
                      Released {new Date(bom.released_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {bom.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{bom.notes}</p>
                )}
              </div>

              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </div>
          ))}
        </div>
      )}

      <NewBOMDialog
        open={showNewBom}
        onClose={() => setShowNewBom(false)}
        products={[product]}
        preselectedProduct={product}
        onCreated={handleCreated}
      />
    </div>
  );
}