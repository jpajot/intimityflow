import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, FlaskConical } from "lucide-react";
import DataTable from "@/components/DataTable";
import { usePageOptions } from "@/lib/PageOptionsContext";
import SampleCreateDialog from "@/components/sample/SampleCreateDialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const SAMPLE_TYPE_LABELS = {
  volume: "Volume",
  proto: "Proto",
  sample: "Sample",
  sms: "SMS",
  test_au_porter: "Test Au Porter",
  gold_seal: "Gold Seal",
  pps: "PPS",
};

const CONFORMITY_STYLES = {
  not_assessed: "bg-slate-100 text-slate-600 border-slate-200",
  pass: "bg-green-100 text-green-700 border-green-200",
  fail_minor: "bg-amber-100 text-amber-700 border-amber-200",
  fail_major: "bg-red-100 text-red-700 border-red-200",
  pending_review: "bg-blue-100 text-blue-700 border-blue-200",
};

const CONFORMITY_LABELS = {
  not_assessed: "Not Assessed",
  pass: "Pass",
  fail_minor: "Fail (Minor)",
  fail_major: "Fail (Major)",
  pending_review: "Pending Review",
};

function PhaseChip({ phase }) {
  if (!phase) return null;
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
      style={
        phase === "production"
          ? { color: "#059669", backgroundColor: "#d1fae5", borderColor: "#6ee7b7" }
          : { color: "#6B7280", backgroundColor: "#f3f4f6", borderColor: "#d1d5db" }
      }
    >
      {phase === "production" ? "Production" : "Development"}
    </span>
  );
}

