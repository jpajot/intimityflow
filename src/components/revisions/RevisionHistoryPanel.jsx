/**
 * RevisionHistoryPanel
 * Grouped-by-target hierarchical view.
 *
 * CURRENT section: focal target (the product or color that triggered the panel)
 *   - RevisionGroupHeader (current rev card)
 *   - Prior revisions as expandable RevisionRows (most recent expanded by default)
 *
 * OTHER TARGETS section: siblings (collapsed by default)
 *   - SiblingGroupHeader → expand → same structure as CURRENT
 */
import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { GitCommit } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import NewRevisionModal from "./NewRevisionModal";
import RevisionGroupHeader from "./RevisionGroupHeader";
import RevisionRow from "./RevisionRow";
import SiblingGroupHeader from "./SiblingGroupHeader";

function SkeletonRow() {
  return (
    <div className="flex gap-3 p-4 border border-border rounded-lg animate-pulse bg-muted/10">
      <div className="w-10 h-10 rounded-lg bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-muted rounded w-2/3" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
    </div>
  );
}

export default function RevisionHistoryPanel({
  open,
  onClose,
  product,
  colorVariants = [],
  initialTargetType = "product",
  initialTargetId = null,
}) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [allRevisions, setAllRevisions] = useState([]);
  const [colorMap, setColorMap] = useState({});
  const [ecoMap, setEcoMap] = useState({});
  const [ecoRecords, setEcoRecords] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [newRevisionOpen, setNewRevisionOpen] = useState(false);
  const [ecoOnly, setEcoOnly] = useState(false);
  const [expandedSiblings, setExpandedSiblings] = useState({});

  // Focal target
  const focalType = initialTargetType || "product";
  const focalId = initialTargetId || product?.id;

  // Reset state when panel opens
  useEffect(() => {
    if (open) {
      setEcoOnly(false);
      setExpandedSiblings({});
    }
  }, [open, focalType, focalId]);

  // Fetch all revisions for the product
  useEffect(() => {
    if (!open || !product?.id) return;
    setLoading(true);
    setAllRevisions([]);

    const load = async () => {
      const productId = product.id;

      const [productRevs, colorRevs] = await Promise.all([
        base44.entities.ProductRevision.filter({ product_id: productId, target_type: "product" }, "-created_date", 200),
        base44.entities.ProductRevision.filter({ product_id: productId, target_type: "product_color" }, "-created_date", 500),
      ]);

      const all = [...productRevs, ...colorRevs].sort(
        (a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date)
      );
      setAllRevisions(all);

      // Color map from passed colorVariants
      const cm = {};
      colorVariants.forEach(c => { cm[c.id] = c; });
      setColorMap(cm);

      // ECO linkage
      if (all.length > 0) {
        const revIds = all.map(r => r.id);
        const ecoItems = await base44.entities.ECOAffectedItem.filter(
          { item_revision_id: { $in: revIds } }, "-created_date", 500
        ).catch(() => []);

        const em = {};
        const ecoIdSet = new Set();
        for (const item of ecoItems) {
          if (!item.item_revision_id || !item.eco_id) continue;
          if (!em[item.item_revision_id]) em[item.item_revision_id] = [];
          if (!em[item.item_revision_id].includes(item.eco_id)) em[item.item_revision_id].push(item.eco_id);
          ecoIdSet.add(item.eco_id);
        }
        setEcoMap(em);

        if (ecoIdSet.size > 0) {
          const ecoList = await base44.entities.ECO.filter({ id: { $in: [...ecoIdSet] } }, "-created_date", 100).catch(() => []);
          const er = {};
          ecoList.forEach(e => { er[e.id] = e; });
          setEcoRecords(er);
        }
      }

      setLoading(false);
    };

    load().catch(() => setLoading(false));
  }, [open, product?.id, colorVariants, refreshKey]);

  // Focal target derived data
  const focalCurrent = useMemo(() =>
    allRevisions.find(r => r.target_type === focalType && r.target_id === focalId && r.is_current),
    [allRevisions, focalType, focalId]);

  const focalHistory = useMemo(() => {
    const hist = allRevisions
      .filter(r => r.target_type === focalType && r.target_id === focalId && !r.is_current)
      .sort((a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date));
    return ecoOnly ? hist.filter(r => (ecoMap[r.id]?.length || 0) > 0) : hist;
  }, [allRevisions, focalType, focalId, ecoOnly, ecoMap]);

  const focalLabel = useMemo(() => {
    if (focalType === "product") return product?.name || "—";
    return colorMap[focalId]?.color_name || "—";
  }, [focalType, focalId, product, colorMap]);

  const focalEcoIds = focalCurrent ? (ecoMap[focalCurrent.id] || []) : [];

  // Build siblings list (all targets except focal)
  const siblings = useMemo(() => {
    const all = [
      { type: "product", id: product?.id, label: product?.name || "—" },
      ...colorVariants.map(c => ({ type: "product_color", id: c.id, label: c.color_name })),
    ];
    return all.filter(s => !(s.type === focalType && s.id === focalId));
  }, [product, colorVariants, focalType, focalId]);

  const getSiblingInfo = (sibling) => {
    const revs = allRevisions.filter(r => r.target_type === sibling.type && r.target_id === sibling.id);
    const current = revs.find(r => r.is_current);
    const history = revs.filter(r => !r.is_current).sort((a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date));
    const filteredHistory = ecoOnly ? history.filter(r => (ecoMap[r.id]?.length || 0) > 0) : history;
    return { current, history: filteredHistory, revisionCount: revs.length, ecoIds: current ? (ecoMap[current.id] || []) : [] };
  };

  // New Revision modal target
  const newRevTargetType = focalType;
  const newRevTargetId = focalId;
  const newRevTargetName = focalLabel;
  const newRevCurrentCode = focalCurrent?.revision_code || null;

  const toggleSibling = (key) => setExpandedSiblings(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:w-[480px] p-0 flex flex-col">

        {/* Header */}
        <div className="shrink-0 border-b border-border px-5 py-4 space-y-3">
          <SheetHeader className="space-y-0.5">
            <SheetTitle className="text-base font-semibold">Revision History</SheetTitle>
            <p className="text-xs text-muted-foreground">
              {allRevisions.length} revision{allRevisions.length !== 1 ? "s" : ""} total
            </p>
          </SheetHeader>

          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={ecoOnly}
                onChange={e => setEcoOnly(e.target.checked)}
                className="w-3.5 h-3.5 accent-primary"
              />
              Hide non-ECO revisions
            </label>
            <Button className="h-8 text-xs gap-1.5 shrink-0" onClick={() => setNewRevisionOpen(true)}>
              <GitCommit className="w-3.5 h-3.5" />
              New Revision
            </Button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {loading ? (
            <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
          ) : (
            <>
              {/* CURRENT section */}
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Current</p>
                <RevisionGroupHeader
                  targetType={focalType}
                  targetLabel={focalLabel}
                  currentRevision={focalCurrent}
                  ecoIds={focalEcoIds}
                  ecoRecords={ecoRecords}
                />
                {focalHistory.length > 0 && (
                  <div className="space-y-2 pl-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Revision History</p>
                    {focalHistory.map((rev, idx) => (
                      <RevisionRow
                        key={rev.id}
                        revision={rev}
                        defaultExpanded={idx === 0}
                        ecoIds={ecoMap[rev.id] || []}
                        ecoRecords={ecoRecords}
                      />
                    ))}
                  </div>
                )}
                {!focalCurrent && focalHistory.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">No revisions recorded for this target.</p>
                )}
              </div>

              {/* OTHER TARGETS section */}
              {siblings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Other Targets</p>
                  {siblings.map(sibling => {
                    const key = `${sibling.type}:${sibling.id}`;
                    const isExpanded = !!expandedSiblings[key];
                    const { current, history, revisionCount, ecoIds } = getSiblingInfo(sibling);
                    return (
                      <div key={key} className="space-y-2">
                        <SiblingGroupHeader
                          targetType={sibling.type}
                          targetLabel={sibling.label}
                          currentRevisionCode={current?.revision_code || "—"}
                          revisionCount={revisionCount}
                          expanded={isExpanded}
                          onToggle={() => toggleSibling(key)}
                        />
                        {isExpanded && (
                          <div className="pl-4 border-l-2 border-border space-y-2">
                            <RevisionGroupHeader
                              targetType={sibling.type}
                              targetLabel={sibling.label}
                              currentRevision={current}
                              ecoIds={ecoIds}
                              ecoRecords={ecoRecords}
                            />
                            {history.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground pl-1">Revision History</p>
                                {history.map((rev, idx) => (
                                  <RevisionRow
                                    key={rev.id}
                                    revision={rev}
                                    defaultExpanded={idx === 0}
                                    ecoIds={ecoMap[rev.id] || []}
                                    ecoRecords={ecoRecords}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <NewRevisionModal
          open={newRevisionOpen}
          onClose={() => setNewRevisionOpen(false)}
          onCreated={() => { setNewRevisionOpen(false); setRefreshKey(k => k + 1); }}
          product={product}
          targetType={newRevTargetType}
          targetId={newRevTargetId}
          targetName={newRevTargetName}
          currentRevisionCode={newRevCurrentCode}
        />
      </SheetContent>
    </Sheet>
  );
}