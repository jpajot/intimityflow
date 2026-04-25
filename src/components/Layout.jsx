import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import FabricRollIcon from "./icons/FabricRollIcon";
import ProjectsIcon from "./icons/ProjectsIcon";
import StylesIcon from "./icons/StylesIcon";
import { Shirt, SwatchBook, Palette, Ruler, ListCollapse, Menu, ChevronsLeft, ChevronsRight, Hash, Languages, Settings, Pin, PinOff, ChevronDown } from "lucide-react";

export const PINNED_ITEMS_KEY = "pinnedNavItems";
export function getPinnedItems() {
  try {return JSON.parse(localStorage.getItem(PINNED_ITEMS_KEY) || "[]");} catch {return [];}
}
export function setPinnedItems(items) {
  localStorage.setItem(PINNED_ITEMS_KEY, JSON.stringify(items));
  // Also persist to user profile for cross-device sync
  import("@/api/base44Client").then(({ base44 }) => {
    base44.auth.updateMe({ pinned_nav_items: items }).catch(() => {});
  });
}

const NAV_ITEMS = [
{ path: "/list-view", label: "Products Lists", icon: StylesIcon },
{ path: "/materials", label: "Materials Lists", icon: FabricRollIcon },
{ path: "/projects", label: "Projects", icon: ProjectsIcon }];




const SIZE_STUDIO_ITEMS = [];

const CONFIG_ITEMS = [
{ path: "/translations", label: "Translations", icon: Languages },
{ path: "/list-of-values", label: "List of Values", icon: ListCollapse },
{ path: "/code-generators", label: "Code Generators", icon: Hash }];


