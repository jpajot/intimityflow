import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Trash2, FileText, Upload, Search, Palette, SwatchBook, Layers, Pin, PinOff, Info, Zap, LayoutGrid, List } from "lucide-react";
import StylesIcon from "../components/icons/StylesIcon";
import { getPinnedItems, setPinnedItems } from "../components/Layout";
import PresenceIndicator from "../components/PresenceIndicator";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import LinkedColorwaysView from "../components/LinkedColorwaysView";
import LinkedColorwaysManager from "../components/LinkedColorwaysManager";
import LinkedStylesView from "../components/LinkedStylesView";
import ProjectBoards from "./ProjectBoards";
import BoardIcon from "../components/icons/BoardIcon";
import LinkedMoreVariationsView from "../components/LinkedMoreVariationsView";
import { useRegisterSubNav } from "../hooks/useRegisterSubNav";
import ProjectPalettesTab from "../components/ProjectPalettesTab";
import DCperCOTTab from "../components/DCperCOTTab";
import DCperCOTIcon from "../components/icons/DCperCOTIcon";
import ViewDrawerContent from "../components/ViewDrawerContent";
import { usePageOptions } from "@/lib/PageOptionsContext";
import { Download, Upload as UploadIcon, Pencil, Plus } from "lucide-react";

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

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

  const [activeSection, setActiveSection] = useState(() => location.state?.section || "details");
  const [cwSearch, setCwSearch] = useState("");
  const stylesViewRef = useRef(null);
  const colorwaysViewRef = useRef(null);
  const variationsViewRef = useRef(null);

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [file, setFile] = useState(null);
  const [docSearch, setDocSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [pinnedItems, setPinnedItemsState] = useState(() => getPinnedItems());
  const [showStylesViewMenu, setShowStylesViewMenu] = useState(false);
  const [stylesActiveViewId, setStylesActiveViewId] = useState("default");
  const [stylesViewMode, setStylesViewMode] = useState("grid");
  const [showColorwaysViewMenu, setShowColorwaysViewMenu] = useState(false);
  const [colorwaysActiveViewId, setColorwaysActiveViewId] = useState("default");
  const [colorwaysViewMode, setColorwaysViewMode] = useState("grid");
  const [showVariationsViewMenu, setShowVariationsViewMenu] = useState(false);
  const [variationsActiveViewId, setVariationsActiveViewId] = useState("default");
  const [variationsViewMode, setVariationsViewMode] = useState("grid");
  const [showDCViewMenu, setShowDCViewMenu] = useState(false);
  const [dcActiveViewId, setDCActiveViewId] = useState("default");
  const [dcViewMode, setDCViewMode] = useState("list");

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

  const subNavItems = [
  { id: "details", label: "Details", icon: Info },
  { id: "boards", label: "Boards", icon: BoardIcon },
  { id: "documents", label: "Documents", count: documents.length, icon: FileText },
  { id: "styles", label: "Products", count: linkedStyles.length, icon: StylesIcon },
  { id: "colorways", label: "Colorways", count: linkedColorways.length, icon: Palette },
  { id: "variations", label: "Variations", count: linkedVariations.length, icon: Layers },
  { id: "dc_per_cot", label: "DC per CoT", icon: DCperCOTIcon },
  { id: "palettes", label: "Color Palettes", count: palettes.length, icon: SwatchBook }];

  useRegisterSubNav(subNavItems, activeSection, setActiveSection, project?.name);

  const { setOptions } = usePageOptions();

  useEffect(() => {
    if (activeSection === "styles") {
      setOptions({
        items: [
        { label: stylesViewMode === "list" ? "View: Grid" : "View: List", icon: stylesViewMode === "list" ? LayoutGrid : List, onClick: () => {
            setStylesViewMode((prev) => {
              const next = prev === "list" ? "grid" : "list";
              stylesViewRef.current?.setView(next);
              return next;
            });
          } },
        { divider: true },
        { label: "Manage Views", icon: Pencil, onClick: () => setShowStylesViewMenu(!showStylesViewMenu), custom: true }],

        customContent: showStylesViewMenu ?
        <ViewDrawerContent pageKey="project_linked_styles" activeViewId={stylesActiveViewId} onSelectView={setStylesActiveViewId} currentViewType={stylesViewMode} allFields={[
        { id: "image", label: "Image" },
        { id: "code", label: "Code" },
        { id: "name", label: "Name" },
        { id: "type", label: "Type" },
        { id: "sub_type", label: "Sub-type" },
        { id: "category", label: "Category" },
        { id: "sub_category", label: "Sub-Category" },
        { id: "customer_need", label: "Customer Need" },
        { id: "size_grid", label: "Size Grid" },
        { id: "creation_project", label: "Creation Project" },
        { id: "linked_projects", label: "Linked Projects" },
        { id: "created_by", label: "Created By" }]
        } /> :
        null
      });
    } else if (activeSection === "colorways") {
      setOptions({
        items: [
        { label: colorwaysViewMode === "list" ? "View: Grid" : "View: List", icon: colorwaysViewMode === "list" ? LayoutGrid : List, onClick: () => {
            setColorwaysViewMode((prev) => {
              const next = prev === "list" ? "grid" : "list";
              colorwaysViewRef.current?.setView(next);
              return next;
            });
          } },
        { divider: true },
        { label: "Manage Views", icon: Pencil, onClick: () => setShowColorwaysViewMenu(!showColorwaysViewMenu), custom: true }],

        customContent: showColorwaysViewMenu ?
        <ViewDrawerContent pageKey="project_linked_colorways" activeViewId={colorwaysActiveViewId} onSelectView={setColorwaysActiveViewId} currentViewType={colorwaysViewMode} allFields={[
        { id: "style_image", label: "Style" },
        { id: "style_name", label: "Style Name" },
        { id: "cw_image", label: "Colorway" },
        { id: "style_sub_type", label: "Style: Sub-type" },
        { id: "color_name", label: "Color Name" },
        { id: "comm_code", label: "Commercial Code" },
        { id: "comm_color_status", label: "Commercial Color" },
        { id: "tech_code", label: "Technical Code" },
        { id: "link_forecasted_qty", label: "Fcst. Qty" },
        { id: "link_channels", label: "Channels of Trade" },
        { id: "link_status", label: "Project Status" },
        { id: "link_notes", label: "Project Notes" }]
        } /> :
        null
      });
    } else if (activeSection === "variations") {
      setOptions({
        items: [
        { label: "Add Variation", icon: Plus, onClick: () => window.dispatchEvent(new Event("addVariation")) },
        { divider: true },
        { label: variationsViewMode === "list" ? "View: Grid" : "View: List", icon: variationsViewMode === "list" ? LayoutGrid : List, onClick: () => {
            setVariationsViewMode((prev) => {
              const next = prev === "list" ? "grid" : "list";
              variationsViewRef.current?.setView(next);
              return next;
            });
          } },
        { divider: true },
        { label: "Manage Views", icon: Pencil, onClick: () => setShowVariationsViewMenu(!showVariationsViewMenu), custom: true }],

        customContent: showVariationsViewMenu ?
        <ViewDrawerContent pageKey="project_linked_variations" activeViewId={variationsActiveViewId} onSelectView={setVariationsActiveViewId} currentViewType={variationsViewMode} allFields={[
        { id: "style_image", label: "Style Image" },
        { id: "style_name", label: "Style Name" },
        { id: "cw_image", label: "Colorway" },
        { id: "style_sub_type", label: "Style: Sub-type" },
        { id: "cw_color_name", label: "Colorway Name" },
        { id: "cw_code", label: "Colorway Code" },
        { id: "sequence", label: "Seq." },
        { id: "name", label: "Variation Name" },
        { id: "pack_code", label: "Pack Code" },
        { id: "variant", label: "Variant" },
        { id: "creation_project", label: "Creation Project" },
        { id: "linked_projects", label: "Linked Projects" },
        { id: "link_forecasted_qty", label: "Fcst. Qty" },
        { id: "link_channels", label: "Channels of Trade" },
        { id: "link_dist_channels", label: "Distribution Channels" },
        { id: "link_status", label: "Project Status" },
        { id: "link_notes", label: "Project Notes" }]
        } /> :
        null
      });
    } else if (activeSection === "dc_per_cot") {
      setOptions({
        items: [
        { label: "Generate DC per CoT", icon: Zap, onClick: () => window.dcPerCOTGenerate?.() },
        { label: "Export", icon: Download, onClick: () => window.dcPerCOTExport?.() },
        { label: "Import", icon: UploadIcon, onClick: () => window.dcPerCOTImport?.() },
        { divider: true },
        { label: dcViewMode === "list" ? "View: Grid" : "View: List", icon: dcViewMode === "list" ? LayoutGrid : List, onClick: () => {
            setDCViewMode((prev) => {
              const next = prev === "list" ? "grid" : "list";
              window.dcPerCOTView?.setView(next);
              return next;
            });
          } },
        { divider: true },
        { label: "Manage Views", icon: Pencil, onClick: () => setShowDCViewMenu(!showDCViewMenu), custom: true }],

        customContent: showDCViewMenu ?
        <ViewDrawerContent pageKey="dc_per_cot" activeViewId={dcActiveViewId} onSelectView={setDCActiveViewId} allFields={[]} currentViewType={dcViewMode} /> :
        null
      });
    } else {
      setOptions({ items: [] });
    }
  }, [activeSection, setOptions, showStylesViewMenu, showColorwaysViewMenu, showVariationsViewMenu, showDCViewMenu, stylesActiveViewId, colorwaysActiveViewId, variationsActiveViewId, dcActiveViewId, stylesViewMode, colorwaysViewMode, variationsViewMode, dcViewMode]);

  const SEASONS = ["SS25", "FW25", "SS26", "FW26", "Evergreen"];
  const STATUSES = ["Planning", "Active", "Archived"];
  const PROJECT_TYPES = ["Seasonal Collection", "Artist Collaboration", "Capsule", "Limited Edition", "Core Range", "Other"];

  useEffect(() => {
    loadData();
  }, [id]);

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  const loadData = async () => {
    setLoading(true);

    // Batch 1: project-specific data (lightweight)
    const [proj, pals, docs, lovTypes] = await Promise.all([
    base44.entities.Project.filter({ id }),
    base44.entities.ColorPalette.filter({ project_id: id }),
    base44.entities.UploadedDocument.filter({ project_id: id }),
    base44.entities.TypeOfLOV.filter({ code: "DocumentType" })]
    );
    setProject(proj[0] || null);
    setPalettes(pals);
    setDocuments(docs.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date)));

    await delay(100);

    // Batch 2: reference data + doc types
    const [projs, sgs, docValues] = await Promise.all([
    base44.entities.Project.list("name", 500),
    base44.entities.SizeGrid.list("name", 200),
    lovTypes.length > 0 ?
    base44.entities.ListOfValues.filter({ type_of_lov_id: lovTypes[0].id }) :
    Promise.resolve([])]
    );
    setAllProjects(projs);
    setSizeGrids(sgs);
    setDocTypes(docValues.map((v) => v.name));

    await delay(100);

    // Batch 3: color library data
    const [tc, cc, palCols] = await Promise.all([
    base44.entities.TechnicalColor.list("code", 2000),
    base44.entities.CommercialColor.list("code", 2000),
    base44.entities.ColorPaletteColor.list("-created_date", 2000)]
    );
    setTechColors(tc);
    setCommColors(cc);
    setPaletteColors(palCols);

    await delay(100);

    // Batch 4: product/colorway data
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
        status: "processing"
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
    <div className="px-2 py-2 space-y-4">
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

      {activeSection === "details" &&
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-5 space-y-4">
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
      </div>
      }

      {activeSection === "boards" && <ProjectBoards projectId={id} />}

      {activeSection === "palettes" &&
      <ProjectPalettesTab
        projectId={id}
        projectName={project.name}
        palettes={palettes}
        setPalettes={setPalettes}
        paletteColors={paletteColors}
        setPaletteColors={setPaletteColors}
        techColors={techColors}
        setTechColors={setTechColors}
        commColors={commColors}
        setCommColors={setCommColors} />

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
      <LinkedColorwaysManager
        colorways={linkedColorways}
        products={linkedProducts}
        techColors={techColors}
        commColors={commColors}
        navigate={navigate}
        search={cwSearch}
        onSearchChange={setCwSearch}
        projectId={id}
        allColorways={allColorways}
        onLinked={loadData}
        onViewRef={(state) => {colorwaysViewRef.current = state;}}
        activeViewId={colorwaysActiveViewId}
        onSelectView={setColorwaysActiveViewId} />

      }

      {activeSection === "styles" &&
      <LinkedStylesView styles={linkedStyles} navigate={navigate} projects={allProjects} sizeGrids={sizeGrids} projectId={id} allStyles={allStyleProducts} allColorways={allColorways} allVariations={allVariations} onLinked={loadData} onViewRef={(state) => {stylesViewRef.current = state;}} activeViewId={stylesActiveViewId} onSelectView={setStylesActiveViewId} />
      }
      {activeSection === "variations" &&
      <LinkedMoreVariationsView variations={linkedVariations} colorways={allColorways} products={allStyleProducts} projects={allProjects} navigate={navigate} projectId={id} allVariations={allVariations} onLinked={loadData} onViewRef={(state) => {variationsViewRef.current = state;}} activeViewId={variationsActiveViewId} onSelectView={setVariationsActiveViewId} />
      }
      {activeSection === "dc_per_cot" &&
      <DCperCOTTab projectId={id} linkedVariations={linkedVariations} allVariations={allVariations} colorways={allColorways} products={allStyleProducts} techColors={techColors} commColors={commColors} onGenerateRef={(handler) => {window.dcPerCOTGenerate = handler;}} onExportRef={(handler) => {window.dcPerCOTExport = handler;}} onImportRef={(handler) => {window.dcPerCOTImport = handler;}} onViewRef={(viewState) => {window.dcPerCOTView = viewState;}} activeViewId={dcActiveViewId} onSelectView={setDCActiveViewId} />
      }

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