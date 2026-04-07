import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Image, Camera, Type, Square, Link2, Download, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function Ribbon({ onInsert, onExportPdf }) {
  const [collapsed, setCollapsed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploading(false);
    onInsert("image", { content: file_url });
    e.target.value = "";
  };

  const handleCameraCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploading(false);
    onInsert("image", { content: file_url });
    e.target.value = "";
  };

  return (
    <div className="border-b border-border bg-card shrink-0">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Insert & Tools</span>
        <button type="button" onClick={() => setCollapsed((v) => !v)} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors">
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="flex items-center gap-1 px-3 py-2 flex-wrap">
          <span className="text-[10px] font-semibold text-muted-foreground mr-1">INSERT</span>

          {/* Upload from files */}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Image className="w-3.5 h-3.5" />}
            Image
          </Button>

          {/* Camera capture */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraCapture} />
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => cameraRef.current?.click()} disabled={uploading}>
            <Camera className="w-3.5 h-3.5" /> Camera
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