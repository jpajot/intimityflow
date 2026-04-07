import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import Ribbon from "../components/board/Ribbon";
import PagesPanel from "../components/board/PagesPanel";
import CanvasStage, { CANVAS_W, CANVAS_H } from "../components/board/CanvasStage";
import BoardContextMenu from "../components/board/BoardContextMenu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function BoardEditor() {
  const { projectId, boardId } = useParams();
  const navigate = useNavigate();

  const [board, setBoard] = useState(null);
  const [pages, setPages] = useState([]);
  const [activePageId, setActivePageId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [contextMenu, setContextMenu] = useState(null); // { x, y, element }
  const [linkDialog, setLinkDialog] = useState(null); // { elementId }
  const [products, setProducts] = useState([]);
  const [colorways, setColorways] = useState([]);
  const [linkEntityType, setLinkEntityType] = useState("Product");
  const [linkEntityId, setLinkEntityId] = useState("");

  const saveTimer = useRef(null);

  useEffect(() => {
    load();
  }, [boardId]);

  const load = async () => {
    setLoading(true);
    const [boardRes, pagesRes, prods, cws] = await Promise.all([
      base44.entities.Board.filter({ id: boardId }),
      base44.entities.BoardPage.filter({ board_id: boardId }),
      base44.entities.Product.list("name", 500),
      base44.entities.ProductColor.list("-created_date", 500),
    ]);
    setBoard(boardRes[0] || null);
    setProducts(prods);
    setColorways(cws);

    let sorted = pagesRes.sort((a, b) => a.page_number - b.page_number);
    if (sorted.length === 0) {
      // Create first page
      const p = await base44.entities.BoardPage.create({
        board_id: boardId,
        page_number: 1,
        name: "Slide 1",
        elements: [],
      });
      sorted = [p];
    }
    setPages(sorted);
    setActivePageId(sorted[0].id);
    setLoading(false);
  };

  const activePage = pages.find((p) => p.id === activePageId);
  const elements = activePage?.elements || [];

  const updateElements = useCallback((newEls) => {
    setPages((prev) =>
      prev.map((p) => (p.id === activePageId ? { ...p, elements: newEls } : p))
    );
    // Debounced save
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await base44.entities.BoardPage.update(activePageId, { elements: newEls });
    }, 800);
  }, [activePageId]);

  const handleInsert = (type) => {
    const defaults = {
      image: { width: 280, height: 200, content: "" },
      text: { width: 240, height: 80, content: "Text block" },
      rect: { width: 200, height: 120, style: { fill: "hsl(210,20%,95%)", borderColor: "hsl(210,20%,80%)", borderWidth: 1, radius: 6 } },
      product_card: { width: 200, height: 240, content: "Product Card" },
    };
    const el = {
      id: generateId(),
      type,
      x: 80 + Math.random() * 200,
      y: 80 + Math.random() * 100,
      ...defaults[type],
    };
    updateElements([...elements, el]);
  };

  const handleAddPage = async () => {
    const num = pages.length + 1;
    const p = await base44.entities.BoardPage.create({
      board_id: boardId,
      page_number: num,
      name: `Slide ${num}`,
      elements: [],
    });
    setPages((prev) => [...prev, p]);
    setActivePageId(p.id);
  };

  const handleDeletePage = async (pageId) => {
    await base44.entities.BoardPage.delete(pageId);
    const remaining = pages.filter((p) => p.id !== pageId);
    setPages(remaining);
    if (activePageId === pageId) setActivePageId(remaining[0]?.id || null);
  };

  const handleDeleteSelected = () => {
    if (!contextMenu?.element) return;
    const id = contextMenu.element.id;
    updateElements(elements.filter((e) => e.id !== id));
    setContextMenu(null);
  };

  const handleContextMenu = (e, element) => {
    setContextMenu({ x: e.clientX, y: e.clientY, element });
  };

  const handleLinkEntity = () => {
    if (!linkDialog || !linkEntityId) return;
    const entity = linkEntityType === "Product"
      ? products.find((p) => p.id === linkEntityId)
      : colorways.find((c) => c.id === linkEntityId);
    const updates = {
      linkedEntityType: linkEntityType,
      linkedEntityId: linkEntityId,
      linkedName: linkEntityType === "Product" ? entity?.name : entity?.color_name,
      linkedCode: entity?.colorway_code || entity?.code || "",
      linkedImageUrl: linkEntityType === "Product" ? entity?.images?.[0] : entity?.image_url || "",
    };
    updateElements(elements.map((el) => el.id === linkDialog.elementId ? { ...el, ...updates } : el));
    setLinkDialog(null);
    setLinkEntityId("");
  };

  const handleEditLinked = (el) => {
    if (!el.linkedEntityId) return;
    if (el.linkedEntityType === "Product") navigate(`/products/${el.linkedEntityId}`);
    setContextMenu(null);
  };

  const handleExportPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: html2canvas } = await import("html2canvas");
    const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [CANVAS_W, CANVAS_H] });
    // Find all slide containers
    const slides = document.querySelectorAll("[data-board-slide]");
    let first = true;
    for (const slide of slides) {
      const canvas = await html2canvas(slide, { scale: 1, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      if (!first) doc.addPage();
      doc.addImage(imgData, "PNG", 0, 0, CANVAS_W, CANVAS_H);
      first = false;
    }
    doc.save(`${board?.name || "board"}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/projects/${projectId}`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <p className="text-xs text-muted-foreground">Board</p>
          <p className="text-sm font-semibold leading-tight">{board?.name || "Untitled Board"}</p>
        </div>
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-auto" />}
      </div>

      {/* Ribbon */}
      <Ribbon
        onInsert={handleInsert}
        onExportPdf={handleExportPdf}
        selectedElement={contextMenu?.element}
        onDeleteElement={handleDeleteSelected}
      />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Pages panel */}
        <PagesPanel
          pages={pages}
          activePageId={activePageId}
          onSelectPage={setActivePageId}
          onAddPage={handleAddPage}
          onDeletePage={handleDeletePage}
        />

        {/* Canvas */}
        <CanvasStage
          elements={elements}
          onUpdateElements={updateElements}
          onContextMenu={handleContextMenu}
        />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <BoardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          element={contextMenu.element}
          onClose={() => setContextMenu(null)}
          onDelete={() => {
            updateElements(elements.filter((e) => e.id !== contextMenu.element.id));
            setContextMenu(null);
          }}
          onLink={() => { setLinkDialog({ elementId: contextMenu.element.id }); setContextMenu(null); }}
          onEditLinked={() => handleEditLinked(contextMenu.element)}
          onCreateProduct={async () => {
            navigate(`/products/new?from_board=${boardId}&element_id=${contextMenu.element.id}`);
            setContextMenu(null);
          }}
        />
      )}

      {/* Link entity dialog */}
      <Dialog open={!!linkDialog} onOpenChange={(o) => { if (!o) setLinkDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Link to Entity</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Entity Type</Label>
              <Select value={linkEntityType} onValueChange={(v) => { setLinkEntityType(v); setLinkEntityId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Product">Product / Style</SelectItem>
                  <SelectItem value="ProductColor">Colorway</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{linkEntityType === "Product" ? "Product" : "Colorway"}</Label>
              <Select value={linkEntityId} onValueChange={setLinkEntityId}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {(linkEntityType === "Product" ? products : colorways).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {linkEntityType === "Product" ? e.name : `${e.color_name}${e.colorway_code ? ` (${e.colorway_code})` : ""}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleLinkEntity} disabled={!linkEntityId} className="flex-1">Link</Button>
              <Button variant="outline" onClick={() => setLinkDialog(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}