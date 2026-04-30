import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function BOMHeaderCard({ bom, product, project, isReadOnly }) {
  if (!bom) return null;
  return (
    <div className="bg-card rounded-xl border border-border px-4 py-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
      <div>
        <span className="font-medium text-foreground">Product</span>
        <p>{product ? `${product.code || ""} ${product.name}`.trim() : "—"}</p>
      </div>
      <div>
        <span className="font-medium text-foreground">Project</span>
        <p>{project?.name || "—"}</p>
      </div>
      <div>
        <span className="font-medium text-foreground">Type</span>
        <p className="capitalize">{bom.bom_type}</p>
      </div>
      <div>
        <span className="font-medium text-foreground">Revision</span>
        <p>Rev {bom.revision_code} · v{bom.version}</p>
      </div>
      <div>
        <span className="font-medium text-foreground">Status</span>
        <p className="capitalize">{bom.status}</p>
      </div>
      {bom.released_at && (
        <div>
          <span className="font-medium text-foreground">Released</span>
          <p>{format(new Date(bom.released_at), "dd MMM yyyy")} by {bom.released_by}</p>
        </div>
      )}
      {isReadOnly && (
        <div className="flex items-center ml-auto">
          <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600 border-slate-300">Read-only</Badge>
        </div>
      )}
    </div>
  );
}