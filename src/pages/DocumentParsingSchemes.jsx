import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, FileJson, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EMPTY_FORM = {
  document_type: "",
  name: "",
  description: "",
  extraction_prompt: "",
  json_schema: "",
  is_active: true,
};

function SchemeDialog({ open, onOpenChange, scheme, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [schemaError, setSchemaError] = useState("");

  useEffect(() => {
    if (scheme) {
      setForm({
        document_type: scheme.document_type || "",
        name: scheme.name || "",
        description: scheme.description || "",
        extraction_prompt: scheme.extraction_prompt || "",
        json_schema: scheme.json_schema ? JSON.stringify(scheme.json_schema, null, 2) : "",
        is_active: scheme.is_active !== false,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setSchemaError("");
  }, [scheme, open]);

  const update = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSave = async () => {
    setSchemaError("");
    let parsedSchema = null;
    if (form.json_schema.trim()) {
      try {
        parsedSchema = JSON.parse(form.json_schema);
      } catch {
        setSchemaError("Invalid JSON — please fix before saving.");
        return;
      }
    }
    setSaving(true);
    await onSave({ ...form, json_schema: parsedSchema });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{scheme ? `Edit: ${scheme.name}` : "New Parsing Scheme"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Document Type *</Label>
              <Input value={form.document_type} onChange={(e) => update("document_type", e.target.value)} placeholder="e.g. Line Sheet" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Scheme Name *</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Line Sheet V1" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Notes about this scheme or the document layout…" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Extraction Prompt *</Label>
            <p className="text-xs text-muted-foreground">Instructions sent to the AI to guide data extraction from the document.</p>
            <Textarea
              value={form.extraction_prompt}
              onChange={(e) => update("extraction_prompt", e.target.value)}
              rows={6}
              placeholder="Extract product data from document. For each table row/style, extract:&#10;- 'Style Description': product/style name&#10;- 'Style Technical Color Codes': array of Pantone TCX codes..."
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">JSON Schema (output structure)</Label>
            <p className="text-xs text-muted-foreground">Defines the structure the AI should return. Must be valid JSON.</p>
            <Textarea
              value={form.json_schema}
              onChange={(e) => { update("json_schema", e.target.value); setSchemaError(""); }}
              rows={12}
              placeholder='{"type": "object", "properties": { ... }}'
              className={`font-mono text-xs ${schemaError ? "border-destructive" : ""}`}
            />
            {schemaError && <p className="text-xs text-destructive">{schemaError}</p>}
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={(v) => update("is_active", v)} id="is_active" />
            <Label htmlFor="is_active" className="text-sm cursor-pointer">Active (used for parsing)</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.document_type.trim() || !form.name.trim() || !form.extraction_prompt.trim()} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {scheme ? "Save Changes" : "Create Scheme"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentParsingSchemes() {
  const navigate = useNavigate();
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    base44.entities.DocumentParsingScheme.list("-created_date", 100).then((data) => {
      setSchemes(data);
      setLoading(false);
    });
  }, []);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (s) => { setEditing(s); setDialogOpen(true); };

  const handleSave = async (data) => {
    if (editing) {
      const updated = await base44.entities.DocumentParsingScheme.update(editing.id, data);
      setSchemes((prev) => prev.map((s) => s.id === editing.id ? { ...s, ...data } : s));
    } else {
      const created = await base44.entities.DocumentParsingScheme.create(data);
      setSchemes((prev) => [created, ...prev]);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.DocumentParsingScheme.delete(id);
    setSchemes((prev) => prev.filter((s) => s.id !== id));
  };

  const handleToggleActive = async (scheme) => {
    const updated = { ...scheme, is_active: !scheme.is_active };
    await base44.entities.DocumentParsingScheme.update(scheme.id, { is_active: !scheme.is_active });
    setSchemes((prev) => prev.map((s) => s.id === scheme.id ? updated : s));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/config")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Document Parsing Schemes</h1>
          <p className="text-muted-foreground mt-1">Define AI extraction rules and JSON schemas per document type</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> New Scheme
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : schemes.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed border-border">
          <FileJson className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No parsing schemes yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create one to control how documents are parsed by AI</p>
          <Button onClick={openNew} variant="outline" className="mt-4 gap-2"><Plus className="w-4 h-4" /> New Scheme</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {schemes.map((scheme) => (
            <div key={scheme.id} className="bg-card rounded-xl border border-border p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <FileJson className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{scheme.name}</span>
                  <Badge variant="outline" className="text-xs">{scheme.document_type}</Badge>
                  {!scheme.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  {scheme.is_active && <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Active</Badge>}
                </div>
                {scheme.description && <p className="text-xs text-muted-foreground mt-1">{scheme.description}</p>}
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 font-mono bg-muted/50 px-2 py-1 rounded">
                  {scheme.extraction_prompt?.slice(0, 150)}{scheme.extraction_prompt?.length > 150 ? "…" : ""}
                </p>
                {scheme.json_schema && (
                  <p className="text-xs text-muted-foreground mt-1">
                    JSON Schema: <span className="font-mono">{Object.keys(scheme.json_schema?.properties || {}).length} top-level properties</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={!!scheme.is_active} onCheckedChange={() => handleToggleActive(scheme)} title="Toggle active" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(scheme)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Scheme</AlertDialogTitle>
                      <AlertDialogDescription>Delete "{scheme.name}"? This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(scheme.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <SchemeDialog open={dialogOpen} onOpenChange={setDialogOpen} scheme={editing} onSave={handleSave} />
    </div>
  );
}