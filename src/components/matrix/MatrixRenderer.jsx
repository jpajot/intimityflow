import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

const SIZE_CLASSES = {
  sm: "w-16 h-16",
  md: "w-20 h-20",
  lg: "w-24 h-24",
};

function ItemCell({ item, fields, size }) {
  const sizeClass = SIZE_CLASSES[size || "md"];
  const imageUrl = item.images?.[0] || item.image_url || item.hex;
  
  const hasImage = imageUrl && (imageUrl.startsWith("#") || imageUrl.startsWith("hsl") || !imageUrl.includes("://") || imageUrl.includes("://"));
  
  return (
    <div className="space-y-2 text-xs h-full flex flex-col">
      {hasImage && (
        <div className="max-w-12 max-h-12 rounded-md overflow-hidden border border-border bg-muted/20 flex items-center justify-center shrink-0">
          {imageUrl?.startsWith("#") || imageUrl?.startsWith("hsl") ? (
            <div className="w-12 h-12" style={{ backgroundColor: imageUrl }} />
          ) : (
            <img src={imageUrl} alt={item.name || item.color_name} className="max-w-full max-h-full object-contain" />
          )}
        </div>
      )}
      {fields && fields.length > 0 && (
        <div className="space-y-0.5 overflow-y-auto flex-1">
          {fields.map(field => (
            <p key={field} className="truncate text-foreground text-xs">{item[field] || "—"}</p>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_COLORS = {
  active: "bg-green-100 text-green-800",
  approved: "bg-green-100 text-green-800",
  confirmed: "bg-blue-100 text-blue-800",
  pending: "bg-yellow-100 text-yellow-800",
  draft: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-100 text-red-700",
  archived: "bg-slate-100 text-slate-500",
};

function getStatusColor(val) {
  if (!val) return "bg-muted text-muted-foreground";
  return STATUS_COLORS[val.toLowerCase()] || "bg-primary/10 text-primary";
}

function JunctionCard({ record, config, linkData }) {
  const imageUrl = record.image_url || record.images?.[0];
  const colorHex = record.color_hex || record.hex;
  const hasImage = imageUrl && !imageUrl.startsWith("#") && !imageUrl.startsWith("hsl");
  const hasColor = colorHex;
  const title = record.color_name || record.name || record.colorway_code;
  const junctionFields = config.junction_fields || [];
  const linkFields = config.junction_link_fields || [];

  return (
    <div className="group flex flex-col bg-card border border-border rounded-lg overflow-hidden hover:border-primary/40 hover:shadow-md transition-all cursor-default">
      {/* Image / color swatch header */}
      {(hasImage || hasColor) && (
        <div className="relative w-full h-16 bg-muted/30 overflow-hidden flex-shrink-0">
          {hasImage ? (
            <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ backgroundColor: colorHex }} />
          )}
        </div>
      )}

      <div className="p-2 space-y-1.5 flex-1">
        {/* Title */}
        {title && (
          <p className="text-[10px] font-semibold text-foreground truncate leading-tight">{title}</p>
        )}

        {/* Junction fields */}
        {junctionFields.filter(f => f !== "color_name" && f !== "name" && f !== "image_url" && f !== "color_hex").map(field => {
          const val = record[field];
          if (val == null || val === "") return null;
          const display = Array.isArray(val) ? val.join(", ") : String(val);
          return (
            <p key={field} className="text-[9px] text-foreground truncate">{display}</p>
          );
        })}

        {/* Link overlay fields (project-specific) */}
        {linkData && linkFields.length > 0 && (
          <div className="pt-1 mt-1 border-t border-border/40 flex flex-wrap gap-1">
            {linkFields.map(field => {
              const val = linkData[field];
              if (val == null || val === "") return null;
              const display = Array.isArray(val) ? val.join(", ") : String(val);
              // Render status-like fields as colored badges
              const isStatus = field === "status" || field.endsWith("_status");
              if (isStatus) {
                return (
                  <span key={field} className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${getStatusColor(display)}`}>{display}</span>
                );
              }
              // Render numeric fields
              const isNumeric = typeof val === "number";
              if (isNumeric) {
                return <span key={field} className="text-[9px] font-medium text-foreground">{display}</span>;
              }
              return <p key={field} className="text-[9px] text-foreground truncate w-full">{display}</p>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MatrixCell({ junctionRecords, config, linkMap = {} }) {
  const records = Array.isArray(junctionRecords) ? junctionRecords : (junctionRecords ? [junctionRecords] : []);

  if (records.length === 0) {
    return (
      <div className="h-full min-h-[40px] flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-border" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 py-1 w-full">
      {records.map((record, idx) => (
        <JunctionCard
          key={idx}
          record={record}
          config={config}
          linkData={linkMap[record.id] || null}
        />
      ))}
    </div>
  );
}

export default function MatrixRenderer({ config, projectId }) {
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [junctionMap, setJunctionMap] = useState({});
  const [linkMap, setLinkMap] = useState({});
  const [loading, setLoading] = useState(true);
  const headerRef = useRef(null);
  const dataRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [config, projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch rows
      const rowData = await base44.entities[config.row_entity].list("name", 500);
      setRows(rowData);

      // Fetch columns
      const colData = await base44.entities[config.column_entity].list("name", 500);
      setColumns(colData);

      // Fetch junction records and build lookup (support 1-to-many)
      const junctionData = await base44.entities[config.junction_entity].list("-created_date", 5000);
      const map = {};
      junctionData.forEach(record => {
        const key = `${record[config.row_fk_field]}_${record[config.column_fk_field]}`;
        if (!map[key]) map[key] = [];
        map[key].push(record);
      });
      setJunctionMap(map);

      // Fetch ProductColorProjectLink overlay data if applicable
      if (config.junction_entity === "ProductColor" && projectId && base44.entities.ProductColorProjectLink) {
        const links = await base44.entities.ProductColorProjectLink.filter({ project_id: projectId });
        const lMap = {};
        links.forEach(l => { lMap[l.product_color_id] = l; });
        setLinkMap(lMap);
      } else {
        setLinkMap({});
      }
    } catch (err) {
      console.error("Failed to load matrix data:", err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background rounded-lg border border-border">
      {/* Column header - scrolls horizontally, synced with data */}
      <div className="border-b border-border shrink-0 overflow-hidden">
        <div className="overflow-x-auto" ref={headerRef} onScroll={() => { if (dataRef.current) dataRef.current.scrollLeft = headerRef.current.scrollLeft; }}>
          <div className="flex">
            <div className="sticky left-0 z-40 w-32 shrink-0 p-3 bg-muted/40 border-r border-border" />
            {columns.map(col => {
              const colW = config.cell_display_size === "compact" ? "w-28" : config.cell_display_size === "large" ? "w-44" : "w-36";
              return (
                <div key={col.id} className={`${colW} shrink-0 px-1.5 py-2 bg-muted/40 border-r border-border`}>
                  <ItemCell
                    item={col}
                    fields={config.column_fields && config.column_fields.length > 0 ? config.column_fields : undefined}
                    size={config.thumbnail_size}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Data area - scrollable both horizontally and vertically */}
      <div ref={dataRef} onScroll={() => { if (headerRef.current) headerRef.current.scrollLeft = dataRef.current.scrollLeft; }} className="overflow-x-auto overflow-y-auto flex-1">
        {rows.map(row => (
          <div key={row.id} className="flex border-b border-border last:border-b-0">
            <div className="sticky left-0 z-30 w-32 shrink-0 p-3 bg-muted/20 border-r border-border">
              <ItemCell 
                item={row} 
                fields={config.row_fields && config.row_fields.length > 0 ? config.row_fields : undefined}
                size={config.thumbnail_size}
              />
            </div>
            {columns.map(col => {
              const key = `${row.id}_${col.id}`;
              const junctionRecords = junctionMap[key] || [];
              const cellW = config.cell_display_size === "compact" ? "w-28" : config.cell_display_size === "large" ? "w-44" : "w-36";
              return (
                <div key={`${row.id}_${col.id}`} className={`${cellW} shrink-0 px-1.5 py-1 border-r border-border last:border-r-0 align-top`}>
                  <MatrixCell
                    junctionRecords={junctionRecords}
                    config={config}
                    linkMap={linkMap}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}