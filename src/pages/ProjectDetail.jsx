import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Link2, Loader2, Trash2, LayoutList, Grid3X3, X, ExternalLink } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import GroupBySelector from "../components/GroupBySelector";
import MatrixCell from "../components/MatrixCell";
import LinkProductColorModal from "../components/LinkProductColorModal";
import ColorwayForm from "../components/ColorwayForm";
import _ from "lodash";

const MARKET_FLAGS = { Spain: "🇪🇸", France: "🇫🇷", Germany: "🇩🇪", Italy: "🇮🇹" };

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [products, setProducts] = useState([]);
  const [colorVariants, setColorVariants] = useState([]);
  const [palettes, setPalettes] = useState([]);
  const [paletteColors, setPaletteColors] = useState([]);
  const [techColors, setTechColors] = useState([]);
  const [commColors, setCommColors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showNewProductDialog, setShowNewProductDialog] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newProductSubCat, setNewProductSubCat] = useState("");
  const [newProductNeed, setNewProductNeed] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);

  // For creating a color within a newly picked product
  const [pendingProductId, setPendingProductId] = useState(null);

  const [groupBy, setGroupBy] = useState("category");
  const [rowCriteria, setRowCriteria] = useState("category");
  const [colCriteria, setColCriteria] = useState("customer_need");

  const CATEGORIES = ["Briefs", "Boxers", "Trunks", "Thongs", "Bras", "Lingerie Sets", "Shapewear", "Loungewear"];
  const SUB_CATEGORIES = ["Basic", "Sport", "Seamless", "Lace", "Cotton", "Microfiber", "Thermal", "Premium"];
  const CUSTOMER_NEEDS = ["Everyday Comfort", "Active Performance", "Fashion Forward", "Special Occasion", "Maternity", "Plus Size", "Eco-Friendly", "Budget Value"];

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    const [proj, asns, prods, colors, pals, palCols, tc, cc] = await Promise.all([
      base44.entities.Project.filter({ id }),
      base44.entities.ProjectAssignment.filter({ project_id: id }),
      base44.entities.Product.list("-created_date", 500),
      base44.entities.ProductColor.list("-created_date", 2000),
      base44.entities.ColorPalette.filter({ project_id: id }),
      base44.entities.ColorPaletteColor.list("-created_date", 2000),
      base44.entities.TechnicalColor.list("code", 2000),
      base44.entities.CommercialColor.list("code", 2000),
    ]);
    setProject(proj[0] || null);
    setAssignments(asns);
    setProducts(prods);
    setColorVariants(colors);
    setPalettes(pals);
    setPaletteColors(palCols);
    setTechColors(tc);
    setCommColors(cc);
    setLoading(false);
  };

  const getPaletteHexes = (paletteId) => {
    return paletteColors
      .filter((pc) => pc.palette_id === paletteId)
      .map((e) => {
        if (e.color_type === "technical") {
          const t = techColors.find((c) => c.id === e.color_id);
          return t?.hex || "#ccc";
        }
        const c = commColors.find((c) => c.id === e.color_id);
        const t = techColors.find((t) => t.id === c?.main_technical_color_id);
        return t?.hex || "#ccc";
      });
  };

  // Derived: only product-colors in this project
  const linkedColorIds = assignments.map((a) => a.product_color_id);
  const linkedColors = colorVariants.filter((cv) => linkedColorIds.includes(cv.id));
  const linkedProductIds = [...new Set(linkedColors.map((cv) => cv.product_id))];
  const linkedProducts = products.filter((p) => linkedProductIds.includes(p.id));

  const handleLink = async (selected) => {
    const created = await Promise.all(
      selected.map((s) =>
        base44.entities.ProjectAssignment.create({ project_id: id, product_color_id: s.product_color_id, product_id: s.product_id })
      )
    );
    setAssignments((prev) => [...prev, ...created]);
  };

  const handleUnlink = async (productColorId) => {
    const asn = assignments.find((a) => a.product_color_id === productColorId);
    if (!asn) return;
    await base44.entities.ProjectAssignment.delete(asn.id);
    setAssignments((prev) => prev.filter((a) => a.id !== asn.id));
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setCreatingProduct(true);
    const prod = await base44.entities.Product.create({
      name: newProductName,
      category: newProductCategory,
      sub_category: newProductSubCat,
      customer_need: newProductNeed,
      status: "Draft",
    });
    setProducts((prev) => [...prev, prod]);
    setPendingProductId(prod.id);
    setShowNewProductDialog(false);
    setNewProductName(""); setNewProductCategory(""); setNewProductSubCat(""); setNewProductNeed("");
    setCreatingProduct(false);
  };

  const handleAddColorToProject = async (colorData) => {
    const newColor = await base44.entities.ProductColor.create({ ...colorData, product_id: pendingProductId });
    setColorVariants((prev) => [...prev, newColor]);
    const asn = await base44.entities.ProjectAssignment.create({ project_id: id, product_color_id: newColor.id, product_id: pendingProductId });
    setAssignments((prev) => [...prev, asn]);
    setPendingProductId(null);
  };

  const handleDeleteProject = async () => {
    await Promise.all(assignments.map((a) => base44.entities.ProjectAssignment.delete(a.id)));
    await base44.entities.Project.delete(id);
    navigate("/projects");
  };

  // List view grouped
  const grouped = _.groupBy(linkedProducts, groupBy);
  const sortedKeys = Object.keys(grouped).sort();

  // Matrix view
  const rowGroups = _.groupBy(linkedProducts, rowCriteria);
  const colGroups = _.groupBy(linkedProducts, colCriteria);
  const rowKeys = Object.keys(rowGroups).sort();
  const colKeys = Object.keys(colGroups).sort();
  const getProductsAt = (rk, ck) =>
    linkedProducts.filter((p) => p[rowCriteria] === rk && p[colCriteria] === ck);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground">Project not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{project.name}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{project.type}</span>
            {project.season && <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">{project.season}</span>}
          </div>
          {project.description && <p className="text-sm text-muted-foreground mt-1">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowLinkModal(true)} className="gap-2">
            <Link2 className="w-4 h-4" /> Link Colors
          </Button>
          <Button size="sm" onClick={() => setShowNewProductDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Style
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                  <AlertDialogDescription>This will delete the project and all its assignments (styles/colors are kept).</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Color Palettes section */}
      {palettes.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Color Palettes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {palettes.map((palette) => {
              const hexes = getPaletteHexes(palette.id);
              const count = paletteColors.filter((pc) => pc.palette_id === palette.id).length;
              return (
                <Link key={palette.id} to={`/color-palettes/${palette.id}`}
                  className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/20 transition-all">
                  <div className="h-12 flex">
                    {hexes.length === 0 ? (
                      <div className="flex-1 bg-muted" />
                    ) : (
                      hexes.slice(0, 10).map((hex, i) => (
                        <div key={i} className="flex-1" style={{ backgroundColor: hex }} />
                      ))
                    )}
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="font-medium text-sm">{palette.name}</span>
                    <span className="text-xs text-muted-foreground">{count} color{count !== 1 ? "s" : ""}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending: add color to newly created product */}
      {pendingProductId && (
        <div className="bg-accent/50 border border-primary/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Add a colorway to your new style</p>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPendingProductId(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <ColorwayForm
            onSave={handleAddColorToProject}
            onCancel={() => setPendingProductId(null)}
          />
        </div>
      )}

      {/* Views */}
      <Tabs defaultValue="list">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="list" className="gap-2"><LayoutList className="w-4 h-4" />List</TabsTrigger>
            <TabsTrigger value="matrix" className="gap-2"><Grid3X3 className="w-4 h-4" />Matrix</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-0 !p-0">
            <GroupBySelector label="Group by" value={groupBy} onChange={setGroupBy} />
          </TabsContent>
          <TabsContent value="matrix" className="mt-0 !p-0">
            <div className="flex gap-4">
              <GroupBySelector label="Rows" value={rowCriteria} onChange={setRowCriteria} excludeValues={[colCriteria]} />
              <GroupBySelector label="Columns" value={colCriteria} onChange={setColCriteria} excludeValues={[rowCriteria]} />
            </div>
          </TabsContent>
        </div>

        {/* LIST VIEW */}
        <TabsContent value="list" className="mt-4 space-y-3">
          {linkedProducts.length === 0 ? (
            <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">No styles yet. Create a new style or link existing color variants.</p>
            </div>
          ) : (
            sortedKeys.map((key) => {
              const groupProds = grouped[key];
              return (
                <div key={key} className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="px-5 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                    <span className="font-semibold text-sm">{key || "Unassigned"}</span>
                    <span className="text-xs text-muted-foreground">{groupProds.length} style{groupProds.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {groupProds.map((p) => {
                      const pColors = linkedColors.filter((cv) => cv.product_id === p.id);
                      const vol = pColors.reduce((s, cv) =>
                        s + (cv.volume_spain || 0) + (cv.volume_france || 0) + (cv.volume_germany || 0) + (cv.volume_italy || 0), 0);
                      const markets = [...new Set(pColors.flatMap((cv) => cv.markets || []))];
                      return (
                        <div key={p.id} className="px-5 py-3 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Link to={`/products/${p.id}`} className="font-medium text-sm hover:text-primary transition-colors">
                                {p.name}
                              </Link>
                              <Link to={`/products/${p.id}`} className="text-muted-foreground hover:text-primary">
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                            <p className="text-xs text-muted-foreground">{p.sub_category} · {p.customer_need}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex gap-1">
                              {pColors.map((cv) => (
                                <div key={cv.id} className="group/color relative">
                                  <div
                                    className="w-8 h-8 rounded-lg overflow-hidden border border-border cursor-pointer hover:ring-2 hover:ring-primary/30"
                                    title={cv.color_name}
                                  >
                                    {cv.image_url ? (
                                      <img src={cv.image_url} alt={cv.color_name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full" style={{ backgroundColor: cv.color_hex || "#ccc" }} />
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleUnlink(cv.id)}
                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground items-center justify-center text-[10px] hidden group-hover/color:flex"
                                    title="Unlink from project"
                                  >×</button>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-0.5">
                              {markets.map((m) => <span key={m} className="text-sm">{MARKET_FLAGS[m]}</span>)}
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">{vol.toLocaleString()} u.</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* MATRIX VIEW */}
        <TabsContent value="matrix" className="mt-4">
          {linkedProducts.length === 0 ? (
            <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">No styles yet to display in matrix.</p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <table className="w-full border-separate" style={{ borderSpacing: "6px" }}>
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-background min-w-[140px]">
                      <div className="px-3 py-2 text-xs text-muted-foreground text-right">
                        <span className="block font-semibold">{rowCriteria.replace("_", " ")}</span>
                        <span className="text-[10px]">↓ rows · columns →</span>
                        <span className="block font-semibold">{colCriteria.replace("_", " ")}</span>
                      </div>
                    </th>
                    {colKeys.map((ck) => (
                      <th key={ck} className="min-w-[160px]">
                        <div className="px-3 py-2 bg-muted rounded-lg text-xs font-semibold text-center">{ck || "—"}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowKeys.map((rk) => (
                    <tr key={rk}>
                      <td className="sticky left-0 z-10 bg-background">
                        <div className="px-3 py-2 bg-muted rounded-lg text-xs font-semibold">{rk || "—"}</div>
                      </td>
                      {colKeys.map((ck) => (
                        <td key={ck} className="align-top">
                          <MatrixCell products={getProductsAt(rk, ck)} colorVariants={linkedColors} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Link existing modal */}
      <LinkProductColorModal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onLink={handleLink}
        alreadyLinkedIds={linkedColorIds}
      />

      {/* Create new product dialog */}
      <Dialog open={showNewProductDialog} onOpenChange={setShowNewProductDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Style</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProduct} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium">Product Name</label>
              <Input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium">Category</label>
                <Select value={newProductCategory} onValueChange={setNewProductCategory}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Sub-Category</label>
                <Select value={newProductSubCat} onValueChange={setNewProductSubCat}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{SUB_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Customer Need</label>
              <Select value={newProductNeed} onValueChange={setNewProductNeed}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{CUSTOMER_NEEDS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowNewProductDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={creatingProduct} className="gap-2">
                {creatingProduct && <Loader2 className="w-4 h-4 animate-spin" />}
                Next: Add Color
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}