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

function MatrixCell({ junctionRecord, config }) {
  if (!junctionRecord) {
    return (
      <div className="p-3 bg-muted/30 border border-border rounded-lg aspect-square flex items-center justify-center">
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-card border border-border rounded-lg aspect-square overflow-y-auto">
      <div className="text-[11px] space-y-1.5">
        {(config.junction_fields || []).map(field => (
          <p key={field} className="truncate">{junctionRecord[field] || "—"}</p>
        ))}
      </div>
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

      // Fetch junction records and build lookup
      const junctionData = await base44.entities[config.junction_entity].list("-created_date", 1000);
      const map = {};
      junctionData.forEach(record => {
        const key = `${record[config.row_fk_field]}_${record[config.column_fk_field]}`;
        if (!map[key]) map[key] = record;
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
      {/* Column header - fixed */}
      <div className="flex border-b border-border shrink-0">
        <div className="w-32 shrink-0" />
        <div className="overflow-x-auto flex-1" ref={headerRef} onScroll={() => { if (dataRef.current) dataRef.current.scrollLeft = headerRef.current.scrollLeft; }}>
          <div className="flex">
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

      {/* Data rows - scrollable */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-32 shrink-0 overflow-y-auto border-r border-border bg-muted/10">
          {rows.map(row => (
            <div key={row.id} className="w-32 p-3 border-b border-border">
              <ItemCell 
                item={row} 
                fields={config.row_fields && config.row_fields.length > 0 ? config.row_fields : undefined}
                size={config.thumbnail_size}
              />
            </div>
          ))}
        </div>
        <div ref={dataRef} onScroll={() => { if (headerRef.current) headerRef.current.scrollLeft = dataRef.current.scrollLeft; }} className="overflow-x-auto overflow-y-auto flex-1">
          {rows.map(row => (
            <div key={`data-${row.id}`} className="flex border-b border-border last:border-b-0">
              {columns.map(col => {
                const key = `${row.id}_${col.id}`;
                const junction = junctionMap[key];
                return (
                  <div key={`${row.id}_${col.id}`} className="w-32 shrink-0 p-3 border-r border-border last:border-r-0">
                    <MatrixCell 
                      junctionRecord={junction}
                      config={config}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}