function buildColumns(navigate, productsMap, colorsMap, pcamsMap, sizesMap) {
  return [
    {
      id: "code",
      label: "Code",
      width: 130,
      sortKey: (r) => r.code || "",
      render: (r) => (
        <button
          type="button"
          onClick={() => navigate(`/samples/${r.id}`)}
          className="font-mono text-xs text-primary hover:underline"
        >
          {r.code || "—"}
        </button>
      ),
    },
    {
      id: "product",
      label: "Product",
      width: 200,
      sortKey: (r) => productsMap[r.product_id]?.code || "",
      render: (r) => {
        const prod = productsMap[r.product_id];
        if (!prod) return <span className="text-xs text-muted-foreground/40">—</span>;
        return (
          <button
            type="button"
            onClick={() => navigate(`/products/${prod.id}`)}
            className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded bg-muted shrink-0 overflow-hidden flex items-center justify-center">
              {prod.images?.[0]
                ? <img src={prod.images[0]} alt="" className="w-full h-full object-contain" />
                : <span className="text-[9px] font-mono text-muted-foreground">{(prod.code || "").slice(0, 4)}</span>}
            </div>
            <div className="min-w-0">
              <span className="font-mono text-[10px] text-muted-foreground block">{prod.code}</span>
              <span className="text-xs font-medium truncate block max-w-[130px]">{prod.name}</span>
            </div>
          </button>
        );
      },
    },
    {
      id: "sample_type",
      label: "Type",
      width: 130,
      sortKey: (r) => r.sample_type || "",
      render: (r) => (
        <span className="text-xs text-foreground">{SAMPLE_TYPE_LABELS[r.sample_type] || r.sample_type || "—"}</span>
      ),
    },
    {
      id: "phase",
      label: "Phase",
      width: 110,
      sortKey: (r) => r.phase || "",
      render: (r) => <PhaseChip phase={r.phase} />,
    },
    {
      id: "color",
      label: "Color",
      width: 130,
      sortKey: (r) => colorsMap[r.product_color_id]?.color_name || "",
      render: (r) => {
        const c = colorsMap[r.product_color_id];
        if (!c) return <span className="text-xs text-muted-foreground/40">—</span>;
        return (
          <span className="flex items-center gap-1.5 text-xs">
            {c.color_hex && (
              <span className="w-3 h-3 rounded-full inline-block border border-border shrink-0" style={{ backgroundColor: c.color_hex }} />
            )}
            {c.colorway_code || c.color_name}
          </span>
        );
      },
    },
    {
      id: "variation",
      label: "Variation",
      width: 120,
      sortKey: (r) => pcamsMap[r.product_color_and_more_id]?.name || "",
      render: (r) => {
        const pc = pcamsMap[r.product_color_and_more_id];
        return pc
          ? <span className="text-xs text-muted-foreground">{pc.name || pc.sequence}</span>
          : <span className="text-xs text-muted-foreground/40">—</span>;
      },
    },
    {
      id: "size",
      label: "Size",
      width: 80,
      sortKey: (r) => sizesMap[r.size_id]?.code || "",
      render: (r) => {
        const s = sizesMap[r.size_id];
        return s
          ? <span className="text-xs text-muted-foreground">{s.code || s.name}</span>
          : <span className="text-xs text-muted-foreground/40">—</span>;
      },
    },
    {
      id: "qty",
      label: "Req. Qty",
      width: 80,
      sortKey: (r) => r.requested_quantity ?? -1,
      render: (r) => r.requested_quantity != null
        ? <span className="text-xs text-foreground">{r.requested_quantity}</span>
        : <span className="text-xs text-muted-foreground/40">—</span>,
    },
    {
      id: "conformity",
      label: "Conformity",
      width: 130,
      sortKey: (r) => r.conformity_status || "",
      render: (r) => (
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CONFORMITY_STYLES[r.conformity_status] || "bg-muted text-muted-foreground border-border"}`}>
          {CONFORMITY_LABELS[r.conformity_status] || r.conformity_status || "—"}
        </span>
      ),
    },
    {
      id: "created_date",
      label: "Created",
      width: 110,
      sortKey: (r) => r.created_date || "",
      render: (r) => r.created_date
        ? <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_date), { addSuffix: true })}</span>
        : <span className="text-xs text-muted-foreground/40">—</span>,
    },
  ];
}

export default function RFQSamplesTab({ rfq, project }) {
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [productsMap, setProductsMap] = useState({});
  const [colorsMap, setColorsMap] = useState({});
  const [pcamsMap, setPcamsMap] = useState({});
  const [sizesMap, setSizesMap] = useState({});

  const loadSamples = useCallback(async () => {
    setLoading(true);
    const results = await base44.entities.Sample.filter({ rfq_id: rfq.id }, "-created_date", 200);
    setSamples(results);

    if (results.length > 0) {
      const productIds = [...new Set(results.map((s) => s.product_id).filter(Boolean))];
      const colorIds   = [...new Set(results.map((s) => s.product_color_id).filter(Boolean))];
      const sizeIds    = [...new Set(results.map((s) => s.size_id).filter(Boolean))];

      const [prods, colors, allPcams, allSizes] = await Promise.all([
        productIds.length ? base44.entities.Product.list("code", 2000) : Promise.resolve([]),
        colorIds.length   ? base44.entities.ProductColor.list("-created_date", 2000) : Promise.resolve([]),
        colorIds.length   ? base44.entities.ProductColorAndMore.list("-created_date", 2000) : Promise.resolve([]),
        sizeIds.length    ? base44.entities.Size.list("name", 500) : Promise.resolve([]),
      ]);

      const pMap = {};
      prods.filter((p) => productIds.includes(p.id)).forEach((p) => { pMap[p.id] = p; });
      setProductsMap(pMap);

      const cMap = {};
      colors.filter((c) => colorIds.includes(c.id)).forEach((c) => { cMap[c.id] = c; });
      setColorsMap(cMap);

      const pcamIds = new Set(results.map((s) => s.product_color_and_more_id).filter(Boolean));
      const pcMap = {};
      allPcams.filter((pc) => pcamIds.has(pc.id)).forEach((pc) => { pcMap[pc.id] = pc; });
      setPcamsMap(pcMap);

      const sMap = {};
      allSizes.filter((s) => sizeIds.includes(s.id)).forEach((s) => { sMap[s.id] = s; });
      setSizesMap(sMap);
    }

    setLoading(false);
  }, [rfq.id]);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  // Register Options menu
  useEffect(() => {
    setOptions({
      items: [
        {
          label: "+ Add Sample",
          icon: Plus,
          onClick: () => setShowCreate(true),
        },
      ],
    });
    return () => setOptions(null);
  }, [setOptions]);

  const handleCreated = useCallback(async (newSample) => {
    await loadSamples();
    toast.success(`Sample ${newSample.code} added to this RFQ`);
  }, [loadSamples]);

  const columns = buildColumns(navigate, productsMap, colorsMap, pcamsMap, sizesMap);

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
      </div>

      {samples.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
          <FlaskConical className="w-10 h-10 opacity-25" />
          <p className="text-sm font-semibold text-foreground/70">No samples on this RFQ yet</p>
          <p className="text-xs text-center max-w-xs">
            Sample requests bundled with this RFQ will appear here. Sampling and costing can share a single RFQ code for unified supplier communication.
          </p>
          <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" />
            Add First Sample
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={samples}
          fixedColumns={["code"]}
          filterFields={[]}
          hideColumnToggle
        />
      )}

      <SampleCreateDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
        preset={{
          product_id: null,
          project_id: rfq.project_id,
          rfq_id: rfq.id,
        }}
      />
    </div>
  );
}