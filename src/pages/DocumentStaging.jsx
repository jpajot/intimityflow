import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, ArrowLeft, Loader2, Check, AlertCircle, RefreshCw, X, ArrowRight } from "lucide-react";
import DataTable from "../components/DataTable";
import ViewSelector from "../components/ViewSelector";

// ── helpers ──────────────────────────────────────────────────────────────────
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

// ── Diff field row ────────────────────────────────────────────────────────────
function DiffRow({ label, current, incoming, isImage }) {
  const changed = current !== incoming;
  if (!changed) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-start gap-2">
        <div className="flex-1 bg-destructive/5 border border-destructive/20 rounded p-2 text-xs">
          {isImage && current ? <img src={current} className="w-20 h-20 object-contain" alt="current" /> : (current || "—")}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
        <div className="flex-1 bg-green-50 border border-green-200 rounded p-2 text-xs">
          {isImage && incoming ? <img src={incoming} className="w-20 h-20 object-contain" alt="incoming" /> : (incoming || "—")}
        </div>
      </div>
    </div>
  );
}

// ── Update-diff modal ─────────────────────────────────────────────────────────
function UpdateDiffModal({ open, onClose, onConfirm, existingProduct, parsedRow, saving }) {
  if (!open || !existingProduct) return null;
  const incomingImage = parsedRow?.image_url || "";
  const incomingName = parsedRow?.["Style Description"] || "";
  const currentImage = existingProduct.images?.[0] || "";
  const currentName = existingProduct.name || "";

  const imageDiffers = incomingImage && incomingImage !== currentImage;
  const nameDiffers = incomingName && incomingName !== currentName;
  const hasDiffs = imageDiffers || nameDiffers;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Style already exists</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Style code <span className="font-mono font-semibold">{existingProduct.code}</span> is already in the database
          as <span className="font-semibold">{existingProduct.name}</span>.
        </p>
        {hasDiffs ? (
          <div className="space-y-3 mt-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fields that will be updated</p>
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground font-medium">
              <span>Field</span><span>Current (DB)</span><span>Incoming (parsed)</span>
            </div>
            {nameDiffers && (
              <div className="grid grid-cols-3 gap-2 items-start">
                <span className="text-xs font-medium pt-1">Name</span>
                <div className="bg-muted rounded p-2 text-xs text-muted-foreground line-through">{currentName || "—"}</div>
                <div className="bg-green-50 border border-green-200 rounded p-2 text-xs font-medium text-green-800">
                  {incomingName}
                  <div className="text-[10px] font-normal text-amber-600 mt-0.5 no-underline">was: {currentName || "—"}</div>
                </div>
              </div>
            )}
            {imageDiffers && (
              <div className="grid grid-cols-3 gap-2 items-start">
                <span className="text-xs font-medium pt-1">Image</span>
                <div className="bg-muted rounded p-2">
                  {currentImage ? <img src={currentImage} className="w-16 h-16 object-contain" alt="current" /> : <span className="text-xs text-muted-foreground">No image</span>}
                </div>
                <div className="bg-green-50 border border-green-200 rounded p-2">
                  <img src={incomingImage} className="w-16 h-16 object-contain" alt="incoming" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-green-700 flex items-center gap-1.5 mt-2">
            <Check className="w-4 h-4" /> Name and image are identical — only new colorways will be added.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={onConfirm} disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {hasDiffs ? "Update & continue" : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function DocumentStaging() {
  const { id, docId } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [techColors, setTechColors] = useState([]);
  const [existingProducts, setExistingProducts] = useState([]); // all products with a code
  const [existingColorways, setExistingColorways] = useState([]); // all colorways for those products
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [createdRowIds, setCreatedRowIds] = useState(new Set()); // id → "created" | "updated"

  // diff-modal state
  const [diffModal, setDiffModal] = useState(null); // { row, existingProduct }
  const [diffSaving, setDiffSaving] = useState(false);

  useEffect(() => { loadData(); }, [docId]);

  const loadData = async () => {
    setLoading(true);
    const [docs, tc, prods, colors] = await Promise.all([
      base44.entities.UploadedDocument.filter({ id: docId }),
      base44.entities.TechnicalColor.list("code", 2000),
      base44.entities.Product.list("-created_date", 2000),
      base44.entities.ProductColor.list("-created_date", 5000),
    ]);
    const d = docs[0];
    setDoc(d);
    setTechColors(tc);
    setExistingProducts(prods.filter(p => p.code));
    setExistingColorways(colors);
    if (d?.staged_data) setData(JSON.parse(JSON.stringify(d.staged_data)));
    setLoading(false);
  };

  // lookup helpers
  const findExistingProduct = (styleCode) => {
    if (!styleCode) return null;
    return existingProducts.find(p => p.code?.toLowerCase().trim() === styleCode?.toLowerCase().trim()) || null;
  };

  const tcxAlreadyOnProduct = (productId, tcxCode) => {
    return existingColorways.some(cw =>
      cw.product_id === productId &&
      (cw.colorway_code?.toLowerCase().trim() === tcxCode?.toLowerCase().trim() ||
        techColors.find(t => t.id === cw.linked_tech_color_id)?.code?.toLowerCase().trim() === tcxCode?.toLowerCase().trim())
    );
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

  // flatten rows
  const allRows = useMemo(() => {
    const rows = [];
    (data?.slides || []).forEach((slide, slideIdx) => {
      (slide.table?.rows || []).forEach((row, rowIdx) => {
        rows.push({ id: `${slideIdx}-${rowIdx}`, slideNumber: slide.slideNumber, slideIdx, rowIdx, ...row });
      });
    });
    return rows;
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.toLowerCase();
    return allRows.filter((row) =>
      row["Style Code"]?.toLowerCase().includes(q) ||
      row["Style Description"]?.toLowerCase().includes(q) ||
      (row["Style Technical Color Codes"] || []).some((code) => code.toLowerCase().includes(q))
    );
  }, [allRows, search]);

  // ── core create/update logic ────────────────────────────────────────────────
  const applyRowToDatabase = async (row, existingProduct) => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const styleName = row["Style Description"];
    const styleCode = row["Style Code"] || "";

    let product;
    if (existingProduct) {
      // update only changed fields
      const updates = {};
      const incomingImage = row.image_url || "";
      if (incomingImage && incomingImage !== (existingProduct.images?.[0] || "")) {
        updates.images = [incomingImage];
      }
      if (styleName && styleName !== existingProduct.name) {
        updates.name = styleName;
      }
      // ensure project link
      const projectIds = existingProduct.project_ids || [];
      if (!projectIds.includes(id)) updates.project_ids = [...projectIds, id];
      if (Object.keys(updates).length > 0) {
        await base44.entities.Product.update(existingProduct.id, updates);
      }
      product = { ...existingProduct, ...updates };
    } else {
      let autoCode = styleCode;
      if (!autoCode) {
        try {
          const res = await base44.functions.invoke("generateCode", { entity_name: "Product", entity_type: "Product" });
          autoCode = res.data?.code || "";
        } catch (_) {}
      }
      await sleep(300);
      product = await base44.entities.Product.create({
        type: "Product",
        name: styleName,
        code: autoCode,
        category: "",
        sub_category: "",
        customer_need: "",
        description: "",
        images: row.image_url ? [row.image_url] : [],
        creation_project_id: id,
        project_ids: [id],
      });
    }

    // colorways
    for (const colorCode of (row["Style Technical Color Codes"] || [])) {
      if (tcxAlreadyOnProduct(product.id, colorCode)) continue; // skip duplicates
      const tc = techColors.find(t => t.code?.toLowerCase().trim() === colorCode?.toLowerCase().trim());
      await base44.entities.ProductColor.create({
        product_id: product.id,
        color_name: tc?.name || colorCode,
        colorway_code: colorCode,
        color_hex: tc?.hex || "",
        linked_tech_color_id: tc?.id || "",
        linked_color_type: "",
        linked_color_id: "",
        creation_project_id: id,
        project_ids: [id],
      });
      await sleep(200);
    }
    return product;
  };

  const createStyleFromRow = async (row) => {
    const styleName = row["Style Description"];
    if (!styleName) return;

    const codes = row["Style Technical Color Codes"] || [];
    const unmatchedCodes = codes.filter(code => !techColors.find(t => t.code?.toLowerCase().trim() === code?.toLowerCase().trim()));
    if (unmatchedCodes.length > 0) {
      setResult({ success: false, error: `Cannot create: unmatched TCX code(s): ${unmatchedCodes.join(", ")}` });
      return;
    }

    const existing = findExistingProduct(row["Style Code"]);
    if (existing) {
      // show diff modal first
      setDiffModal({ row, existingProduct: existing });
      return;
    }

    // no existing product → create directly
    const product = await applyRowToDatabase(row, null);
    setExistingProducts(prev => [...prev, product]);
    setCreatedRowIds(prev => new Set([...prev, row.id]));
    setResult({ success: true, count: 1, action: "created" });
  };

  const confirmDiffUpdate = async () => {
    if (!diffModal) return;
    setDiffSaving(true);
    const product = await applyRowToDatabase(diffModal.row, diffModal.existingProduct);
    setExistingProducts(prev => prev.map(p => p.id === product.id ? product : p));
    // refresh colorways so green checkmarks update
    const freshColorways = await base44.entities.ProductColor.list("-created_date", 5000);
    setExistingColorways(freshColorways);
    setCreatedRowIds(prev => new Set([...prev, diffModal.row.id]));
    setResult({ success: true, count: 1, action: "updated" });
    setDiffSaving(false);
    setDiffModal(null);
  };

  // ── bulk process all ────────────────────────────────────────────────────────
  const handleProcess = async () => {
    setProcessing(true);
    setResult(null);
    try {
      await base44.entities.UploadedDocument.update(docId, { staged_data: data });
      const processedIds = [];
      for (const slide of (data.slides || [])) {
        for (const row of (slide.table?.rows || [])) {
          if (!row["Style Description"]) continue;
          const existing = findExistingProduct(row["Style Code"]);
          const product = await applyRowToDatabase(row, existing || null);
          processedIds.push(product.id);
        }
      }
      await base44.entities.UploadedDocument.update(docId, { status: "processed", processed_product_ids: processedIds });
      setDoc(prev => ({ ...prev, status: "processed" }));
      setResult({ success: true, count: processedIds.length, action: "processed" });
    } catch (err) {
      setResult({ success: false, error: err.message });
    }
    setProcessing(false);
  };

  // ── columns ─────────────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      id: "slide",
      label: "Slide",
      width: 60,
      sortKey: (r) => r.slideNumber || 0,
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.slideNumber}</span>,
    },
    {
      id: "style_code",
      label: "Style Code",
      width: 120,
      sortKey: (r) => r["Style Code"] || "",
      render: (r) => {
        const code = r["Style Code"];
        const existing = findExistingProduct(code);
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-semibold">{code || "—"}</span>
            {existing && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-300">exists</Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "style_name",
      label: "Style Name",
      width: 180,
      sortKey: (r) => r["Style Description"] || "",
      render: (r) => <span className="font-medium text-sm">{r["Style Description"] || "—"}</span>,
    },
    {
      id: "image",
      label: "Image",
      width: 70,
      render: (r) => r.image_url ? (
        <div className="w-10 h-10 rounded-md overflow-hidden border border-border">
          <img src={r.image_url} alt={r["Style Description"]} className="w-full h-full object-contain" />
        </div>
      ) : <div className="w-10 h-10 rounded-md border border-border bg-muted" />,
    },
    {
      id: "colors",
      label: "Technical Colors",
      width: 280,
      render: (r) => {
        const codes = r["Style Technical Color Codes"] || [];
        const existing = findExistingProduct(r["Style Code"]);
        return (
          <div className="flex flex-wrap gap-1">
            {codes.map((code, i) => {
              const tc = techColors.find((t) => t.code?.toLowerCase().trim() === code?.toLowerCase().trim());
              const alreadyLinked = existing && tcxAlreadyOnProduct(existing.id, code);
              return (
                <div key={i} className="flex items-center gap-1">
                  {alreadyLinked ? (
                    <Check className="w-3 h-3 text-green-600" title="Already on style" />
                  ) : (
                    <div className="w-3 h-3 rounded-sm border border-border" style={{ backgroundColor: tc?.hex || "#eee" }} title={code} />
                  )}
                  <span className={`text-xs font-mono ${alreadyLinked ? "text-green-700" : tc ? "text-foreground" : "text-amber-600"}`}>{code}</span>
                  {!tc && !alreadyLinked && <span className="text-xs text-amber-600">⚠</span>}
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      id: "edit",
      label: "",
      width: 40,
      render: (r) => (
        <button type="button" onClick={() => setEditingRow(editingRow === r.id ? null : r.id)} className="text-sm text-muted-foreground hover:text-foreground">
          ✏️
        </button>
      ),
    },
    {
      id: "create",
      label: "",
      width: 90,
      render: (r) => {
        const done = createdRowIds.has(r.id);
        const existing = findExistingProduct(r["Style Code"]);
        if (done) {
          return (
            <div className="flex items-center gap-1 text-green-600">
              <Check className="w-4 h-4" />
              <span className="text-xs font-medium">{existing ? "Updated" : "Created"}</span>
            </div>
          );
        }
        return (
          <button type="button" onClick={() => createStyleFromRow(r)} className="text-xs text-primary hover:underline font-medium">
            {existing ? "Update" : "Create"}
          </button>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [techColors, existingProducts, existingColorways, editingRow, createdRowIds]);

  // ── edit panel ───────────────────────────────────────────────────────────────
  const renderEditPanel = () => {
    if (!editingRow) return null;
    const row = allRows.find((r) => r.id === editingRow);
    if (!row) return null;
    const codes = row["Style Technical Color Codes"] || [];
    return (
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Editing: {row["Style Description"]}</h3>
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
          <Label className="text-xs">Style Code</Label>
          <Input value={row["Style Code"] || ""} onChange={(e) => handleRowChange(row.slideIdx, row.rowIdx, { ...row, "Style Code": e.target.value })} className="h-8 text-xs font-mono max-w-xs" placeholder="e.g. STY00001" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Style Name</Label>
          <Input value={row["Style Description"] || ""} onChange={(e) => handleRowChange(row.slideIdx, row.rowIdx, { ...row, "Style Description": e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Pantone TCX Codes</Label>
          <div className="space-y-2">
            {codes.map((code, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={code} onChange={(e) => { const updated = codes.map((c, ci) => ci === i ? e.target.value : c); handleRowChange(row.slideIdx, row.rowIdx, { ...row, "Style Technical Color Codes": updated }); }} className="h-7 text-xs font-mono flex-1" placeholder="e.g. 19-1862 TCX" />
                <TcxBadge code={code} techColors={techColors} />
                <button type="button" onClick={() => { const updated = codes.filter((_, ci) => ci !== i); handleRowChange(row.slideIdx, row.rowIdx, { ...row, "Style Technical Color Codes": updated }); }} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => { const updated = [...codes, ""]; handleRowChange(row.slideIdx, row.rowIdx, { ...row, "Style Technical Color Codes": updated }); }}>
              + Add color code
            </button>
          </div>
        </div>
      </div>
    );
  };

  const existingCount = useMemo(
    () => allRows.filter(r => r["Style Code"] && findExistingProduct(r["Style Code"])).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRows, existingProducts]
  );

  // ── render ───────────────────────────────────────────────────────────────────
  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!doc) return <div className="text-center py-32 text-muted-foreground">Document not found.</div>;

  const allCodes = (data?.slides || []).flatMap(s => s.table?.rows || []).flatMap(r => r["Style Technical Color Codes"] || []);
  const unmatchedCount = allCodes.filter(code => !techColors.find(t => t.code?.toLowerCase().trim() === code?.toLowerCase().trim())).length;
  const totalStyles = (data?.slides || []).reduce((sum, s) => sum + (s.table?.rows?.length || 0), 0);
  const isProcessed = doc.status === "processed";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${id}?tab=documents`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{doc.document_type} · {doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : ""}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight truncate">{doc.original_filename || "Document"}</h1>
        </div>
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
          {existingCount > 0 && (
            <>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="text-2xl font-semibold text-amber-600">{existingCount}</p>
                <p className="text-xs text-amber-600">Already exist</p>
              </div>
            </>
          )}
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
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code, name, color…" className="pl-8 h-9 text-xs" />
          </div>
          {filteredRows.length > 0 && <ViewSelector pageKey="document_staging" allColumns={columns} onColumnsChange={setVisibleColumns} />}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleReparse} disabled={reparsing || isProcessed} className="gap-1.5 shrink-0">
            {reparsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Re-parse
          </Button>
          <Button onClick={handleProcess} disabled={processing || isProcessed || !data} className="gap-2 shrink-0">
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isProcessed ? "Already Processed" : "Create All Styles"}
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

      {/* Diff / Update modal */}
      <UpdateDiffModal
        open={!!diffModal}
        onClose={() => setDiffModal(null)}
        onConfirm={confirmDiffUpdate}
        existingProduct={diffModal?.existingProduct}
        parsedRow={diffModal?.row}
        saving={diffSaving}
      />

      {/* Toast result */}
      {result && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background border border-border rounded-lg px-4 py-3 shadow-lg z-50">
          {result.success ? (
            <>
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-sm text-green-700">
                {result.action === "updated" ? "Style updated." : result.action === "processed" ? `${result.count} style${result.count !== 1 ? "s" : ""} processed.` : "Style created."}
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{result.error}</p>
            </>
          )}
          <button type="button" onClick={() => setResult(null)} className="ml-2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}