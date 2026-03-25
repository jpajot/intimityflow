import { useState, useRef, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Package, LayoutList, FolderOpen, Palette, Layers, ChevronDown, Ruler, ListCollapse } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Styles", icon: Package },
  { path: "/materials", label: "Materials", icon: Package },
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
  const [studioOpen, setStudioOpen] = useState(false);
  const [sizeStudioOpen, setSizeStudioOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const studioRef = useRef(null);
  const sizeStudioRef = useRef(null);
  const configRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (studioRef.current && !studioRef.current.contains(e.target)) setStudioOpen(false);
      if (sizeStudioRef.current && !sizeStudioRef.current.contains(e.target)) setSizeStudioOpen(false);
      if (configRef.current && !configRef.current.contains(e.target)) setConfigOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isStudioActive = COLOR_STUDIO_ITEMS.some((i) => location.pathname.startsWith(i.path));
  const isSizeStudioActive = SIZE_STUDIO_ITEMS.some((i) => location.pathname.startsWith(i.path));
  const isConfigActive = CONFIG_ITEMS.some((i) => location.pathname.startsWith(i.path));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Package className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-semibold tracking-tight">Linea</span>
            </Link>

            <nav className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}

              {/* Color Studio dropdown */}
              <div ref={studioRef} className="relative">
                <button
                  onClick={() => setStudioOpen((o) => !o)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isStudioActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Palette className="w-4 h-4" />
                  Color Studio
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${studioOpen ? "rotate-180" : ""}`} />
                </button>
                {studioOpen && (
                  <div className="absolute top-full left-0 mt-1 w-44 bg-popover border border-border rounded-lg shadow-lg py-1 z-50">
                    {COLOR_STUDIO_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname.startsWith(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setStudioOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                            isActive ? "text-primary font-medium bg-accent" : "text-foreground hover:bg-muted"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Size Studio dropdown */}
              <div ref={sizeStudioRef} className="relative">
                <button
                  onClick={() => setSizeStudioOpen((o) => !o)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isSizeStudioActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Ruler className="w-4 h-4" />
                  Size Studio
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sizeStudioOpen ? "rotate-180" : ""}`} />
                </button>
                {sizeStudioOpen && (
                  <div className="absolute top-full left-0 mt-1 w-44 bg-popover border border-border rounded-lg shadow-lg py-1 z-50">
                    {SIZE_STUDIO_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname.startsWith(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setSizeStudioOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                            isActive ? "text-primary font-medium bg-accent" : "text-foreground hover:bg-muted"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Config dropdown */}
              <div ref={configRef} className="relative">
                <button
                  onClick={() => setConfigOpen((o) => !o)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isConfigActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <ListCollapse className="w-4 h-4" />
                  Config
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${configOpen ? "rotate-180" : ""}`} />
                </button>
                {configOpen && (
                  <div className="absolute top-full left-0 mt-1 w-44 bg-popover border border-border rounded-lg shadow-lg py-1 z-50">
                    {CONFIG_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname.startsWith(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setConfigOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                            isActive ? "text-primary font-medium bg-accent" : "text-foreground hover:bg-muted"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>


          </div>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden border-t border-border px-4 py-2 flex gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
          {COLOR_STUDIO_ITEMS.map((item) => {
           const Icon = item.icon;
           const isActive = location.pathname.startsWith(item.path);
           return (
             <Link
               key={item.path}
               to={item.path}
               className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium transition-all ${
                 isActive
                   ? "bg-primary text-primary-foreground"
                   : "text-muted-foreground"
               }`}
             >
               <Icon className="w-4 h-4" />
               {item.label}
             </Link>
           );
          })}
          {CONFIG_ITEMS.map((item) => {
           const Icon = item.icon;
           const isActive = location.pathname.startsWith(item.path);
           return (
             <Link
               key={item.path}
               to={item.path}
               className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium transition-all ${
                 isActive
                   ? "bg-primary text-primary-foreground"
                   : "text-muted-foreground"
               }`}
             >
               <Icon className="w-4 h-4" />
               {item.label}
             </Link>
           );
          })
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}