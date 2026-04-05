import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Languages, ListCollapse, Hash, ChevronRight, FileJson } from "lucide-react";
import { Input } from "@/components/ui/input";

const CONFIG_ITEMS = [
  {
    path: "/translations",
    label: "Translations",
    description: "Manage translated content for entities across languages",
    icon: Languages,
  },
  {
    path: "/list-of-values",
    label: "List of Values",
    description: "Define and organize picklist values used across the app",
    icon: ListCollapse,
  },
  {
    path: "/code-generators",
    label: "Code Generators",
    description: "Configure automatic code generation sequences for entities",
    icon: Hash,
  },
  {
    path: "/document-parsing-schemes",
    label: "Document Parsing Schemes",
    description: "Define AI extraction prompts and JSON schemas per document type",
    icon: FileJson,
  },
];

export default function Config() {
  const [search, setSearch] = useState("");

  const filtered = CONFIG_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground mt-1">Manage app settings and reference data</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search settings…"
          className="pl-10"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">No settings found.</p>
        )}
        {filtered.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}