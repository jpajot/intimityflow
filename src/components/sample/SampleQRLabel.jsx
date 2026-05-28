import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function SampleQRLabel({ sample, product, color, variation, size }) {
  const printRef = useRef(null);

  const contextParts = [
    product?.code,
    color?.colorway_code,
    variation?.name,
    size?.name,
  ].filter(Boolean).join(" · ");

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank", "width=400,height=400");
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sample Label — ${sample.code}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: white; }
          .label { text-align: center; padding: 16px; display: inline-flex; flex-direction: column; align-items: center; gap: 8px; border: 1px solid #e2e8f0; border-radius: 6px; }
          .code { font-size: 16px; font-weight: bold; letter-spacing: 0.05em; }
          .context { font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="label">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${printRef.current.querySelector("svg")?.innerHTML || ""}</svg>
          <div class="code">${sample.code}</div>
          ${contextParts ? `<div class="context">${contextParts}</div>` : ""}
        </div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Label card */}
      <div
        ref={printRef}
        className="flex flex-col items-center gap-2 p-4 border border-border rounded-xl bg-white shadow-sm"
      >
        <QRCodeSVG
          value={sample.qr_code_data || sample.code}
          size={120}
          level="M"
          includeMargin={false}
        />
        <span className="font-mono text-sm font-bold tracking-wider">{sample.code}</span>
        {contextParts && (
          <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[140px]">
            {contextParts}
          </span>
        )}
      </div>

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 text-xs h-7"
        onClick={handlePrint}
      >
        <Printer className="w-3 h-3" />
        Print label
      </Button>
    </div>
  );
}