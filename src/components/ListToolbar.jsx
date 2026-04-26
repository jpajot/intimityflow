import { useState, useRef, useEffect } from "react";
import { Search, LayoutGrid, List, MoreHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { createPortal } from "react-dom";

/**
 * ListToolbar – compact, mobile-friendly toolbar for list/gallery pages.
 *
 * Props:
 *   search        string
 *   onSearch      (val: string) => void
 *   searchPlaceholder  string
 *   view          "grid" | "list"   (pass null to hide toggle)
 *   onViewChange  (view) => void
 *   moreItems     Array<{ label, icon?, onClick, divider? }>
 *   children      extra items rendered between toggles and ⋯ (e.g. ViewSelector)
 */
export default function ListToolbar({
  search,
  onSearch,
  searchPlaceholder = "Search…",
  view,
  onViewChange,
  moreItems = [],
  children,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const searchRef = useRef(null);
  const moreBtnRef = useRef(null);
  const menuRef = useRef(null);

  // Auto-focus when search expands
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // Close search on Escape / blur if empty
  const handleSearchBlur = () => {
    if (!search) setSearchOpen(false);
  };
  const handleSearchKey = (e) => {
    if (e.key === "Escape") { onSearch(""); setSearchOpen(false); }
  };

  // Close more-menu on outside click/touch
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        moreBtnRef.current && !moreBtnRef.current.contains(e.target)
      ) setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h);
    return () => { 
      document.removeEventListener("mousedown", h);
      document.removeEventListener("touchstart", h);
    };
  }, [menuOpen]);

  const toggleMenu = () => {
    if (!menuOpen && moreBtnRef.current) {
      const rect = moreBtnRef.current.getBoundingClientRect();
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
        zIndex: 9999,
      });
    }
    setMenuOpen((v) => !v);
  };

  return (
    <div className="flex items-center gap-1.5 flex-nowrap min-w-0 relative z-50">
      {/* View toggle — always first */}
      {onViewChange && (
        <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => onViewChange("grid")}
            className={`px-2.5 py-1.5 transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            title="Gallery"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewChange("list")}
            className={`px-2.5 py-1.5 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            title="Table"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Extra children (e.g. ViewSelector) */}
      {children && <div className="flex items-center gap-1.5 min-w-0">{children}</div>}

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Collapsible search */}
      <div className={`flex items-center transition-all duration-200 z-40 ${searchOpen ? "flex-1 min-w-0 max-w-xs" : "w-8 shrink-0"}`}>
        {searchOpen ? (
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              onBlur={handleSearchBlur}
              onKeyDown={handleSearchKey}
              placeholder={searchPlaceholder}
              className="pl-8 pr-7 h-8 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => { onSearch(""); searchRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ⋯ More menu */}
      {moreItems.length > 0 && (
        <>
          <button
            ref={moreBtnRef}
            type="button"
            onClick={toggleMenu}
            className={`w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 ${menuOpen ? "bg-muted" : ""}`}
            title="More actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && createPortal(
            <div
              ref={menuRef}
              style={menuStyle}
              className="bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
            >
              {moreItems.map((item, i) =>
                item.divider ? (
                  <div key={i} className="my-1 border-t border-border" />
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { item.onClick(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                  >
                    {item.icon && <item.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    {item.label}
                  </button>
                )
              )}
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}