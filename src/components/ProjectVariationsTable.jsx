import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Copy, Plus, Loader2 } from "lucide-react";
import DataTable from "@/components/DataTable";

export default function ProjectVariationsTable({ projectId, productType, variations, products, colorVariants, onRefresh }) {
  const [copying, setCopying] = useState(null);

  const handleCopyVariation = async (variation) => {
    setCopying(variation.id);
    const sequence = String(parseInt(variation.sequence || "0", 10) + 1).padStart(4, "0");
    await base44.entities.ProductColorAndMore.create({
      product_color_id: variation.product_color_id,
      name: variation.name,
      sequence,
      description: variation.description,
      color_hex: variation.color_hex,
      image_url: variation.image_url,
      size_ids: variation.size_ids || [],
      pack_code: variation.pack_code,
    });
    setCopying(null);
    onRefresh?.();
  };

  const filteredVariations = variations.filter((v) => {
    const color = colorVariants.find((cv) => cv.id === v.product_color_id);
    const product = products.find((p) => p.id === color?.product_id);
    return product?.type === productType;
  });

  const getGroupKey = (v) => {
    const color = colorVariants.find((cv) => cv.id === v.product_color_id);
    const product = products.find((p) => p.id === color?.product_id);
    return product?.id || "unknown";
  };

  const grouped = {};
  filteredVariations.forEach((v) => {
    const key = getGroupKey(v);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(v);
  });

  const columns = [
    {
      id: "style",
      label: "Style",
      width: 180,
      render: (v) => {
        const color = colorVariants.find((cv) => cv.id === v.product_color_id);
        const product = products.find((p) => p.id === color?.product_id);
        return (
          <div className="flex items-center gap-2">
            {product?.images?.[0] && (
              <div className="w-10 h-10 rounded-md overflow-hidden border border-border shrink-0">
                <img src={product.images[0]} alt={product?.name} className="w-full h-full object-cover" />
              </div>
            )}
            <span className="font-medium text-sm">{product?.name || "—"}</span>
          </div>
        );
      },
    },
    {
      id: "color_name",
      label: "Color",
      width: 120,
      sortKey: (v) => {
        const color = colorVariants.find((cv) => cv.id === v.product_color_id);
        return color?.color_name || "";
      },
      render: (v) => {
        const color = colorVariants.find((cv) => cv.id === v.product_color_id);
        return <span className="text-sm text-muted-foreground">{color?.color_name || "—"}</span>;
      },
    },
    {
      id: "name",
      label: "Variation Name",
      width: 140,
      sortKey: (v) => v.name || "",
      render: (v) => <span className="text-sm">{v.name}</span>,
    },
    {
      id: "sequence",
      label: "Sequence",
      width: 100,
      sortKey: (v) => v.sequence || "",
      render: (v) => <span className="text-sm text-muted-foreground">{v.sequence || "—"}</span>,
    },
    {
      id: "pack_code",
      label: "Pack Code",
      width: 100,
      sortKey: (v) => v.pack_code || "",
      render: (v) => <span className="text-sm text-muted-foreground">{v.pack_code || "—"}</span>,
    },
    {
      id: "copy",
      label: "Action",
      width: 80,
      render: (v) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleCopyVariation(v)}
          disabled={copying === v.id}
          className="gap-1.5 h-7 text-xs"
        >
          {copying === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
          Copy
        </Button>
      ),
    },
  ];

  if (filteredVariations.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">No variations yet. Create a style and add color variations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([productId, vars]) => {
        const product = products.find((p) => p.id === productId);
        return (
          <div key={productId} className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {product?.name || "Unknown"} ({vars.length})
              </span>
            </div>
            <DataTable
              columns={columns}
              rows={vars}
              fixedColumns={["style"]}
              filterFields={[
                { getValue: (v) => {
                    const color = colorVariants.find((cv) => cv.id === v.product_color_id);
                    return color?.color_name || "";
                  }
                },
                { getValue: (v) => v.name },
              ]}
            />
          </div>
        );
      })}
    </div>
  );
}