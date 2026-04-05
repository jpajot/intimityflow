import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function LinkedStylesView({ styles, navigate }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return styles;
    const q = search.toLowerCase();
    return styles.filter((s) =>
      s.name?.toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q) ||
      s.sub_category?.toLowerCase().includes(q)
    );
  }, [styles, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search styles…"
          className="pl-8 h-8 text-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            {styles.length === 0 ? "No linked styles yet." : "No results match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((style) => {
            const img = style.images?.[0];
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => navigate(`/products/${style.id}`)}
                className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/20 transition-all text-left"
              >
                <div className="aspect-square bg-muted overflow-hidden">
                  {img ? (
                    <img src={img} alt={style.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground/40">
                      {style.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <p className="font-medium text-sm truncate">{style.name}</p>
                  {(style.category || style.sub_category) && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {[style.category, style.sub_category].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}