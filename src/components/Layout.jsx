import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Shirt, SwatchBook, LayoutList, FolderOpen, Palette, Layers, ChevronDown, Ruler, ListCollapse, Menu, ChevronsLeft, ChevronsRight, Hash } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Styles", icon: Shirt },
  { path: "/materials", label: "Materials", icon: SwatchBook },
  { path: "/projects", label: "Projects", icon: FolderOpen },
  { path: "/list-view", label: "List View", icon: LayoutList },
];

const COLOR_STUDIO_ITEMS = [
  { path: "/color-library", label: "Color Library", icon: Palette },
  { path: "/color-palettes", label: "Palettes", icon: Layers },
];

const SIZE_STUDIO_ITEMS = [
  { path: "/size-library", label: "Size Library", icon: Ruler },
  { path: "/size-grid-library", label: "Size Grids", icon: Layers },
];

const CONFIG_ITEMS = [
  { path: "/list-of-values", label: "List of Values", icon: ListCollapse },
  { path: "/code-generators", label: "Code Generators", icon: Hash },
];

export default function Layout() {
  const location = useLocation();
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem("sidebarExpanded");
    return saved ? JSON.parse(saved) : true;
  });
  const [studioOpen, setStudioOpen] = useState(false);
  const [sizeStudioOpen, setSizeStudioOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const toggleExpanded = () => {
    setExpanded((v) => {
      localStorage.setItem("sidebarExpanded", JSON.stringify(!v));
      return !v;
    });
  };

  const isStudioActive = COLOR_STUDIO_ITEMS.some((i) => location.pathname.startsWith(i.path));
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
          expanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"
        } ${
          isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {expanded && <span>{item.label}</span>}
      </Link>
    );
  };

  const GroupButton = ({ icon: Icon, label, open, onToggle, isActive }) => (
    <button
      onClick={onToggle}
      title={!expanded ? label : undefined}
      className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all ${
        expanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"
      } ${
        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {expanded && (
        <>
          <span className="flex-1 text-left">{label}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </>
      )}
    </button>
  );

  const NavContent = ({ onNavigate = null }) => (
    <nav className="space-y-0.5">
      {NAV_ITEMS.map((item) => (
        <NavItem key={item.path} item={item} onNavigate={onNavigate} isActive={location.pathname === item.path} />
      ))}

      <div className="my-2 border-t border-border" />

      {/* Color Studio */}
      <div className="space-y-0.5">
        <GroupButton icon={Palette} label="Color Studio" open={studioOpen} onToggle={() => setStudioOpen((o) => !o)} isActive={isStudioActive} />
        {studioOpen && expanded && (
          <div className="pl-3 space-y-0.5">
            {COLOR_STUDIO_ITEMS.map((item) => (
              <NavItem key={item.path} item={item} onNavigate={onNavigate} isActive={location.pathname.startsWith(item.path)} />
            ))}
          </div>
        )}
      </div>

      {/* Size Studio */}
      <div className="space-y-0.5">
        <GroupButton icon={Ruler} label="Size Studio" open={sizeStudioOpen} onToggle={() => setSizeStudioOpen((o) => !o)} isActive={isSizeStudioActive} />
        {sizeStudioOpen && expanded && (
          <div className="pl-3 space-y-0.5">
            {SIZE_STUDIO_ITEMS.map((item) => (
              <NavItem key={item.path} item={item} onNavigate={onNavigate} isActive={location.pathname.startsWith(item.path)} />
            ))}
          </div>
        )}
      </div>

      {/* Config */}
      <div className="space-y-0.5">
        <GroupButton icon={ListCollapse} label="Config" open={configOpen} onToggle={() => setConfigOpen((o) => !o)} isActive={isConfigActive} />
        {configOpen && expanded && (
          <div className="pl-3 space-y-0.5">
            {CONFIG_ITEMS.map((item) => (
              <NavItem key={item.path} item={item} onNavigate={onNavigate} isActive={location.pathname.startsWith(item.path)} />
            ))}
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop / Tablet sidebar — always visible */}
      <aside
        className={`hidden sm:flex flex-col border-r border-border bg-sidebar transition-all duration-300 shrink-0 ${
          expanded ? "w-56" : "w-14"
        }`}
      >
        {/* Top: logo + toggle */}
        <div className={`flex items-center border-b border-border h-16 shrink-0 ${
          expanded ? "px-3 gap-3" : "justify-center px-0"
        }`}>
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Shirt className="w-4 h-4 text-primary-foreground" />
            </div>
            {expanded && <span className="font-display text-lg font-semibold tracking-tight">Linea</span>}
          </Link>
          {expanded && (
            <button
              onClick={toggleExpanded}
              className="ml-auto p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
              title="Collapse sidebar"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse toggle when icon-only */}
        {!expanded && (
          <button
            onClick={toggleExpanded}
            className="mx-auto mt-2 p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
            title="Expand sidebar"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        )}

        {/* Nav */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden py-3 ${
          expanded ? "px-3" : "px-2"
        }`}>
          <NavContent />
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

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}