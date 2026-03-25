import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Shirt, SwatchBook, LayoutList, FolderOpen, Palette, Layers, ChevronDown, Ruler, ListCollapse, Menu, ChevronLeft, ChevronRight, X } from "lucide-react";

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
];

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("sidebarOpen");
    return saved ? JSON.parse(saved) : true;
  });
  const [studioOpen, setStudioOpen] = useState(false);
  const [sizeStudioOpen, setSizeStudioOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  const isStudioActive = COLOR_STUDIO_ITEMS.some((i) => location.pathname.startsWith(i.path));
  const isSizeStudioActive = SIZE_STUDIO_ITEMS.some((i) => location.pathname.startsWith(i.path));
  const isConfigActive = CONFIG_ITEMS.some((i) => location.pathname.startsWith(i.path));

  const NavContent = ({ onNavigate = null }) => (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}

      <div className="my-2 border-t border-border" />

      {/* Color Studio */}
      <div className="space-y-1">
        <button
          onClick={() => setStudioOpen((o) => !o)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            isStudioActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Palette className="w-4 h-4 shrink-0" />
          Color Studio
          <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${studioOpen ? "rotate-180" : ""}`} />
        </button>
        {studioOpen && (
          <div className="pl-4 space-y-1">
            {COLOR_STUDIO_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? "text-primary font-medium bg-accent" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Size Studio */}
      <div className="space-y-1">
        <button
          onClick={() => setSizeStudioOpen((o) => !o)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            isSizeStudioActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Ruler className="w-4 h-4 shrink-0" />
          Size Studio
          <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${sizeStudioOpen ? "rotate-180" : ""}`} />
        </button>
        {sizeStudioOpen && (
          <div className="pl-4 space-y-1">
            {SIZE_STUDIO_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? "text-primary font-medium bg-accent" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Config */}
      <div className="space-y-1">
        <button
          onClick={() => setConfigOpen((o) => !o)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            isConfigActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <ListCollapse className="w-4 h-4 shrink-0" />
          Config
          <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${configOpen ? "rotate-180" : ""}`} />
        </button>
        {configOpen && (
          <div className="pl-4 space-y-1">
            {CONFIG_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? "text-primary font-medium bg-accent" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shirt className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-semibold tracking-tight">Linea</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className={`hidden sm:flex flex-col border-r border-border bg-muted/30 transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-64" : "w-0"}`}>
          <div className="flex-1 overflow-y-auto p-4">
            {sidebarOpen && <NavContent />}
          </div>
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}