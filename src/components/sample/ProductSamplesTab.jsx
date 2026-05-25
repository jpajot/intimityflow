import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Loader2, FlaskConical } from "lucide-react";
import { usePageOptions } from "@/lib/PageOptionsContext";
import SampleCreateDialog from "./SampleCreateDialog";
import SamplesDataTable from "./SamplesDataTable";
import { toast } from "sonner";

export default function ProductSamplesTab({ product }) {
  const { setOptions } = usePageOptions();
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Reference data maps
  const [colorsMap, setColorsMap]   = useState({});
  const [pcamsMap, setPcamsMap]     = useState({});
  const [sizesMap, setSizesMap]     = useState({});
  const [projectsMap, setProjectsMap] = useState({});
  const [rfqsMap, setRfqsMap]       = useState({});
  // Per-product helpers for inline editing
  const [colorsByProduct, setColorsByProduct] = useState({});
  const [pcamsByColor, setPcamsByColor]       = useState({});
  const [sizesByProduct, setSizesByProduct]   = useState({});

  const loadSamples = useCallback(async () => {
    setLoading(true);
    const [results, colors] = await Promise.all([
      base44.entities.Sample.filter({ product_id: product.id }, "-created_date", 200),
      base44.entities.ProductColor.filter({ product_id: product.id }),
    ]);
    setSamples(results);

    // Colors map
    const cMap = {};
    colors.forEach((c) => { cMap[c.id] = c; });
    setColorsMap(cMap);

    // colorsByProduct for inline editing
    setColorsByProduct({ [product.id]: colors });

    // Projects
    const projectIds = [...new Set(results.map((s) => s.project_id).filter(Boolean))];
    if (projectIds.length) {
      const projs = await base44.entities.Project.list("name", 500);
      const pMap = {};
      projs.forEach((p) => { pMap[p.id] = p; });
      setProjectsMap(pMap);
    }

    // RFQs
    const rfqIds = [...new Set(results.map((s) => s.rfq_id).filter(Boolean))];
    if (rfqIds.length) {
      const rfqs = await base44.entities.RFQ.list("-created_date", 500);
      const rMap = {};
      rfqs.forEach((r) => { rMap[r.id] = r; });
      setRfqsMap(rMap);
    }

    // PCAMs
    const colorIds = colors.map((c) => c.id);
    if (colorIds.length) {
      const allPcams = await base44.entities.ProductColorAndMore.list("-created_date", 2000);
      const pcMap = {};
      const byColor = {};
      allPcams.filter((pc) => colorIds.includes(pc.product_color_id)).forEach((pc) => {
        pcMap[pc.id] = pc;
        byColor[pc.product_color_id] = byColor[pc.product_color_id] || [];
        byColor[pc.product_color_id].push(pc);
      });
      setPcamsMap(pcMap);
      setPcamsByColor(byColor);
    }

    // Sizes from product's size grid
    if (product.size_grid_id) {
      const gridSizes = await base44.entities.SizeGridSize.filter({ size_grid_id: product.size_grid_id });
      const sizeIds = gridSizes.map((gs) => gs.size_id);
      if (sizeIds.length) {
        const allSizes = await base44.entities.Size.list("name", 500);
        const relevant = allSizes.filter((s) => sizeIds.includes(s.id));
        const sMap = {};
        relevant.forEach((s) => { sMap[s.id] = s; });
        setSizesMap(sMap);
        setSizesByProduct({ [product.id]: relevant });
      }
    }

    setLoading(false);
  }, [product.id, product.size_grid_id]);

  useEffect(() => { loadSamples(); }, [loadSamples]);

  useEffect(() => {
    setOptions({
      items: [{ label: "+ Add Sample", icon: Plus, onClick: () => setShowCreate(true) }],
    });
    return () => setOptions(null);
  }, [setOptions]);

  const handleCreated = useCallback(async (newSample) => {
    await loadSamples();
    toast.success(`Sample ${newSample.code} created`);
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
        <h2 className="font-semibold text-base">Samples</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {samples.length} {samples.length === 1 ? "sample" : "samples"}
        </p>
      </div>

      <SamplesDataTable
        samples={samples}
        columnSet="product_context"
        onRowUpdate={handleUpdate}
        colorsMap={colorsMap}
        pcamsMap={pcamsMap}
        sizesMap={sizesMap}
        projectsMap={projectsMap}
        rfqsMap={rfqsMap}
        colorsByProduct={colorsByProduct}
        pcamsByColor={pcamsByColor}
        sizesByProduct={sizesByProduct}
        emptyState={{
          icon: FlaskConical,
          title: "No samples yet",
          body: "Samples ordered for this product will appear here. Track protos, PPS, and other physical realization requests across projects.",
          ctaLabel: "+ Add First Sample",
          ctaOnClick: () => setShowCreate(true),
        }}
      />

      <SampleCreateDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
        preset={{ product_id: product.id, project_id: null, rfq_id: null }}
      />
    </div>
  );
}