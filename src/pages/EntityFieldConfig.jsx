import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import EntityFieldConfigMatrix from "../components/EntityFieldConfigMatrix";

export default function EntityFieldConfigPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/config")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Entity Field Configuration</h1>
          <p className="text-muted-foreground mt-1">Control which fields appear for each entity type across all forms</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <EntityFieldConfigMatrix />
      </div>
    </div>
  );
}