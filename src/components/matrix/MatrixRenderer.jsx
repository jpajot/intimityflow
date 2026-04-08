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

function MatrixCell({ junctionRecords, config }) {
  const records = Array.isArray(junctionRecords) ? junctionRecords : (junctionRecords ? [junctionRecords] : []);
  const sizeClass = config.cell_display_size === "compact" ? "w-24 h-24" : config.cell_display_size === "large" ? "w-40 h-40" : "w-32 h-32";
  
  if (records.length === 0) {
    return (
      <div className={`${sizeClass} p-2 bg-muted/30 border border-border rounded-lg flex items-center justify-center`}>
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    );
  }

  return (
    <div className={`${sizeClass} flex flex-col gap-1 overflow-y-auto`}>
      {records.map((record, idx) => {
        const imageUrl = record.image_url || record.images?.[0];
        const hasImage = imageUrl && !imageUrl.startsWith("#") && !imageUrl.startsWith("hsl");
        
        return (
          <div key={idx} className="p-2 bg-card border border-border rounded text-[10px] space-y-1 flex-shrink-0">
            {hasImage && (
              <div className="w-full h-12 rounded overflow-hidden border border-border bg-muted/20 flex items-center justify-center mb-1">
                <img src={imageUrl} alt={record.color_name || record.name} className="max-w-full max-h-full object-contain" />
              </div>
            )}
            <div className="space-y-0.5">
              {(config.junction_fields || []).map(field => (
                <p key={field} className="truncate text-foreground">{record[field] || "—"}</p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MatrixRenderer({ config, projectId }) {
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [junctionMap, setJunctionMap] = useState({});
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
            {columns.map(col => (
              <div key={col.id} className="w-32 shrink-0 p-3 bg-muted/40 border-r border-border">
                <ItemCell 
                  item={col} 
                  fields={config.column_fields && config.column_fields.length > 0 ? config.column_fields : undefined}
                  size={config.thumbnail_size}
                />
              </div>
            ))}
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
              const sizeClass = config.cell_display_size === "compact" ? "w-28" : config.cell_display_size === "large" ? "w-44" : "w-36";
              return (
                <div key={`${row.id}_${col.id}`} className={`${sizeClass} shrink-0 p-2 border-r border-border last:border-r-0`}>
                  <MatrixCell 
                    junctionRecords={junctionRecords}
                    config={config}
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