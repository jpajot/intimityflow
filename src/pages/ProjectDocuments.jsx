import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Upload, FileText, Loader2, AlertCircle, Cloud, Search, ChevronRight, Trash2 } from "lucide-react";
import SharePointFilePicker from "../components/SharePointFilePicker";
import DataTable from "../components/DataTable";
import ViewSelector from "../components/ViewSelector";

const STATUS_COLORS = {
  uploaded: "secondary",
  processing: "secondary",
  staged: "outline",
  processed: "default",
  error: "destructive",
};

const STATUS_LABELS = {
  uploaded: "Uploaded",
  processing: "Processing…",
  staged: "Ready to Review",
  processed: "Processed",
  error: "Error",
};

export default function ProjectDocuments() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Upload dialog state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [file, setFile] = useState(null);
  const [sharepointFile, setSharepointFile] = useState(null);
  const [showSharePoint, setShowSharePoint] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(null);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    setLoading(true);
    const [projects, docs, lovTypes] = await Promise.all([
      base44.entities.Project.filter({ id }),
      base44.entities.UploadedDocument.filter({ project_id: id }),
      base44.entities.TypeOfLOV.filter({ code: "DocumentType" }),
    ]);
    setProject(projects[0] || null);
    setDocuments(docs.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date)));
    if (lovTypes.length > 0) {
      const values = await base44.entities.ListOfValues.filter({ type_of_lov_id: lovTypes[0].id });
      setDocTypes(values.map(v => v.name));
    }
    setLoading(false);
  };

  const handleSharePointSelect = (spFile) => {
    setSharepointFile(spFile);
    setFile(null);
    setShowSharePoint(false);
  };

  const handleDelete = async (docId) => {
    await base44.entities.UploadedDocument.delete(docId);
    setDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const handleUpload = async () => {
    if ((!file && !sharepointFile) || !selectedType) return;
    setUploading(true);
    try {
      let file_url = "";
      let filename = "";
      if (sharepointFile) {
        // Let backend handle SharePoint download
        file_url = sharepointFile.webUrl;
        filename = sharepointFile.name;
      } else {
        const result = await base44.integrations.Core.UploadFile({ file });
        file_url = result.file_url;
        filename = file.name;
      }
      const doc = await base44.entities.UploadedDocument.create({
        project_id: id,
        document_type: selectedType,
        file_url,
        original_filename: filename,
        upload_date: new Date().toISOString(),
        status: "uploaded",
      });
      setDocuments(prev => [doc, ...prev]);
      setFile(null);
      setSharepointFile(null);
      setSelectedType("");
      setShowUploadDialog(false);

      const parsePayload = { document_id: doc.id };
      if (sharepointFile) parsePayload.is_sharepoint = true;
      
      try {
        await base44.functions.invoke("parseDocument", parsePayload);
        const updated = await base44.entities.UploadedDocument.filter({ id: doc.id });
        if (updated.length) setDocuments(prev => prev.map(d => d.id === doc.id ? updated[0] : d));
      } catch (parseErr) {
        await base44.entities.UploadedDocument.update(doc.id, {
          status: "error",
          error_message: parseErr.message || "Failed to parse document"
        });
        setDocuments(prev => prev.map(d => d.id === doc.id ? {
          ...d,
          status: "error",
          error_message: parseErr.message || "Failed to parse document"
        } : d));
      }
    } finally {
      setUploading(false);
    }
  };

  const filteredDocs = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter(d =>
      d.original_filename?.toLowerCase().includes(q) ||
      d.document_type?.toLowerCase().includes(q) ||
      d.collection_name?.toLowerCase().includes(q)
    );
  }, [documents, search]);

  const columns = [
    {
      id: "filename",
      label: "File Name",
      width: 260,
      sortKey: (d) => d.original_filename || "",
      render: (d) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <span className="font-medium text-sm truncate">{d.original_filename || "Document"}</span>
        </div>
      ),
    },
    {
      id: "document_type",
      label: "Type",
      width: 140,
      sortKey: (d) => d.document_type || "",
      render: (d) => <span className="text-sm text-muted-foreground">{d.document_type || "—"}</span>,
    },
    {
      id: "collection_name",
      label: "Collection",
      width: 180,
      sortKey: (d) => d.collection_name || "",
      render: (d) => <span className="text-sm">{d.collection_name || "—"}</span>,
    },
    {
      id: "upload_date",
      label: "Date",
      width: 120,
      sortKey: (d) => d.upload_date || "",
      render: (d) => <span className="text-sm text-muted-foreground">{d.upload_date ? new Date(d.upload_date).toLocaleDateString() : "—"}</span>,
    },
    {
      id: "status",
      label: "Status",
      width: 140,
      sortKey: (d) => d.status || "",
      render: (d) => (
        <div className="flex flex-col gap-0.5">
          <Badge variant={STATUS_COLORS[d.status] || "secondary"} className="text-xs w-fit">
            {STATUS_LABELS[d.status] || d.status}
          </Badge>
          {d.status === "error" && d.error_message && (
            <span className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {d.error_message}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      label: "",
      width: 80,
      render: (d) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => navigate(`/projects/${id}/documents/${d.id}`)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(d.id)}
            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
            title="Delete document"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${id}`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <p className="text-xs text-muted-foreground">{project?.name}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Documents</h1>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="pl-8 h-9"
          />
        </div>
        {documents.length > 0 && <ViewSelector pageKey="documents" allColumns={columns} onColumnsChange={setVisibleColumns} />}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setShowSharePoint(true)} className="gap-1.5 h-9">
          <Cloud className="w-4 h-4" /> SharePoint
        </Button>
        <Button size="sm" onClick={() => setShowUploadDialog(true)} className="gap-1.5 h-9">
          <Upload className="w-4 h-4" /> Upload &amp; Parse
        </Button>
      </div>

      {/* Table */}
      {filteredDocs.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{documents.length === 0 ? "No documents yet. Upload one to get started." : "No results match your search."}</p>
        </div>
      ) : (
        <DataTable columns={visibleColumns || columns} rows={filteredDocs} hideColumnToggle />
      )}

      {/* Upload dialog */}
      <Dialog open={showUploadDialog} onOpenChange={o => { if (!o) { setFile(null); setSharepointFile(null); setSelectedType(""); } setShowUploadDialog(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload &amp; Parse Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Document Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type…" />
                </SelectTrigger>
                <SelectContent>
                  {docTypes.length === 0
                    ? <SelectItem value="__none" disabled>No types configured</SelectItem>
                    : docTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)
                  }
                </SelectContent>
              </Select>
              {docTypes.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Add types via <Link to="/list-of-values" className="underline text-primary" onClick={() => setShowUploadDialog(false)}>List of Values</Link> → code <code className="bg-muted px-1 rounded">DocumentType</code>.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">PPTX File</Label>
              <div className="flex gap-2">
                <label className={`flex-1 flex items-center gap-2 px-3 py-2 h-9 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                  <Upload className="w-4 h-4 shrink-0" />
                  <span className="truncate">{file ? file.name : sharepointFile ? sharepointFile.name : "Choose .pptx…"}</span>
                  <input type="file" accept=".pptx,.ppt" className="hidden" onChange={e => { setFile(e.target.files?.[0] || null); setSharepointFile(null); }} />
                </label>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowSharePoint(true)} disabled={uploading} className="gap-1.5 shrink-0 h-9">
                  <Cloud className="w-4 h-4" /> SharePoint
                </Button>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleUpload} disabled={(!file && !sharepointFile) || !selectedType || uploading} className="gap-2 flex-1">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Uploading & Parsing…" : "Upload & Parse"}
              </Button>
              <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={uploading}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SharePoint picker */}
      <SharePointFilePicker
        open={showSharePoint}
        onClose={() => setShowSharePoint(false)}
        onSelect={spFile => { handleSharePointSelect(spFile); if (!showUploadDialog) setShowUploadDialog(true); }}
      />
    </div>
  );
}