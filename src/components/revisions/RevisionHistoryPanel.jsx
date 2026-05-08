/**
 * RevisionHistoryPanel
 * Right slide-in drawer surfacing ProductRevision history for a Product and its children.
 * Opens via (i) icon on Product detail page header.
 */
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Loader2, GitCommit } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// ── Helpers ────────────────────────────────────────────────────────────────────

function relTime(val) {
  if (!val) return "";
  try { return formatDistanceToNow(new Date(val), { addSuffix: true }); } catch { return ""; }
}

function targetTypeLabel(tt) {
  switch (tt) {
    case "product": return "Product";
    case "product_color": return "Color";
    case "product_color_size": return "Size";
    case "product_variant": return "Variant";
    case "product_attribute": return "Attribute";
    default: return tt || "—";
  }
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex gap-3 p-4 border border-border rounded-lg animate-pulse bg-muted/10">
      <div className="w-10 h-10 rounded-lg bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-muted rounded w-2/3" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </div>
    </div>
  );
}

// ── Revision badge letter ──────────────────────────────────────────────────────
function RevisionBadge({ code, isCurrent }) {
  return (
    <div className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center shrink-0 font-mono font-bold text-sm
      ${isCurrent
        ? "border-green-500 bg-green-50 text-green-700"
        : "border-border bg-muted/30 text-muted-foreground"}`}
    >
      {code || "?"}
    </div>
  );
}

// ── Single revision row ────────────────────────────────────────────────────────
function RevisionRow({ revision, colorMap, ecoMap, ecoRecords }) {
  const { toast } = useToast();
  const isCurrent = revision.is_current;

  const targetLabel = (() => {
    const tt = revision.target_type;
    if (tt === "product") return `Product`;
    if (tt === "product_color") {
      const color = colorMap[revision.target_id];
      return color ? `Color: ${color.color_name}` : `Color`;
    }
    return `${targetTypeLabel(tt)}: ${revision.target_id?.slice(-6)}`;
  })();

  const linkedEcoIds = ecoMap[revision.id] || [];

  return (
    <div className={`rounded-lg border p-4 transition-colors hover:bg-muted/20 relative
      ${isCurrent ? "border-green-300 bg-green-50/30 border-l-4 border-l-green-500" : "border-border bg-card"}`}>

      <div className="flex gap-3">
        <RevisionBadge code={revision.revision_code} isCurrent={isCurrent} />

        <div className="flex-1 min-w-0 space-y-1">
          {/* Target identity */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{targetLabel}</span>
            {isCurrent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300 font-medium">
                Current
              </span>
            )}
          </div>

          {/* Context */}
          {revision.revision_context && (
            <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
              {revision.revision_context}
            </p>
          )}

          {/* Field diffs summary */}
          {revision.field_diffs?.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {revision.field_diffs.map(d => d.field).join(", ")} changed
            </p>
          )}

          {/* Author + time */}
          <p className="text-[11px] text-muted-foreground">
            {revision.created_by ? revision.created_by.split("@")[0] : "system"} · {relTime(revision.created_at || revision.created_date)}
          </p>

          {/* ECO badges */}
          {linkedEcoIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {linkedEcoIds.map((ecoId) => {
                const eco = ecoRecords[ecoId];
                return eco ? (
                  <Link key={ecoId} to={`/change-management/ecos/${ecoId}`}>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300 font-medium hover:bg-blue-200 transition-colors cursor-pointer">
                      {eco.eco_number}
                    </span>
                  </Link>
                ) : null;
              })}
            </div>
          )}

          {/* View diff placeholder */}
          <button
            type="button"
            onClick={() => toast({ title: "Diff view — coming in Phase 6." })}
            className="text-[11px] text-primary hover:underline mt-0.5 block"
          >
            View diff
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RevisionHistoryPanel({
  open,
  onClose,
  product,               // full product record
  colorVariants = [],    // ProductColor[] already loaded on the page
  initialTargetType = "all", // pre-filter (e.g. "product_color" from child page badge)
}) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [colorMap, setColorMap] = useState({}); // { colorId: ProductColor }
  const [ecoMap, setEcoMap] = useState({});     // { revisionId: [ecoId, ...] }
  const [ecoRecords, setEcoRecords] = useState({}); // { ecoId: ECO }

  // Filters
  const [typeFilter, setTypeFilter] = useState(initialTargetType);
  const [ecoOnly, setEcoOnly] = useState(false);

  // Reset filters when initialTargetType changes (e.g. opened from a child badge)
  useEffect(() => {
    setTypeFilter(initialTargetType);
    setEcoOnly(false);
  }, [initialTargetType, open]);

  // ── Fetch all revisions for this product ──────────────────────────────────────
  useEffect(() => {
    if (!open || !product?.id) return;
    setLoading(true);
    setRevisions([]);
    setColorMap({});
    setEcoMap({});
    setEcoRecords({});

    const load = async () => {
      const productId = product.id;

      // 1. Load product-level + color-level revisions in parallel
      const colorIds = colorVariants.map(c => c.id);

      const [productRevs, colorRevs] = await Promise.all([
        base44.entities.ProductRevision.filter({ product_id: productId, target_type: "product" }, "-created_date", 200),
        colorIds.length > 0
          ? base44.entities.ProductRevision.filter({ product_id: productId, target_type: "product_color" }, "-created_date", 500)
          : Promise.resolve([]),
      ]);

      const all = [...productRevs, ...colorRevs].sort(
        (a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date)
      );

      setRevisions(all);

      // 2. Build colorMap from already-loaded colorVariants
      const cm = {};
      colorVariants.forEach(c => { cm[c.id] = c; });
      setColorMap(cm);

      // 3. ECO linkage — batch query
      if (all.length > 0) {
        const revIds = all.map(r => r.id);
        const ecoItems = await base44.entities.ECOAffectedItem.filter(
          { item_revision_id: { $in: revIds } },
          "-created_date",
          500
        ).catch(() => []);

        // Build revisionId → [ecoIds] map
        const em = {};
        const ecoIdSet = new Set();
        for (const item of ecoItems) {
          if (!item.item_revision_id || !item.eco_id) continue;
          if (!em[item.item_revision_id]) em[item.item_revision_id] = [];
          if (!em[item.item_revision_id].includes(item.eco_id)) {
            em[item.item_revision_id].push(item.eco_id);
          }
          ecoIdSet.add(item.eco_id);
        }
        setEcoMap(em);

        // Batch-fetch ECO records for badge labels
        if (ecoIdSet.size > 0) {
          const ecoList = await base44.entities.ECO.filter(
            { id: { $in: [...ecoIdSet] } },
            "-created_date",
            100
          ).catch(() => []);
          const er = {};
          ecoList.forEach(e => { er[e.id] = e; });
          setEcoRecords(er);
        }
      }

      setLoading(false);
    };

    load().catch(() => setLoading(false));
  }, [open, product?.id]);

  // ── Filtered revisions ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = revisions;
    if (typeFilter !== "all") rows = rows.filter(r => r.target_type === typeFilter);
    if (ecoOnly) rows = rows.filter(r => (ecoMap[r.id]?.length || 0) > 0);
    return rows;
  }, [revisions, typeFilter, ecoOnly, ecoMap]);

  // ── Available target types ────────────────────────────────────────────────────
  const availableTypes = useMemo(() => {
    const types = new Set(revisions.map(r => r.target_type));
    return [...types];
  }, [revisions]);

  // ── Summary ────────────────────────────────────────────────────────────────────
  const newest = revisions[0];
  const lastUpdated = newest ? relTime(newest.created_at || newest.created_date) : null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:w-[440px] p-0 flex flex-col">
        {/* ── Sticky header ──────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border px-5 py-4 space-y-3">
          <SheetHeader className="space-y-0.5">
            <SheetTitle className="text-base font-semibold leading-snug">
              Revision History{product?.name ? ` — ${product.name}` : ""}
            </SheetTitle>
            <p className="text-xs text-muted-foreground">
              {revisions.length} revision{revisions.length !== 1 ? "s" : ""} total
              {lastUpdated ? ` · Last updated ${lastUpdated}` : ""}
            </p>
          </SheetHeader>

          {/* New Revision button — placeholder */}
          <Button
            className="w-full h-8 text-sm gap-1.5"
            onClick={() => toast({ title: "Coming in Prompt #18." })}
          >
            <GitCommit className="w-3.5 h-3.5" />
            New Revision
          </Button>
        </div>

        {/* ── Sticky filter row ──────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border px-5 py-3 flex items-center gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {availableTypes.includes("product") && <SelectItem value="product">Product</SelectItem>}
              {availableTypes.includes("product_color") && <SelectItem value="product_color">Colors</SelectItem>}
              {availableTypes.includes("product_color_size") && <SelectItem value="product_color_size">Sizes</SelectItem>}
              {availableTypes.includes("product_variant") && <SelectItem value="product_variant">Variants</SelectItem>}
              {availableTypes.includes("product_attribute") && <SelectItem value="product_attribute">Attributes</SelectItem>}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={ecoOnly}
              onChange={e => setEcoOnly(e.target.checked)}
              className="w-3.5 h-3.5 accent-primary"
            />
            ECO-linked only
          </label>
        </div>

        {/* ── Scrollable body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <GitCommit className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {revisions.length === 0
                  ? "No revisions recorded for this product yet."
                  : "No revisions match the current filters."}
              </p>
            </div>
          ) : (
            filtered.map(rev => (
              <RevisionRow
                key={rev.id}
                revision={rev}
                colorMap={colorMap}
                ecoMap={ecoMap}
                ecoRecords={ecoRecords}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}