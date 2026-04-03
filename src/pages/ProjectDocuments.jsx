import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, FileText, Loader2, ChevronRight, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [file, setFile] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

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

  const handleUpload = async () => {
    if (!file || !selectedType) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const doc = await base44.entities.UploadedDocument.create({
        project_id: id,
        document_type: selectedType,
        file_url,
        original_filename: file.name,
        upload_date: new Date().toISOString(),
        status: "uploaded",
      });
      setDocuments(prev => [doc, ...prev]);
      setFile(null);
      setSelectedType("");

      // Trigger parsing
      await base44.functions.invoke("parseDocument", { document_id: doc.id });

      // Refresh document status
      const updated = await base44.entities.UploadedDocument.filter({ id: doc.id });
      if (updated.length) {
        setDocuments(prev => prev.map(d => d.id === doc.id ? updated[0] : d));
      }
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${id}`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <p className="text-xs text-muted-foreground">{project?.name}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Documents</h1>
        </div>
      </div>

      {/* Upload Card */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-semibold text-sm">Upload New Document</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Document Type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                {docTypes.length === 0 ? (
                  <SelectItem value="__none" disabled>No types configured</SelectItem>
                ) : (
                  docTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">PPTX File</Label>
            <label className={`flex items-center gap-2 px-4 py-2 h-9 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
              <Upload className="w-4 h-4 shrink-0" />
              <span className="truncate">{file ? file.name : "Choose .pptx file…"}</span>
              <input type="file" accept=".pptx,.ppt" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>
        <Button onClick={handleUpload} disabled={!file || !selectedType || uploading} className="gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Uploading & Parsing…" : "Upload & Parse"}
        </Button>
        {docTypes.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Add document types via <Link to="/list-of-values" className="underline text-primary">List of Values</Link> → create a type with code <code className="bg-muted px-1 rounded">DocumentType</code>.
          </p>
        )}
      </div>

      {/* Document list */}
      <div className="space-y-3">
        {documents.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          </div>
        ) : (
          documents.map(doc => (
            <button
              key={doc.id}
              onClick={() => navigate(`/projects/${id}/documents/${doc.id}`)}
              className="w-full flex items-center gap-4 bg-card rounded-xl border border-border p-4 hover:border-primary/30 hover:shadow-sm transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{doc.original_filename || "Document"}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">{doc.document_type}</span>
                  {doc.collection_name && <span className="text-xs text-muted-foreground">· {doc.collection_name}</span>}
                  <span className="text-xs text-muted-foreground">· {doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : ""}</span>
                </div>
                {doc.status === "error" && doc.error_message && (
                  <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {doc.error_message}
                  </p>
                )}
              </div>
              <Badge variant={STATUS_COLORS[doc.status] || "secondary"} className="shrink-0">
                {STATUS_LABELS[doc.status] || doc.status}
              </Badge>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}