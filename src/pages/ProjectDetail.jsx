import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Trash2, FileText, Upload, Search, Palette, SwatchBook, Layers, ChevronDown, Shirt, Pin, PinOff } from "lucide-react";
import { getPinnedItems, setPinnedItems } from "../components/Layout";
import PresenceIndicator from "../components/PresenceIndicator";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import LinkedColorwaysView from "../components/LinkedColorwaysView";
import LinkedStylesView from "../components/LinkedStylesView";
import LinkedMoreVariationsView from "../components/LinkedMoreVariationsView";
import ItemSubNav from "../components/ItemSubNav";

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [palettes, setPalettes] = useState([]);
  const [paletteColors, setPaletteColors] = useState([]);
  const [techColors, setTechColors] = useState([]);
  const [commColors, setCommColors] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [sizeGrids, setSizeGrids] = useState([]);
  const [linkedColorways, setLinkedColorways] = useState([]);
  const [linkedProducts, setLinkedProducts] = useState([]);
  const [linkedStyles, setLinkedStyles] = useState([]);
  const [linkedVariations, setLinkedVariations] = useState([]);
  const [allColorways, setAllColorways] = useState([]);
  const [allStyleProducts, setAllStyleProducts] = useState([]);
  const [allVariations, setAllVariations] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeSection, setActiveSection] = useState("palettes");
  const [cwSearch, setCwSearch] = useState("");
  const [cwView, setCwView] = useState("grid");
  const [cwActiveColumns, setCwActiveColumns] = useState(null);

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [file, setFile] = useState(null);
  const [docSearch, setDocSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pinnedItems, setPinnedItemsState] = useState(() => getPinnedItems());

  const isPinned = pinnedItems.some((p) => p.path === `/projects/${id}`);

  const togglePin = () => {
    const current = getPinnedItems();
    let updated;
    if (current.some((p) => p.path === `/projects/${id}`)) {
      updated = current.filter((p) => p.path !== `/projects/${id}`);
    } else {
      if (current.length >= 3) return;
      updated = [...current, { path: `/projects/${id}`, label: project?.name || "Project" }];
    }
    setPinnedItems(updated);
    setPinnedItemsState(updated);
    window.dispatchEvent(new Event("pinned-items-changed"));
  };
  const autoSaveTimer = useRef(null);

  const SEASONS = ["SS25", "FW25", "SS26", "FW26", "Evergreen"];
  const STATUSES = ["Planning", "Active", "Archived"];
  const PROJECT_TYPES = ["Seasonal Collection", "Artist Collaboration", "Capsule", "Limited Edition", "Core Range", "Other"];

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    const [proj, pals, palCols, tc, cc, docs, lovTypes, projs, sgs] = await Promise.all([
    base44.entities.Project.filter({ id }),
    base44.entities.ColorPalette.filter({ project_id: id }),
    base44.entities.ColorPaletteColor.list("-created_date", 2000),
    base44.entities.TechnicalColor.list("code", 2000),
    base44.entities.CommercialColor.list("code", 2000),
    base44.entities.UploadedDocument.filter({ project_id: id }),
    base44.entities.TypeOfLOV.filter({ code: "DocumentType" }),
    base44.entities.Project.list("name", 500),
    base44.entities.SizeGrid.list("name", 200)]
    );
    setAllProjects(projs);
    setSizeGrids(sgs);
    setProject(proj[0] || null);
    setPalettes(pals);
    setPaletteColors(palCols);
    setTechColors(tc);
    setCommColors(cc);
    setDocuments(docs.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date)));

    const [allCws, allProducts, allVars] = await Promise.all([
    base44.entities.ProductColor.list("-created_date", 5000),
    base44.entities.Product.list("-created_date", 2000),
    base44.entities.ProductColorAndMore.list("-created_date", 5000)]
    );
    const linked = allCws.filter((c) => (c.project_ids || []).includes(id));
    setLinkedColorways(linked);
    setAllColorways(allCws);
    const cwProductIds = new Set(linked.map((c) => c.product_id));
    setLinkedProducts(allProducts.filter((p) => cwProductIds.has(p.id)));
    const styleProds = allProducts.filter((p) => p.type === "Product" || !p.type || p.type === "Style");
    setAllStyleProducts(styleProds);
    setLinkedStyles(styleProds.filter((p) => (p.project_ids || []).includes(id)));
    setAllVariations(allVars);
    setLinkedVariations(allVars.filter((v) => (v.project_ids || []).includes(id)));

    if (lovTypes.length > 0) {
      const values = await base44.entities.ListOfValues.filter({ type_of_lov_id: lovTypes[0].id });
      setDocTypes(values.map((v) => v.name));
    }
    setLoading(false);
  };

  const getPaletteHexes = (paletteId) => {
    return paletteColors.
    filter((pc) => pc.palette_id === paletteId).
    map((e) => {
      if (e.color_type === "technical") {
        const t = techColors.find((c) => c.id === e.color_id);
        return t?.hex || "#ccc";
      }
      const c = commColors.find((c) => c.id === e.color_id);
      const t = techColors.find((t) => t.id === c?.main_technical_color_id);
      return t?.hex || "#ccc";
    });
  };

  const handleUpload = async () => {
    if (!file || !selectedType) return;
    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      const file_url = result.file_url;
      const filename = file.name;
      const doc = await base44.entities.UploadedDocument.create({
        project_id: id,
        document_type: selectedType,
        file_url,
        original_filename: filename,
        upload_date: new Date().toISOString(),
        status: "uploaded"
      });
      setDocuments((prev) => [doc, ...prev]);
      setFile(null);
      setSelectedType("");
      setShowUploadDialog(false);

      try {
        await base44.functions.invoke("parseDocument", { document_id: doc.id });
        const updated = await base44.entities.UploadedDocument.filter({ id: doc.id });
        if (updated.length) setDocuments((prev) => prev.map((d) => d.id === doc.id ? updated[0] : d));
      } catch (parseErr) {
        await base44.entities.UploadedDocument.update(doc.id, {
          status: "error",
          error_message: parseErr.message || "Failed to parse document"
        });
        setDocuments((prev) => prev.map((d) => d.id === doc.id ? {
          ...d,
          status: "error",
          error_message: parseErr.message || "Failed to parse document"
        } : d));
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId) => {
    await base44.entities.UploadedDocument.delete(docId);
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleDeleteProject = async () => {
    await base44.entities.Project.delete(id);
    navigate("/projects");
  };



  const updateField = (field, value) => {
    setProject((p) => {
      const updated = { ...p, [field]: value };
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(async () => {
        const { id: pid, created_date, updated_date, created_by, ...data } = updated;
        await base44.entities.Project.update(pid, data);
      }, 800);
      return updated;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>);

  }

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground">Project not found</div>;
  }

  const filteredDocs = docSearch.trim() ?
  documents.filter((d) =>
  d.original_filename?.toLowerCase().includes(docSearch.toLowerCase()) ||
  d.document_type?.toLowerCase().includes(docSearch.toLowerCase()) ||
  d.collection_name?.toLowerCase().includes(docSearch.toLowerCase())
  ) :
  documents;

  return (
    <div className="mx-auto my-1 max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{project.name}</h1>
        </div>
        <PresenceIndicator entityType="Project" entityId={id} />
        <button
          type="button"
          onClick={togglePin}
          title={isPinned ? "Unpin from sidebar" : getPinnedItems().length >= 3 ? "Max 3 pinned items" : "Pin to sidebar"}
          className={`p-2 rounded-md transition-colors ${isPinned ? "text-primary hover:bg-accent" : "text-muted-foreground hover:bg-muted"} ${!isPinned && getPinnedItems().length >= 3 ? "opacity-40 cursor-not-allowed" : ""}`}>
          
          {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete Project">
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>This will delete the project. This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Project Details */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors">
          
          <span className="text-sm font-semibold">Details</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${detailsOpen ? "" : "-rotate-90"}`} />
        </button>
        {detailsOpen &&
        <div className="px-5 pb-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Name</Label>
                <Input value={project.name || ""} onChange={(e) => updateField("name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Type</Label>
                <Select value={project.type || ""} onValueChange={(v) => updateField("type", v)}>
                  <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                  <SelectContent>{PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Season</Label>
                <Select value={project.season || "none"} onValueChange={(v) => updateField("season", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select season…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {SEASONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Status</Label>
                <Select value={project.status || "Planning"} onValueChange={(v) => updateField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Description</Label>
              <Textarea value={project.description || ""} onChange={(e) => updateField("description", e.target.value)} rows={3} />
            </div>
          </div>
        }
      </div>

      {/* Sub-navigation */}
      <ItemSubNav
        items={[
        { id: "documents", label: "Documents", count: documents.length, icon: FileText },
        { id: "styles", label: "Linked Styles", count: linkedStyles.length, icon: Shirt },
        { id: "colorways", label: "Linked Colorways", count: linkedColorways.length, icon: Palette },
        { id: "variations", label: "Linked Variations", count: linkedVariations.length, icon: Layers },
        { id: "palettes", label: "Color Palettes", count: palettes.length, icon: SwatchBook }]
        }
        activeId={activeSection}
        onChange={setActiveSection}>
        
        {activeSection === "palettes" &&
        <div className="space-y-4">
            {palettes.length === 0 ?
          <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
                <p className="text-sm text-muted-foreground">No color palettes yet.</p>
              </div> :

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {palettes.map((palette) => {
              const hexes = getPaletteHexes(palette.id);
              const count = paletteColors.filter((pc) => pc.palette_id === palette.id).length;
              return (
                <button key={palette.id} onClick={() => navigate(`/color-palettes/${palette.id}`)} className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/20 transition-all text-left">
                      <div className="h-12 flex">
                        {hexes.length === 0 ?
                    <div className="flex-1 bg-muted" /> :

                    hexes.slice(0, 10).map((hex, i) => <div key={i} className="flex-1" style={{ backgroundColor: hex }} />)
                    }
                      </div>
                      <div className="px-4 py-2.5 flex items-center justify-between">
                        <span className="font-medium text-sm">{palette.name}</span>
                        <span className="text-xs text-muted-foreground">{count} color{count !== 1 ? "s" : ""}</span>
                      </div>
                    </button>);

            })}
              </div>
          }
          </div>
        }

        {activeSection === "documents" &&
        <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={docSearch} onChange={(e) => setDocSearch(e.target.value)} placeholder="Search documents…" className="pl-8 h-9" />
              </div>
              <Button size="sm" onClick={() => setShowUploadDialog(true)} className="gap-1.5 h-9">
                <Upload className="w-4 h-4" /> Upload &amp; Parse
              </Button>
            </div>
            {filteredDocs.length === 0 ?
          <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{documents.length === 0 ? "No documents yet. Upload one to get started." : "No results match your search."}</p>
              </div> :

          <div className="space-y-2">
                {filteredDocs.map((doc) =>
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.original_filename || "Document"}</p>
                      <p className="text-xs text-muted-foreground">{doc.document_type} • {doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : ""}</p>
                      {doc.collection_name && <p className="text-xs text-primary mt-0.5">{doc.collection_name}</p>}
                    </div>
                    <Badge variant={doc.status === "processed" ? "default" : doc.status === "error" ? "destructive" : "secondary"} className="text-xs shrink-0">
                      {doc.status === "processed" ? "Processed" : doc.status === "error" ? "Error" : doc.status === "processing" ? "Parsing…" : "Staged"}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => navigate(`/projects/${id}/documents-to-parse/${doc.id}`)} title="View details">→</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => handleDeleteDoc(doc.id)} title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
            )}
              </div>
          }
          </div>
        }

        {activeSection === "colorways" &&
        <LinkedColorwaysView
          colorways={linkedColorways}
          products={linkedProducts}
          techColors={techColors}
          commColors={commColors}
          navigate={navigate}
          search={cwSearch}
          onSearchChange={setCwSearch}
          view={cwView}
          onViewChange={setCwView}
          activeColumns={cwActiveColumns}
          onColumnsChange={setCwActiveColumns}
          projectId={id}
          allColorways={allColorways}
          onLinked={loadData} />

        }
        {activeSection === "styles" &&
        <LinkedStylesView styles={linkedStyles} navigate={navigate} projects={allProjects} sizeGrids={sizeGrids} projectId={id} allStyles={allStyleProducts} allColorways={allColorways} allVariations={allVariations} onLinked={loadData} />
        }
        {activeSection === "variations" &&
        <LinkedMoreVariationsView variations={linkedVariations} colorways={allColorways} products={allStyleProducts} projects={allProjects} navigate={navigate} projectId={id} allVariations={allVariations} onLinked={loadData} />
        }
      </ItemSubNav>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(o) => {if (!o) {setFile(null);setSelectedType("");}setShowUploadDialog(o);}}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload &amp; Parse Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Document Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent>
                  {docTypes.length === 0 ?
                  <SelectItem value="__none" disabled>No types configured</SelectItem> :
                  docTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Document File (PDF or PPTX)</Label>
              <label className={`flex items-center gap-2 px-3 py-2 h-9 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className="w-4 h-4 shrink-0" />
                <span className="truncate">{file ? file.name : "Choose .pdf or .pptx…"}</span>
                <input type="file" accept=".pdf,.pptx,.ppt" className="hidden" onChange={(e) => {setFile(e.target.files?.[0] || null);}} />
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleUpload} disabled={!file || !selectedType || uploading} className="gap-2 flex-1">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Uploading & Parsing…" : "Upload & Parse"}
              </Button>
              <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={uploading}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}