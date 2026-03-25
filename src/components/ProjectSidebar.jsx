import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Palette, FileText, ShoppingBag, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MENU_ITEMS = [
  { id: "palettes", label: "Palettes", icon: Palette },
  { id: "planning", label: "Planning", icon: FileText },
  { id: "products", label: "Planned Products", icon: ShoppingBag },
  { id: "materials", label: "Planned Materials", icon: Package },
];

export default function ProjectSidebar({ activeSection, onSectionChange }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      "border-r border-border bg-muted/30 flex flex-col transition-all duration-300 overflow-hidden",
      expanded ? "w-48" : "w-16"
    )}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setExpanded(!expanded)}
        className="h-12 w-12 mx-auto mt-2 mb-4 shrink-0"
        title={expanded ? "Collapse" : "Expand"}
      >
        {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </Button>

      <nav className="flex-1 space-y-1 px-2">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title={!expanded ? item.label : ""}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {expanded && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}