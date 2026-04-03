import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Check, AlertCircle, ChevronDown, ChevronRight, RefreshCw, X } from "lucide-react";

function TcxBadge({ code, techColors }) {
  const tc = techColors.find(t => t.code?.toLowerCase().trim() === code?.toLowerCase().trim());
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-4 h-4 rounded-sm border border-border shrink-0" style={{ backgroundColor: tc?.hex || "#eee" }} />
      <span className={`text-xs font-mono ${tc ? "text-foreground" : "text-amber-600"}`}>{code}</span>
      {tc
        ? <span className="text-xs text-muted-foreground">{tc.name}</span>
        : <span className="text-xs text-amber-600 flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> Not in library</span>
      }
    </div>
  );
}

function StyleRow({ row, techColors, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const codes = row["Style Technical Color Codes"] || [];

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        <span className="font-medium text-sm flex-1">{row["Style Description"] || "—"}</span>
        <div className="flex items-center gap-1">
          {codes.map((code, i) => {
            const tc = techColors.find(t => t.code?.toLowerCase().trim() === code?.toLowerCase().trim());
            return <div key={i} className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: tc?.hex || "#eee" }} title={code} />;
          })}
          <span className="text-xs text-muted-foreground ml-1">{codes.length} color{codes.length !== 1 ? "s" : ""}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3 bg-muted/20 border-t border-border space-y-4">
          {row.image_url && (
            <div className="space-y-1.5">
              <Label className="text-xs">Style Image</Label>
              <div className="w-32 h-32 rounded-lg overflow-hidden border border-border bg-muted">
                <img src={row.image_url} alt={row["Style Description"]} className="w-full h-full object-cover" />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Style Name</Label>
            <Input
              value={row["Style Description"] || ""}
              onChange={e => onChange({ ...row, "Style Description": e.target.value })}
              className="h-8 text-sm max-w-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Pantone TCX Codes</Label>
            <div className="space-y-2">
              {codes.map((code, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={code}
                    onChange={e => {
                      const updated = codes.map((c, ci) => ci === i ? e.target.value : c);
                      onChange({ ...row, "Style Technical Color Codes": updated });
                    }}
                    className="h-7 text-xs font-mono w-40"
                    placeholder="e.g. 19-1862 TCX"
                  />
                  <TcxBadge code={code} techColors={techColors} />
                  <button type="button" onClick={() => {
                    const updated = codes.filter((_, ci) => ci !== i);
                    onChange({ ...row, "Style Technical Color Codes": updated });
                  }} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => onChange({ ...row, "Style Technical Color Codes": [...codes, ""] })}
              >
                + Add color code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentStaging() {
  const { id, docId } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [techColors, setTechColors] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { loadData(); }, [docId]);

  const loadData = async () => {
    setLoading(true);
    const [docs, tc] = await Promise.all([
      base44.entities.UploadedDocument.filter({ id: docId }),
      base44.entities.TechnicalColor.list("code", 2000),
    ]);
    const d = docs[0];
    setDoc(d);
    setTechColors(tc);
    if (d?.staged_data) setData(JSON.parse(JSON.stringify(d.staged_data)));
    setLoading(false);
  };

  const handleRowChange = (slideIdx, rowIdx, updated) => {
    setData(prev => {
      const slides = prev.slides.map((slide, si) =>
        si !== slideIdx ? slide : {
          ...slide,
          table: { ...slide.table, rows: slide.table.rows.map((row, ri) => ri === rowIdx ? updated : row) }
        }
      );
      return { ...prev, slides };
    });
  };

  const handleReparse = async () => {
    setReparsing(true);
    try {
      await base44.functions.invoke("parseDocument", { document_id: docId });
      await loadData();
    } catch (err) {
      setResult({ success: false, error: err.message || "Failed to parse document" });
    }
    setReparsing(false);
  };

  const handleProcess = async () => {
    setProcessing(true);
    setResult(null);
    try {
      await base44.entities.UploadedDocument.update(docId, { staged_data: data });
      const createdProductIds = [];

      for (const slide of (data.slides || [])) {
        const rows = slide.table?.rows || [];
        for (const row of rows) {
          const styleName = row["Style Description"];
          if (!styleName) continue;

          const product = await base44.entities.Product.create({
            type: "Product",
            name: styleName,
            category: "",
            sub_category: "",
            customer_need: "",
          });
          createdProductIds.push(product.id);

          for (const code of (row["Style Technical Color Codes"] || [])) {
            const tc = techColors.find(t => t.code?.toLowerCase().trim() === code?.toLowerCase().trim());
            await base44.entities.ProductColor.create({
              product_id: product.id,
              color_name: tc?.name || code,
              colorway_code: code,
              color_hex: tc?.hex || "",
              linked_tech_color_id: tc?.id || "",
              linked_color_type: "",
              linked_color_id: "",
            });
          }
        }
      }

      await base44.entities.UploadedDocument.update(docId, {
        status: "processed",
        processed_product_ids: createdProductIds,
      });
      setDoc(prev => ({ ...prev, status: "processed" }));
      setResult({ success: true, count: createdProductIds.length });
    } catch (err) {
      setResult({ success: false, error: err.message });
    }
    setProcessing(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (!doc) return <div className="text-center py-32 text-muted-foreground">Document not found.</div>;

  const allCodes = (data?.slides || []).flatMap(s => s.table?.rows || []).flatMap(r => r["Style Technical Color Codes"] || []);
  const unmatchedCount = allCodes.filter(code => !techColors.find(t => t.code?.toLowerCase().trim() === code?.toLowerCase().trim())).length;
  const totalStyles = (data?.slides || []).reduce((sum, s) => sum + (s.table?.rows?.length || 0), 0);
  const isProcessed = doc.status === "processed";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${id}/documents`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{doc.document_type} · {doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : ""}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight truncate">{doc.original_filename || "Document"}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleReparse} disabled={reparsing || isProcessed} className="gap-1.5 shrink-0">
          {reparsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Re-parse
        </Button>
      </div>

      {data && (
        <div className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 flex-wrap">
          <div className="text-center">
            <p className="text-2xl font-semibold">{data.slides?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Slides</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-2xl font-semibold">{totalStyles}</p>
            <p className="text-xs text-muted-foreground">Styles</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-2xl font-semibold">{allCodes.length}</p>
            <p className="text-xs text-muted-foreground">Colorways</p>
          </div>
          {unmatchedCount > 0 && (
            <>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="text-2xl font-semibold text-amber-600">{unmatchedCount}</p>
                <p className="text-xs text-amber-600">Unmatched TCX</p>
              </div>
            </>
          )}
          <div className="flex-1" />
          {data.collection && <Badge variant="outline" className="font-mono text-xs">{data.collection}</Badge>}
          <Badge variant={isProcessed ? "default" : "secondary"} className="text-xs">
            {isProcessed ? "Processed" : "Staged"}
          </Badge>
        </div>
      )}

      {!data && (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {doc.status === "processing" ? "Parsing in progress…"
              : doc.status === "error" ? (doc.error_message || "Parsing error")
              : "No data extracted yet."}
          </p>
          {(doc.status === "uploaded" || doc.status === "error") && (
            <Button variant="outline" size="sm" onClick={handleReparse} className="mt-3 gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Parse Now
            </Button>
          )}
        </div>
      )}

      {(data?.slides || []).map((slide, slideIdx) => (
        <div key={slideIdx} className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">Slide {slide.slideNumber}</Badge>
            <h2 className="font-semibold text-base">{slide.title}</h2>
            <span className="text-xs text-muted-foreground">({slide.table?.rows?.length || 0} style{(slide.table?.rows?.length || 0) !== 1 ? "s" : ""})</span>
          </div>
          <div className="space-y-2">
            {(slide.table?.rows || []).map((row, rowIdx) => (
              <StyleRow key={rowIdx} row={row} techColors={techColors} onChange={updated => handleRowChange(slideIdx, rowIdx, updated)} />
            ))}
          </div>
        </div>
      ))}

      {data && (
        <div className="sticky bottom-4 flex items-center gap-3 bg-background/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-lg">
          {result?.success && (
            <p className="text-sm text-green-700 flex items-center gap-1.5">
              <Check className="w-4 h-4" /> {result.count} style{result.count !== 1 ? "s" : ""} created.
            </p>
          )}
          {result?.error && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {result.error}
            </p>
          )}
          {unmatchedCount > 0 && !isProcessed && !result && (
            <p className="text-xs text-amber-600">{unmatchedCount} TCX code{unmatchedCount !== 1 ? "s" : ""} not in library.</p>
          )}
          <div className="flex-1" />
          <Button onClick={handleProcess} disabled={processing || isProcessed || !data} className="gap-2 shrink-0">
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isProcessed ? "Already Processed" : "Create Styles & Colorways"}
          </Button>
        </div>
      )}
    </div>
  );
}