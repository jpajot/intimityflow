import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { GitCompare, Loader2, ArrowRight } from "lucide-react";
import BomPicker from "@/components/boms/BomPicker";
import BomDiffHeader from "@/components/boms/BomDiffHeader";
import BomDiffLines from "@/components/boms/BomDiffLines";
import BomDiffVariants from "@/components/boms/BomDiffVariants";

export default function BomComparePage() {
  const [allBoms, setAllBoms] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [allProductColors, setAllProductColors] = useState([]);
  const [allSizes, setAllSizes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [leftId, setLeftId] = useState(null);
  const [rightId, setRightId] = useState(null);

  // Diff data
  const [comparing, setComparing] = useState(false);
  const [diffData, setDiffData] = useState(null); // { leftBom, rightBom, leftLines, rightLines, leftVariants, rightVariants }

  // Parse URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const l = params.get("left");
    const r = params.get("right");
    if (l) setLeftId(l);
    if (r) setRightId(r);
  }, []);

  // Load reference data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [boms, products] = await Promise.all([
        base44.entities.BOM.list("-created_date", 500),
        base44.entities.Product.list("-created_date", 2000),
      ]);
      // Lazily load colors & sizes (only needed when comparing)
      const [colors, sizes] = await Promise.all([
        base44.entities.ProductColor.list("-created_date", 1000),
        base44.entities.Size.list("size_code", 500),
      ]);
      setAllBoms(boms);
      setAllProducts(products);
      setAllProductColors(colors);
      setAllSizes(sizes);
      setLoading(false);
    };
    load();
  }, []);

  // Auto-trigger when both pickers are filled from URL params
  const autoTriggered = useMemo(() => leftId && rightId, [leftId, rightId]);
  useEffect(() => {
    if (!loading && leftId && rightId && !diffData && !comparing) {
      runComparison(leftId, rightId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, leftId, rightId]);

  const runComparison = async (lId, rId) => {
    if (!lId || !rId) return;
    setComparing(true);
    setDiffData(null);

    const [leftBomsArr, rightBomsArr] = await Promise.all([
      base44.entities.BOM.filter({ id: lId }),
      base44.entities.BOM.filter({ id: rId }),
    ]);
    const leftBom = leftBomsArr[0];
    const rightBom = rightBomsArr[0];

    const [leftLines, rightLines] = await Promise.all([
      base44.entities.BOMLine.filter({ bom_id: lId }),
      base44.entities.BOMLine.filter({ bom_id: rId }),
    ]);

    const leftLineIds = leftLines.map(l => l.id);
    const rightLineIds = rightLines.map(l => l.id);

    const [leftVariants, rightVariants] = await Promise.all([
      leftLineIds.length > 0
        ? base44.entities.BOMLineVariant.filter({ bom_line_id: { $in: leftLineIds } })
        : Promise.resolve([]),
      rightLineIds.length > 0
        ? base44.entities.BOMLineVariant.filter({ bom_line_id: { $in: rightLineIds } })
        : Promise.resolve([]),
    ]);

    setDiffData({
      leftBom,
      rightBom,
      leftLines: leftLines.sort((a, b) => (a.position || 0) - (b.position || 0)),
      rightLines: rightLines.sort((a, b) => (a.position || 0) - (b.position || 0)),
      leftVariants,
      rightVariants,
    });
    setComparing(false);
  };

  const handleCompare = () => runComparison(leftId, rightId);

  const productMap = useMemo(() => {
    const m = {}; allProducts.forEach(p => { m[p.id] = p; }); return m;
  }, [allProducts]);

  const leftBom = allBoms.find(b => b.id === leftId);
  const rightBom = allBoms.find(b => b.id === rightId);

  const getBomLabel = (bom) => {
    if (!bom) return null;
    const prod = productMap[bom.product_id];
    return prod ? `${prod.code || ""} ${prod.name}`.trim() : bom.product_id;
  };

  return (
    <div className="px-4 py-4 space-y-5 max-w-5xl mx-auto">

      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">BOMs &rsaquo; BOM Compare</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight mt-0.5">Compare BOMs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Select two BOMs to see a unified diff — header fields, component lines, and variant-level matrix changes.
        </p>
      </div>

      {/* Pickers row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
        <div className="flex-1 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Left BOM</p>
          <BomPicker
            label="Pick left BOM…"
            value={leftId}
            onChange={(id) => { setLeftId(id); setDiffData(null); }}
            allBoms={allBoms}
            allProducts={allProducts}
            loading={loading}
          />
        </div>

        <div className="flex items-center justify-center sm:pb-0.5 shrink-0 text-muted-foreground">
          <ArrowRight className="w-4 h-4" />
        </div>

        <div className="flex-1 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Right BOM</p>
          <BomPicker
            label="Pick right BOM…"
            value={rightId}
            onChange={(id) => { setRightId(id); setDiffData(null); }}
            allBoms={allBoms}
            allProducts={allProducts}
            loading={loading}
          />
        </div>

        <Button
          onClick={handleCompare}
          disabled={!leftId || !rightId || comparing}
          className="shrink-0 gap-2 sm:self-end"
        >
          {comparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
          Compare
        </Button>
      </div>

      {/* Results area */}
      {comparing && (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Fetching BOM data…</span>
        </div>
      )}

      {!comparing && !diffData && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
          <GitCompare className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium">Pick two BOMs to compare.</p>
          <p className="text-xs opacity-60">Select both pickers above, then click Compare.</p>
        </div>
      )}

      {!comparing && diffData && (
        <div className="space-y-4">

          {/* Comparison summary bar */}
          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-xl border border-border text-sm flex-wrap">
            <span className="font-medium text-foreground truncate">
              {getBomLabel(diffData.leftBom)} · Rev {diffData.leftBom?.revision_code} v{diffData.leftBom?.version}
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground truncate">
              {getBomLabel(diffData.rightBom)} · Rev {diffData.rightBom?.revision_code} v{diffData.rightBom?.version}
            </span>
            <span className="ml-auto text-xs text-muted-foreground shrink-0">
              {diffData.leftLines.length} / {diffData.rightLines.length} lines
            </span>
          </div>

          {/* Header diff */}
          <BomDiffHeader
            leftBom={diffData.leftBom}
            rightBom={diffData.rightBom}
            productMap={productMap}
          />

          {/* Lines diff */}
          <BomDiffLines
            leftLines={diffData.leftLines}
            rightLines={diffData.rightLines}
            allProducts={allProducts}
          />

          {/* Variants diff */}
          <BomDiffVariants
            leftVariants={diffData.leftVariants}
            rightVariants={diffData.rightVariants}
            leftLines={diffData.leftLines}
            rightLines={diffData.rightLines}
            allProductColors={allProductColors}
            allSizes={allSizes}
            allProducts={allProducts}
          />
        </div>
      )}
    </div>
  );
}