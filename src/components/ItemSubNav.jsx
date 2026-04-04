export default function ItemSubNav({ items, activeId, onChange, children }) {
  return (
    <div className="flex rounded-xl border border-border overflow-hidden min-h-[400px]">
      {/* Left vertical nav — same tone as main sidebar */}
      <div className="w-44 shrink-0 bg-sidebar border-r border-border py-2 flex flex-col">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <span className="flex-1">{item.label}</span>
              {item.count !== undefined && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? "bg-white/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="flex-1 p-5 min-w-0 overflow-auto bg-background">
        {children}
      </div>
    </div>
  );
}