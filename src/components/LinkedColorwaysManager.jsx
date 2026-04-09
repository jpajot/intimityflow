import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Grid3x3, List } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LinkedColorwaysView from "./LinkedColorwaysView";
import MatrixViewBuilder from "./matrix/MatrixViewBuilder";
import MatrixRenderer from "./matrix/MatrixRenderer";
import { Loader2 } from "lucide-react";

export default function LinkedColorwaysManager({
  colorways,
  products,
  techColors,
  commColors,
  navigate,
  search,
  onSearchChange,
  view,
  onViewChange,
  activeColumns,
  onColumnsChange,
  projectId,
  allColorways,
  onLinked,
}) {
  const [matrixViews, setMatrixViews] = useState([]);
  const [selectedMatrixView, setSelectedMatrixView] = useState(null);
  const [showMatrixBuilder, setShowMatrixBuilder] = useState(false);
  const [loadingViews, setLoadingViews] = useState(false);

  useEffect(() => {
    loadMatrixViews();
  }, [projectId]);

  const loadMatrixViews = async () => {
    setLoadingViews(true);
    const views = await base44.entities.MatrixView.filter({ project_id: projectId });
    setMatrixViews(views);
    setLoadingViews(false);
  };

  const handleSaveView = async (viewConfig) => {
    if (viewConfig.id) {
      const { id, created_date, updated_date, created_by, ...dataToSave } = viewConfig;
      await base44.entities.MatrixView.update(viewConfig.id, dataToSave);
      // Update selectedMatrixView so re-opening edit has fresh data
      const updated = { ...viewConfig };
      setSelectedMatrixView(updated);
    } else {
      const { id, created_date, updated_date, created_by, ...dataToSave } = viewConfig;
      await base44.entities.MatrixView.create(dataToSave);
    }
    setShowMatrixBuilder(false);
    await loadMatrixViews();
  };

  const handleDeleteView = async (viewId) => {
    if (confirm("Delete this matrix view?")) {
      await base44.entities.MatrixView.delete(viewId);
      setSelectedMatrixView(null);
      await loadMatrixViews();
    }
  };

  // Show matrix view if selected
  if (selectedMatrixView) {
    return (
      <>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setSelectedMatrixView(null)}>← Back to Views</Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowMatrixBuilder(selectedMatrixView)}>Edit</Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteView(selectedMatrixView.id)}>Delete</Button>
            </div>
          </div>
          <MatrixRenderer config={selectedMatrixView} projectId={projectId} />
        </div>
        <Dialog open={!!showMatrixBuilder} onOpenChange={(open) => { if (!open) setShowMatrixBuilder(false); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{showMatrixBuilder?.id ? "Edit Matrix View" : "Create Matrix View"}</DialogTitle>
            </DialogHeader>
            {showMatrixBuilder && (
              <MatrixViewBuilder
                projectId={projectId}
                onSave={handleSaveView}
                onCancel={() => setShowMatrixBuilder(false)}
                initialConfig={typeof showMatrixBuilder === "object" && showMatrixBuilder.id ? showMatrixBuilder : undefined}
              />
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Show view selector
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={view === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => { onViewChange("grid"); setSelectedMatrixView(null); }}
            className="gap-1.5"
          >
            <Grid3x3 className="w-4 h-4" /> Grid
          </Button>
          <Button
            variant={view === "matrix" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewChange("matrix")}
            className="gap-1.5"
          >
            <Grid3x3 className="w-4 h-4" /> Matrix
          </Button>
        </div>
      </div>

      {view === "matrix" ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowMatrixBuilder(true)}>+ New View</Button>
          </div>

          {loadingViews ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : matrixViews.length === 0 ? (
            <div className="text-center py-8 bg-muted/30 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground">No matrix views created yet.</p>
              <Button size="sm" onClick={() => setShowMatrixBuilder(true)} className="mt-3">Create First View</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {matrixViews.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedMatrixView(v)}
                  className="text-left p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <p className="font-medium text-sm">{v.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{v.row_entity} × {v.column_entity}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <LinkedColorwaysView
          colorways={colorways}
          products={products}
          techColors={techColors}
          commColors={commColors}
          navigate={navigate}
          search={search}
          onSearchChange={onSearchChange}
          view={view}
          onViewChange={onViewChange}
          activeColumns={activeColumns}
          onColumnsChange={onColumnsChange}
          projectId={projectId}
          allColorways={allColorways}
          onLinked={onLinked}
        />
      )}

      <Dialog open={!!showMatrixBuilder} onOpenChange={(open) => { if (!open) setShowMatrixBuilder(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showMatrixBuilder?.id ? "Edit Matrix View" : "Create Matrix View"}</DialogTitle>
          </DialogHeader>
          {showMatrixBuilder && (
            <MatrixViewBuilder
              projectId={projectId}
              onSave={handleSaveView}
              onCancel={() => setShowMatrixBuilder(false)}
              initialConfig={typeof showMatrixBuilder === "object" && showMatrixBuilder.id ? showMatrixBuilder : undefined}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}