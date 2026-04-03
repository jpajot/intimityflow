import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, ArrowLeft, Loader2, Check, AlertCircle, ChevronDown, ChevronRight, RefreshCw, X } from "lucide-react";
import DataTable from "../components/DataTable";
import ViewSelector from "../components/ViewSelector";

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
                <img src={row.image_url} alt={row["Style Description"]} className="w-full h-full object-contain" />
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
  const [search, setSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState(null);
  const [editingRow, setEditingRow] = useState(null);

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

  // Flatten all rows with slide info for table display
  const allRows = useMemo(() => {
    const rows = [];
    (data?.slides || []).forEach((slide, slideIdx) => {
      (slide.table?.rows || []).forEach((row, rowIdx) => {
        rows.push({
          id: `${slideIdx}-${rowIdx}`,
          slideNumber: slide.slideNumber,
          slideIdx,
          rowIdx,
          ...row,
        });
      });
    });
    return rows;
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.toLowerCase();
    return allRows.filter((row) =>
      row["Style Description"]?.toLowerCase().includes(q) ||
      (row["Style Technical Color Codes"] || []).some((code) => code.toLowerCase().includes(q))
    );
  }, [allRows, search]);

  const columns = [
    {
      id: "slide",
      label: "Slide",
      width: 70,
      sortKey: (r) => r.slideNumber || 0,
      render: (r) => <span className="font-mono text-sm">{r.slideNumber}</span>,
    },
    {
      id: "style_name",
      label: "Style Name",
      width: 180,
      sortKey: (r) => r["Style Description"] || "",
      render: (r) => <span className="font-medium">{r["Style Description"] || "—"}</span>,
    },
    {
      id: "image",
      label: "Image",
      width: 80,
      render: (r) =>
        r.image_url ? (
          <div className="w-10 h-10 rounded-md overflow-hidden border border-border">
            <img src={r.image_url} alt={r["Style Description"]} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-md border border-border bg-muted" />
        ),
    },
    {
      id: "colors",
      label: "Technical Colors",
      width: 280,
      render: (r) => {
        const codes = r["Style Technical Color Codes"] || [];
        return (
          <div className="flex flex-wrap gap-1">
            {codes.map((code, i) => {
              const tc = techColors.find((t) => t.code?.toLowerCase().trim() === code?.toLowerCase().trim());
              return (
                <div key={i} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm border border-border" style={{ backgroundColor: tc?.hex || "#eee" }} title={code} />
                  <span className={`text-xs font-mono ${tc ? "text-foreground" : "text-amber-600"}`}>{code}</span>
                  {!tc && <span className="text-xs text-amber-600">⚠</span>}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => {
                const updated = [...codes, ""];
                handleRowChange(r.slideIdx, r.rowIdx, { ...r, "Style Technical Color Codes": updated });
              }}
              className="text-xs text-primary hover:underline"
            >
              +
            </button>
          </div>
        );
      },
    },
    {
      id: "edit",
      label: "",
      width: 50,
      render: (r) => (
        <button
          type="button"
          onClick={() => setEditingRow(editingRow === r.id ? null : r.id)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ✏️
        </button>
      ),
    },
    {
      id: "create",
      label: "",
      width: 50,
      render: (r) => (
        <button
          type="button"
          onClick={() => createStyleFromRow(r)}
          className="text-xs text-primary hover:underline font-medium"
        >
          Create
        </button>
      ),
    },
  ];

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
            images: row.image_url ? [row.image_url] : [],
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

  const createStyleFromRow = async (row) => {
    const styleName = row["Style Description"];
    if (!styleName) return;
    try {
      const product = await base44.entities.Product.create({
        type: "Product",
        name: styleName,
        category: "",
        sub_category: "",
        customer_need: "",
        images: row.image_url ? [row.image_url] : [],
      });

      for (const code of (row["Style Technical Color Codes"] || [])) {
        const tc = techColors.find((t) => t.code?.toLowerCase().trim() === code?.toLowerCase().trim());
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
      setResult({ success: true, count: 1 });
    } catch (err) {
      setResult({ success: false, error: err.message });
    }
  };

  // Render edit panel for selected row
  const renderEditPanel = () => {
    if (!editingRow) return null;
    const row = allRows.find((r) => r.id === editingRow);
    if (!row) return null;
    const codes = row["Style Technical Color Codes"] || [];

    return (
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Editing: {row["Style Description"]}</h3>
          <button type="button" onClick={() => setEditingRow(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        {row.image_url && (
          <div className="space-y-1.5">
            <Label className="text-xs">Style Image</Label>
            <div className="w-32 h-32 rounded-lg overflow-hidden border border-border bg-muted">
              <img src={row.image_url} alt={row["Style Description"]} className="w-full h-full object-contain" />
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Style Name</Label>
          <Input
            value={row["Style Description"] || ""}
            onChange={(e) => handleRowChange(row.slideIdx, row.rowIdx, { ...row, "Style Description": e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Pantone TCX Codes</Label>
          <div className="space-y-2">
            {codes.map((code, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={code}
                  onChange={(e) => {
                    const updated = codes.map((c, ci) => ci === i ? e.target.value : c);
                    handleRowChange(row.slideIdx, row.rowIdx, { ...row, "Style Technical Color Codes": updated });
                  }}
                  className="h-7 text-xs font-mono flex-1"
                  placeholder="e.g. 19-1862 TCX"
                />
                <TcxBadge code={code} techColors={techColors} />
                <button
                  type="button"
                  onClick={() => {
                    const updated = codes.filter((_, ci) => ci !== i);
                    handleRowChange(row.slideIdx, row.rowIdx, { ...row, "Style Technical Color Codes": updated });
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => {
                const updated = [...codes, ""];
                handleRowChange(row.slideIdx, row.rowIdx, { ...row, "Style Technical Color Codes": updated });
              }}
            >
              + Add color code
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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

      {/* Stats Bar */}
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

      {/* Toolbar */}
      {data && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search styles…"
              className="pl-8 h-9 text-xs"
            />
          </div>
          {filteredRows.length > 0 && <ViewSelector pageKey="document_staging" allColumns={columns} onColumnsChange={setVisibleColumns} />}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleReparse} disabled={reparsing || isProcessed} className="gap-1.5 shrink-0">
            {reparsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Re-parse
          </Button>
          <Button onClick={handleProcess} disabled={processing || isProcessed || !data} className="gap-2 shrink-0">
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isProcessed ? "Already Processed" : "Create Styles"}
          </Button>
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

      {data && (
        <>
          {renderEditPanel()}
          {filteredRows.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">{allRows.length === 0 ? "No styles found." : "No results match your search."}</p>
            </div>
          ) : (
            <DataTable columns={visibleColumns || columns} rows={filteredRows} hideColumnToggle />
          )}
        </>
      )}

      {/* Results message */}
      {result && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background border border-border rounded-lg p-4 shadow-lg">
          {result.success ? (
            <>
              <Check className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-700">{result.count} style{result.count !== 1 ? "s" : ""} created.</p>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-destructive" />
              <p className="text-sm text-destructive">{result.error}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}