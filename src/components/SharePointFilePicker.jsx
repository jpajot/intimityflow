import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Search, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function SharePointFilePicker({ open, onClose, onSelect }) {
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (open && !searched) {
      loadFiles("");
    }
  }, [open]);

  const loadFiles = async (query) => {
    setLoading(true);
    const res = await base44.functions.invoke("browseSharePoint", { search: query || ".pptx" });
    setFiles(res.data?.files || []);
    setSearched(true);
    setLoading(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadFiles(search || ".pptx");
  };

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Select from SharePoint</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PPTX files…"
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="outline" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </Button>
        </form>

        <div className="min-h-[200px] max-h-[360px] overflow-y-auto space-y-1 mt-2">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && files.length === 0 && searched && (
            <div className="text-center py-12 text-sm text-muted-foreground">No PPTX files found.</div>
          )}
          {!loading && files.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => { onSelect(file); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(file.size)}
                  {file.lastModified && ` · ${new Date(file.lastModified).toLocaleDateString()}`}
                </p>
              </div>
              {file.webUrl && (
                <a href={file.webUrl} target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-primary shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}