import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, Plus } from "lucide-react";
import DataTable from "@/components/DataTable";
import LinkProductVariationsModal from "./LinkProductVariationsModal";

export default function ProjectPlannedVariations({
  projectId,
  variations,
  products,
  colorVariants,
  assignments,
  onRefresh,
}) {
  const [groupBy, setGroupBy] = useState("category");
  const [copying, setCopying] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const linkedColorIds = assignments.map((a) => a.product_color_id);
  const linkedVariations = variations.filter((v) =>
    linkedColorIds.includes(v.product_color_id)
  );

  const getGroupKey = (v) => {
    const color = colorVariants.find((cv) => cv.id === v.product_color_id);
    const product = products.find((p) => p.id === color?.product_id);
    if (groupBy === "category") return product?.category || "Uncategorized";
    if (groupBy === "sub_category")
      return product?.sub_category || "Uncategorized";
    if (groupBy === "product") return product?.name || "Uncategorized";
    return "All";
  };

  const buildGroups = () => {
    if (groupBy === "none")
      return [{ key: "all", label: null, items: linkedVariations }];
    const map = {};
    for (const v of linkedVariations) {
      const k = getGroupKey(v);
      if (!map[k]) map[k] = { key: k, label: k, items: [] };
      map[k].items.push(v);
    }
    return Object.values(map);
  };

  const handleCopyVariation = async (variation) => {
    setCopying(variation.id);
    const sequence = String(parseInt(variation.sequence || "0", 10) + 1).padStart(
      4,
      "0"
    );
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

  const handleEditField = async (variationId, fieldName, newValue) => {
    try {
      await base44.entities.ProductColorAndMore.update(variationId, {
        [fieldName]: newValue,
      });
      onRefresh?.();
    } catch (error) {
      console.error("Edit failed:", error);
    }
  };

  const handleLinkVariations = async (colorIds) => {
    await Promise.all(
      colorIds.map((colorId) =>
        base44.entities.ProjectAssignment.create({
          project_id: projectId,
          product_color_id: colorId,
          product_id: colorVariants.find((cv) => cv.id === colorId)?.product_id,
        })
      )
    );
    onRefresh?.();
  };

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
                <img
                  src={product.images[0]}
                  alt={product?.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <span className="font-medium text-sm">{product?.name || "—"}</span>
          </div>
        );
      },
    },
    {
      id: "category",
      label: "Category",
      width: 120,
      sortKey: (v) => {
        const color = colorVariants.find((cv) => cv.id === v.product_color_id);
        const product = products.find((p) => p.id === color?.product_id);
        return product?.category || "";
      },
      render: (v) => {
        const color = colorVariants.find((cv) => cv.id === v.product_color_id);
        const product = products.find((p) => p.id === color?.product_id);
        return (
          <span className="text-sm text-muted-foreground">
            {product?.category || "—"}
          </span>
        );
      },
    },
    {
      id: "sub_category",
      label: "Sub-Category",
      width: 120,
      sortKey: (v) => {
        const color = colorVariants.find((cv) => cv.id === v.product_color_id);
        const product = products.find((p) => p.id === color?.product_id);
        return product?.sub_category || "";
      },
      render: (v) => {
        const color = colorVariants.find((cv) => cv.id === v.product_color_id);
        const product = products.find((p) => p.id === color?.product_id);
        return (
          <span className="text-sm text-muted-foreground">
            {product?.sub_category || "—"}
          </span>
        );
      },
    },
    {
      id: "colorway",
      label: "Colorway",
      width: 120,
      sortKey: (v) => {
        const color = colorVariants.find((cv) => cv.id === v.product_color_id);
        return color?.color_name || "";
      },
      render: (v) => {
        const color = colorVariants.find((cv) => cv.id === v.product_color_id);
        return (
          <span className="text-sm text-muted-foreground">
            {color?.color_name || "—"}
          </span>
        );
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
      label: "Seq.",
      width: 80,
      sortKey: (v) => v.sequence || "",
      render: (v) => (
        <span className="text-sm text-muted-foreground">{v.sequence || "—"}</span>
      ),
    },
    {
      id: "sizes",
      label: "Sizes",
      width: 150,
      render: (v) => {
        const sizeIds = v.size_ids || [];
        return (
          <span className="text-xs text-muted-foreground">
            {sizeIds.length} size{sizeIds.length !== 1 ? "s" : ""}
          </span>
        );
      },
    },
    {
      id: "pack_code",
      label: "Pack Code",
      width: 100,
      sortKey: (v) => v.pack_code || "",
      render: (v) => (
        <span className="text-sm text-muted-foreground">{v.pack_code || "—"}</span>
      ),
    },
    {
      id: "actions",
      label: "Actions",
      width: 120,
      render: (v) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopyVariation(v)}
            disabled={copying === v.id}
            className="gap-1.5 h-7 text-xs"
          >
            {copying === v.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            Copy
          </Button>
        </div>
      ),
    },
  ];

  const renderContent = () => (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Group by</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-input bg-transparent cursor-pointer"
          >
            <option value="none">None</option>
            <option value="category">Category</option>
            <option value="sub_category">Sub-Category</option>
            <option value="product">Product</option>
          </select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowLinkModal(true)}
          className="gap-2 h-8 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Variations
        </Button>
      </div>

      {linkedVariations.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No planned variations yet. Link product variations to start.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {buildGroups().map((group) => {
            const itemCount = group.items.length;
            return (
              <div key={group.key} className="bg-card rounded-xl border border-border overflow-hidden">
                {group.label && (
                  <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.label} ({itemCount})
                    </span>
                  </div>
                )}
                <DataTable
                  columns={columns}
                  rows={group.items}
                  fixedColumns={["style"]}
                  filterFields={[
                    {
                      getValue: (v) => {
                        const color = colorVariants.find(
                          (cv) => cv.id === v.product_color_id
                        );
                        return color?.color_name || "";
                      },
                    },
                    { getValue: (v) => v.name },
                  ]}
                  onEdit={handleEditField}
                />
              </div>
            );
          })}
        </div>
      )}

      <LinkProductVariationsModal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onLink={handleLinkVariations}
        alreadyLinkedIds={linkedColorIds}
      />
    </>
  );

  return <div className="space-y-4">{renderContent()}</div>;
}