export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem("sidebarExpanded");
    return saved ? JSON.parse(saved) : true;
  });
  const [studioOpen, setStudioOpen] = useState(false);
  const [sizeStudioOpen, setSizeStudioOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [pinnedItems, setPinnedItemsState] = useState(() => getPinnedItems());

  // On mount, load pinned items from user profile (cross-device sync)
  useEffect(() => {
    import("@/api/base44Client").then(({ base44 }) => {
      base44.auth.me().then((user) => {
        if (user?.pinned_nav_items && Array.isArray(user.pinned_nav_items)) {
          // User profile is the source of truth — sync to localStorage too
          setPinnedItems(user.pinned_nav_items);
          setPinnedItemsState(user.pinned_nav_items);
        }
      }).catch(() => {});
    });
  }, []);

  // Keep pinned items in sync across tabs/pages
  useEffect(() => {
    const handler = () => setPinnedItemsState(getPinnedItems());
    window.addEventListener("storage", handler);
    window.addEventListener("pinned-items-changed", handler);
    return () => {window.removeEventListener("storage", handler);window.removeEventListener("pinned-items-changed", handler);};
  }, []);

  const toggleExpanded = () => {
    setExpanded((v) => {
      localStorage.setItem("sidebarExpanded", JSON.stringify(!v));
      return !v;
    });
  };

  const isStudioActive = location.pathname.startsWith("/color-palettes");
  const isSizeStudioActive = SIZE_STUDIO_ITEMS.some((i) => location.pathname.startsWith(i.path));
  const isConfigActive = CONFIG_ITEMS.some((i) => location.pathname.startsWith(i.path));

  // Reusable nav item for both expanded and collapsed sidebar
  const NavItem = ({ item, onNavigate, isActive }) => {
    const Icon = item.icon;
    return (
      <Link
        to={item.path}
        onClick={onNavigate}
        title={!expanded ? item.label : undefined}
        className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all ${
        expanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"} ${

        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`
        }>
        
        <Icon className="w-4 h-4 shrink-0" />
        {expanded && <span>{item.label}</span>}
      </Link>);

  };

  const GroupButton = ({ icon: Icon, label, open, onToggle, isActive, navPath }) =>
  <button
    onClick={() => {
      if (!expanded) setExpanded(true);
      if (navPath) navigate(navPath);
      onToggle();
    }}
    title={!expanded ? label : undefined}
    className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all ${
    expanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"} ${

    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`
    }>
    
      <Icon className="w-4 h-4 shrink-0" />
      {expanded &&
    <>
          <span className="flex-1 text-left">{label}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </>
    }
    </button>;


  const NavContent = ({ onNavigate = null }) =>
  <nav className="space-y-0.5">
      {NAV_ITEMS.map((item) =>
    <NavItem key={item.path} item={item} onNavigate={onNavigate} isActive={location.pathname === item.path} />
    )}

      <div className="my-2 border-t border-border" />

      {/* Color Studio */}
      <NavItem item={{ path: "/color-palettes", label: "Color Studio", icon: SwatchBook }} onNavigate={onNavigate} isActive={isStudioActive} />

      {/* Size Studio */}
      <NavItem item={{ path: "/size-grid-library", label: "Size Studio", icon: Ruler }} onNavigate={onNavigate} isActive={location.pathname.startsWith("/size-grid-library")} />

      {/* Pinned Items */}
      {pinnedItems.length > 0 &&
    <>
          <div className="my-2 border-t border-border" />
          {expanded && <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-0.5">Pinned</p>}
          {pinnedItems.map((item) =>
      <div key={item.path} className="group relative">
              <Link
          to={item.path}
          onClick={onNavigate}
          title={!expanded ? item.label : undefined}
          className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all ${
          expanded ? "px-3 py-2" : "px-0 py-2 justify-center"} ${

          location.pathname === item.path ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`
          }>
          
                <Pin className="w-3.5 h-3.5 shrink-0" />
                {expanded && <span className="flex-1 truncate">{item.label}</span>}
              </Link>
              {expanded &&
        <button
          type="button"
          onClick={() => {
            const updated = pinnedItems.filter((p) => p.path !== item.path);
            setPinnedItems(updated);
            setPinnedItemsState(updated);
            window.dispatchEvent(new Event("pinned-items-changed"));
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-destructive text-muted-foreground transition-opacity"
          title="Unpin">
          
                  <PinOff className="w-3 h-3" />
                </button>
        }
            </div>
      )}
        </>
    }
    </nav>;


  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop / Tablet sidebar — always visible */}
      <aside className="bg-transparent hidden sm:flex flex-col transition-all duration-300 shrink-0 w-14">


        
        
        {/* Top: logo + toggle */}
        <div className={`flex items-center border-b border-border h-16 shrink-0 ${
        expanded ? "px-3 gap-3" : "justify-center px-0"}`
        }>
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Shirt className="w-4 h-4 text-primary-foreground" />
            </div>
            {expanded && <span className="font-display text-lg font-semibold tracking-tight">Linea</span>}
          </Link>
          {expanded &&
          <button
            onClick={toggleExpanded}
            className="ml-auto p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
            title="Collapse sidebar">
            
              <ChevronsLeft className="w-4 h-4" />
            </button>
          }
        </div>

        {/* Collapse toggle when icon-only */}
        {!expanded &&
        <button
          onClick={toggleExpanded}
          className="mx-auto mt-2 p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
          title="Expand sidebar">
          
            <ChevronsRight className="w-4 h-4" />
          </button>
        }

        {/* Nav */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden py-3 ${
        expanded ? "px-3" : "px-2"}`
        }>
          <NavContent />
        </div>

        {/* Config at bottom */}
        <div className={`shrink-0 border-t border-border py-3 ${expanded ? "px-3" : "px-2"}`}>
          <NavItem item={{ path: "/config", label: "Settings", icon: Settings }} onNavigate={null} isActive={location.pathname.startsWith("/config") || isConfigActive} />
        </div>
      </aside>

      {/* Mobile header + sheet */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="sm:hidden sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="px-4 h-14 flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Menu className="w-5 h-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="p-4 border-b border-border">
                  <Link to="/" className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                      <Shirt className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                    <span className="font-display text-lg font-semibold">Linea</span>
                  </Link>
                </div>
                <div className="p-3 overflow-y-auto">
                  <NavContent />
                </div>
              </SheetContent>
            </Sheet>
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Shirt className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-semibold">Linea</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto sm:p-4">
          <Outlet />
        </main>
      </div>
    </div>);

}