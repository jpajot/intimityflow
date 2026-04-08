import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, Trash2 } from "lucide-react";
import BoardIcon from "../components/icons/BoardIcon";

export default function ProjectBoards({ projectId }) {
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    base44.entities.Board.filter({ project_id: projectId }).then((b) => {
      setBoards(b);
      setLoading(false);
    });
  }, [projectId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const b = await base44.entities.Board.create({ name: newName.trim(), project_id: projectId });
    setBoards((prev) => [...prev, b]);
    setNewName("");
    setShowCreate(false);
    setCreating(false);
    navigate(`/projects/${projectId}/boards/${b.id}`);
  };

  const handleDelete = async (e, boardId) => {
    e.stopPropagation();
    await base44.entities.Board.delete(boardId);
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{boards.length} board{boards.length !== 1 ? "s" : ""}</p>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowCreate(true)}>
          <Plus className="w-3.5 h-3.5" /> New Board
        </Button>
      </div>

      {showCreate && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
          <Input
            autoFocus
            placeholder="Board name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
            className="h-8 text-sm"
          />
          <Button size="sm" className="h-8" onClick={handleCreate} disabled={!newName.trim() || creating}>
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowCreate(false)}>Cancel</Button>
        </div>
      )}

      {boards.length === 0 && !showCreate ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <BoardIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm font-medium mb-1">No boards yet</p>
          <p className="text-xs text-muted-foreground mb-4">Create a board to start designing your collection layout.</p>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Board
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {boards.map((board) => (
            <button
              key={board.id}
              type="button"
              onClick={() => navigate(`/projects/${projectId}/boards/${board.id}`)}
              className="group text-left bg-card border border-border rounded-xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all"
            >
              {/* Preview area */}
              <div className="aspect-video bg-muted/40 flex items-center justify-center overflow-hidden">
                {board.thumbnail_url ? (
                  <img src={board.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <BoardIcon className="w-10 h-10 text-muted-foreground/30" />
                )}
              </div>
              <div className="px-3 py-2.5 flex items-center justify-between">
                <p className="text-sm font-medium truncate flex-1">{board.name}</p>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, board.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}