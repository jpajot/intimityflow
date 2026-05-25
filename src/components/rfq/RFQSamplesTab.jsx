import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Loader2, FlaskConical } from "lucide-react";
import { usePageOptions } from "@/lib/PageOptionsContext";
import SampleCreateDialog from "@/components/sample/SampleCreateDialog";
import SamplesDataTable from "@/components/sample/SamplesDataTable";
import { toast } from "sonner";

export default function RFQSamplesTab({ rfq, project }) {
  const { setOptions } = usePageOptions();
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Reference data maps
  const [productsMap, setProductsMap]   = useState({});
  const [colorsMap, setColorsMap]       = useState({});
  const [pcamsMap, setPcamsMap]         = useState({});
  const [sizesMap, setSizesMap]         = useState({});
  // Per-product helpers for inline editing
  const [colorsByProduct, setColorsByProduct] = useState({});
  const [pcamsByColor, setPcamsByColor]       = useState({});
  const [sizesByProduct, setSizesByProduct]   = useState({});

  const loadSamples = useCallback(async () => {
    setLoading(true);
    const results = await base44.entities.Sample.filter({ rfq_id: rfq.id }, "-created_date", 200);
    setSamples(results);

    if (results.length > 0) {
      const productIds = [...new Set(results.map((s) => s.product_id).filter(Boolean))];
      const sizeIds    = [...new Set(results.map((s) => s.size_id).filter(Boolean))];

      // Load products + ALL ProductColors for every product in the list (not just used ones)
      const [allProds, allColors, allSizes] = await Promise.all([
        productIds.length ? base44.entities.Product.list("code", 2000) : Promise.resolve([]),
        productIds.length ? base44.entities.ProductColor.list("colorway_code", 2000) : Promise.resolve([]),
        sizeIds.length    ? base44.entities.Size.list("name", 500) : Promise.resolve([]),
      ]);

      const pMap = {};
      allProds.filter((p) => productIds.includes(p.id)).forEach((p) => { pMap[p.id] = p; });
      setProductsMap(pMap);

      // All colors for products in this sample list (for editing dropdown)
      const productIdSet = new Set(productIds);
      const relevantColors = allColors.filter((c) => productIdSet.has(c.product_id));
      const cMap = {};
      const byProduct = {};
      relevantColors.forEach((c) => {
        cMap[c.id] = c;
        byProduct[c.product_id] = byProduct[c.product_id] || [];
        byProduct[c.product_id].push(c);
      });
      setColorsMap(cMap);
      setColorsByProduct(byProduct);

      // Load ALL PCAMs for all relevant colors (not just currently-assigned ones)
      const allColorIds = relevantColors.map((c) => c.id);
      const allPcams = allColorIds.length
        ? await base44.entities.ProductColorAndMore.list("-created_date", 2000)
        : [];
      const pcMap = {};
      const byColor = {};
      allPcams.filter((pc) => allColorIds.includes(pc.product_color_id)).forEach((pc) => {
        pcMap[pc.id] = pc;
        byColor[pc.product_color_id] = byColor[pc.product_color_id] || [];
        byColor[pc.product_color_id].push(pc);
      });
      setPcamsMap(pcMap);
      setPcamsByColor(byColor);

      const sMap = {};
      allSizes.filter((s) => sizeIds.includes(s.id)).forEach((s) => { sMap[s.id] = s; });
      setSizesMap(sMap);

      // Load sizes per product via size grids for inline editing
      const prodWithGrids = allProds.filter((p) => productIds.includes(p.id) && p.size_grid_id);
      if (prodWithGrids.length > 0) {
        const gridResults = await Promise.all(
          prodWithGrids.map((p) =>
            base44.entities.SizeGridSize.filter({ size_grid_id: p.size_grid_id })
              .then((gss) => ({ productId: p.id, sizeIds: gss.map((gs) => gs.size_id) }))
          )
        );
        const gridSizeRecords = await base44.entities.Size.list("name", 500);
        const byProd = {};
        gridResults.forEach(({ productId, sizeIds: pSizeIds }) => {
          byProd[productId] = gridSizeRecords.filter((s) => pSizeIds.includes(s.id));
        });
        setSizesByProduct(byProd);
      }
    }

    setLoading(false);
  }, [rfq.id]);

  useEffect(() => { loadSamples(); }, [loadSamples]);

  useEffect(() => {
    setOptions({
      items: [{ label: "+ Add Sample", icon: Plus, onClick: () => setShowCreate(true) }],
    });
    return () => setOptions(null);
  }, [setOptions]);

  const handleCreated = useCallback(async (newSample) => {
    await loadSamples();
    toast.success(`Sample ${newSample.code} added to this RFQ`);
  }, [loadSamples]);

  const handleUpdate = useCallback(async (sampleId, updates) => {
    await base44.entities.Sample.update(sampleId, updates);
    await loadSamples();
    toast.success("Sample updated");
  }, [loadSamples]);

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
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-semibold text-base">Samples</h2>
          <span className="text-xs text-muted-foreground">
            {samples.length} {samples.length === 1 ? "sample" : "samples"}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {project && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground">
              Project: {project.name}
            </span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground font-mono">
            RFQ: {rfq.code}
          </span>
        </div>
      </div>

      <SamplesDataTable
        samples={samples}
        columnSet="rfq_context"
        onRowUpdate={handleUpdate}
        productsMap={productsMap}
        colorsMap={colorsMap}
        pcamsMap={pcamsMap}
        sizesMap={sizesMap}
        colorsByProduct={colorsByProduct}
        pcamsByColor={pcamsByColor}
        sizesByProduct={sizesByProduct}
        emptyState={{
          icon: FlaskConical,
          title: "No samples on this RFQ yet",
          body: "Sample requests bundled with this RFQ will appear here. Sampling and costing can share a single RFQ code for unified supplier communication.",
          ctaLabel: "+ Add First Sample",
          ctaOnClick: () => setShowCreate(true),
        }}
      />

      <SampleCreateDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
        preset={{ product_id: null, project_id: rfq.project_id, rfq_id: rfq.id }}
      />
    </div>
  );
}