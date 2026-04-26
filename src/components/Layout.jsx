import { useState, useEffect, useRef } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import FabricRollIcon from "./icons/FabricRollIcon";
import ProjectsIcon from "./icons/ProjectsIcon";
import StylesIcon from "./icons/StylesIcon";
import { Shirt, SwatchBook, Ruler, Menu, Settings, Pin, PinOff } from "lucide-react";

export const PINNED_ITEMS_KEY = "pinnedNavItems";
export function getPinnedItems() {
  try { return JSON.parse(localStorage.getItem(PINNED_ITEMS_KEY) || "[]"); } catch { return []; }
}
export function setPinnedItems(items) {
  localStorage.setItem(PINNED_ITEMS_KEY, JSON.stringify(items));
  import("@/api/base44Client").then(({ base44 }) => {
    base44.auth.updateMe({ pinned_nav_items: items }).catch(() => {});
  });
}

// All main nav items grouped in the drawer
const DRAWER_ITEMS = [
  { path: "/projects",    label: "Projects",        icon: ProjectsIcon },
  { path: "/list-view",   label: "Products Lists",  icon: StylesIcon },
  { path: "/materials",   label: "Materials Lists", icon: FabricRollIcon },
  { path: "/color-palettes", label: "Color Studio", icon: SwatchBook },
  { path: "/size-grid-library", label: "Size Studio", icon: Ruler },
];

function isDrawerItemActive(item, pathname) {
  if (item.path === "/color-palettes") return pathname.startsWith("/color-palettes");
  if (item.path === "/size-grid-library") return pathname.startsWith("/size-grid-library");
  return pathname === item.path || pathname.startsWith(item.path + "/");
}

export default function Layout() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pinnedItems, setPinnedItemsState] = useState(() => getPinnedItems());
  const drawerRef = useRef(null);

  // Cross-device sync for pinned items
  useEffect(() => {
    import("@/api/base44Client").then(({ base44 }) => {
      base44.auth.me().then((user) => {
        if (user?.pinned_nav_items && Array.isArray(user.pinned_nav_items)) {
          setPinnedItems(user.pinned_nav_items);
          setPinnedItemsState(user.pinned_nav_items);
        }
      }).catch(() => {});
    });
  }, []);

  useEffect(() => {
    const handler = () => setPinnedItemsState(getPinnedItems());
    window.addEventListener("storage", handler);
    window.addEventListener("pinned-items-changed", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("pinned-items-changed", handler);
    };
  }, []);

  // Close drawer on outside click
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [drawerOpen]);

  // Find active drawer item to show its icon on the drawer button
  const activeDrawerItem = DRAWER_ITEMS.find((item) => isDrawerItemActive(item, location.pathname));

  const DrawerIcon = activeDrawerItem?.icon ?? StylesIcon;

  // Mobile nav content
  const MobileNavContent = ({ onNavigate }) => (
    <nav className="space-y-0.5">
      {DRAWER_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = isDrawerItemActive(item, location.pathname);
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      {pinnedItems.length > 0 && (
        <>
          <div className="my-2 border-t border-border" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-0.5">Pinned</p>
          {pinnedItems.map((item) => (
            <div key={item.path} className="group relative">
              <Link
                to={item.path}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === item.path ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Pin className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  const updated = pinnedItems.filter((p) => p.path !== item.path);
                  setPinnedItems(updated);
                  setPinnedItemsState(updated);
                  window.dispatchEvent(new Event("pinned-items-changed"));
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-destructive text-muted-foreground transition-opacity"
                title="Unpin"
              >
                <PinOff className="w-3 h-3" />
              </button>
            </div>
          ))}
        </>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop icon-only sidebar */}
      <aside className="hidden sm:flex flex-col shrink-0 w-14 bg-transparent">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 border-b border-border shrink-0">
          <Link to="/" title="Linea">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shirt className="w-4 h-4 text-primary-foreground" />
            </div>
          </Link>
        </div>

        {/* Nav area */}
        <div className="flex-1 flex flex-col items-center py-3 gap-1 overflow-y-auto overflow-x-hidden px-2">
          {/* Drawer button — shows active item icon */}
          <div className="relative w-full" ref={drawerRef}>
            <button
              type="button"
              title={activeDrawerItem?.label ?? "Navigation"}
              onClick={() => setDrawerOpen((v) => !v)}
              className={`w-full flex items-center justify-center py-2.5 rounded-lg transition-all ${
                activeDrawerItem
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <DrawerIcon className="w-4 h-4" />
            </button>

            {/* Drawer popover — only the 5 main nav items */}
            {drawerOpen && (
              <div className="absolute left-full top-0 ml-2 z-[100] bg-popover border border-border rounded-lg shadow-xl py-1.5 min-w-[196px]">
                {DRAWER_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = isDrawerItemActive(item, location.pathname);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "text-primary bg-primary/10"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pinned items */}
          {pinnedItems.length > 0 && (
            <>
              <div className="w-full my-1 border-t border-border" />
              {pinnedItems.map((item) => {
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                return (
                  <div key={item.path} className="group relative w-full">
                    <Link
                      to={item.path}
                      title={item.label}
                      className={`w-full flex items-center justify-center py-2 rounded-lg transition-all ${
                        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </Link>
                    {/* Tooltip label on hover */}
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-popover border border-border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-sm transition-opacity">
                      {item.label}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Settings at bottom */}
        <div className="shrink-0 border-t border-border py-3 px-2 flex justify-center">
          <Link
            to="/config"
            title="Settings"
            className={`w-full flex items-center justify-center py-2.5 rounded-lg transition-all ${
              location.pathname.startsWith("/config") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Settings className="w-4 h-4" />
          </Link>
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
                  <MobileNavContent onNavigate={() => {}} />
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
    </div>
  );
}