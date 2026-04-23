import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function ItemSubNav({ items, activeId, onChange, children }) {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  const storageKey = `itemnav_tab_${location.pathname}`;

  // On mount: restore last active tab from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved && saved !== activeId && items.some((i) => i.id === saved)) {
      onChange(saved);
    }
  }, [storageKey]);

  const handleChange = (id) => {
    onChange(id);
    localStorage.setItem(storageKey, id);
  };

  return (
    <div className="rounded-none flex border border-border overflow-hidden min-h-[400px]">
      {/* Left vertical nav */}
      <div
        className={`shrink-0 bg-sidebar border-r border-border py-2 flex flex-col transition-all duration-200 ${expanded ? "w-44" : "w-12"}`}>
        
        {/* Toggle arrow */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center px-3 py-2 text-muted-foreground hover:text-foreground transition-colors mb-1"
          title={expanded ? "Collapse" : "Expand"}>
          
          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        </button>

        {items.map((item) => {
          const isActive = activeId === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleChange(item.id)}
              title={!expanded ? item.label : undefined}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors text-left ${
              isActive ?
              "bg-primary text-primary-foreground" :
              "text-muted-foreground hover:text-foreground hover:bg-muted/60"} ${
              expanded ? "" : "justify-center"}`}>
              
              {Icon && <Icon className="w-4 h-4 shrink-0" />}
              {expanded &&
              <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.count !== undefined &&
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${
                  isActive ?
                  "bg-white/20 text-primary-foreground" :
                  "bg-muted text-muted-foreground"}`
                  }>
                  
                      {item.count}
                    </span>
                }
                </>
              }
            </button>);

        })}
      </div>

      {/* Content area */}
      <div className="flex-1 p-5 min-w-0 overflow-auto bg-background">
        {children}
      </div>
    </div>);

}