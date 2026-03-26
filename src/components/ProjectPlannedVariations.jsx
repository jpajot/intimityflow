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
  const [copying, setCopying] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [packCodes, setPackCodes] = useState([]);
  const [variants, setVariants] = useState([]);

  useState(() => {
    base44.entities.TypeOfLOV.filter({ code: "Pack" }).then((lovTypes) => {
      if (lovTypes.length > 0) {
        base44.entities.ListOfValues.filter({ type_of_lov_id: lovTypes[0].id }).then((lovValues) => {
          setPackCodes(lovValues.map((v) => v.name));
        });
      }
    });
    base44.entities.TypeOfLOV.filter({ code: "Variant" }).then((lovTypes) => {
      if (lovTypes.length > 0) {
        base44.entities.ListOfValues.filter({ type_of_lov_id: lovTypes[0].id }).then((lovValues) => {
          setVariants(lovValues.map((v) => v.name));
        });
      }
    });
  }, []);

  const linkedColorIds = assignments.map((a) => a.product_color_id);
  const linkedVariations = variations.filter((v) =>
    linkedColorIds.includes(v.product_color_id)
  );



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
      width: 140,
      sortKey: (v) => v.name || "",
      render: (v) => (
        <div className="flex items-center gap-2">
          {v.color_hex && (
            <div className="w-4 h-4 rounded-sm border border-border shrink-0" style={{ backgroundColor: v.color_hex }} />
          )}
          <span className="text-sm text-muted-foreground">{v.name || "—"}</span>
        </div>
      ),
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
      editable: true,
      options: packCodes,
      entityField: "pack_code",
      entityType: "ProductColorAndMore",
      getValue: (v) => v.id,
      getDisplayValue: (v) => v.pack_code || "",
    },
    {
      id: "variant",
      label: "Variant",
      width: 90,
      sortKey: (v) => v.variant || "",
      render: (v) => (
        <span className="text-sm text-muted-foreground">{v.variant || "—"}</span>
      ),
      editable: true,
      options: variants,
      entityField: "variant",
      entityType: "ProductColorAndMore",
      getValue: (v) => v.id,
      getDisplayValue: (v) => v.variant || "",
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
      <div className="flex items-center justify-end">
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
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <DataTable
            columns={columns}
            rows={linkedVariations}
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