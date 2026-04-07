import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Image, Type, Square, Link2, Download, Trash2 } from "lucide-react";

const tools = [
  { id: "select", label: "Select", icon: null, cursor: "default" },
];

export default function Ribbon({ onInsert, onExportPdf, selectedElement, onDeleteElement }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border-b border-border bg-card shrink-0">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Insert & Tools</span>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
        >
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>
      {!collapsed && (
        <div className="flex items-center gap-1 px-3 py-2 flex-wrap">
          {/* Insert group */}
          <span className="text-[10px] font-semibold text-muted-foreground mr-1">INSERT</span>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => onInsert("image")}>
            <Image className="w-3.5 h-3.5" /> Image
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => onInsert("text")}>
            <Type className="w-3.5 h-3.5" /> Text
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => onInsert("rect")}>
            <Square className="w-3.5 h-3.5" /> Shape
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => onInsert("product_card")}>
            <Link2 className="w-3.5 h-3.5" /> Product Card
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          {/* Actions */}
          {selectedElement && (
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10" onClick={onDeleteElement}>
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          )}
          <div className="ml-auto">
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={onExportPdf}>
              <Download className="w-3.5 h-3.5" /> Export PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}