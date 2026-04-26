import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Outlet, Link, useLocation } from "react-router-dom";
import FabricRollIcon from "./icons/FabricRollIcon";
import ProjectsIcon from "./icons/ProjectsIcon";
import StylesIcon from "./icons/StylesIcon";
import { Shirt, SwatchBook, Ruler, Settings, Pin, PinOff } from "lucide-react";
import { useSubNav } from "@/lib/SubNavContext";

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

const DRAWER_ITEMS = [
  { path: "/projects",          label: "Projects",        icon: ProjectsIcon },
  { path: "/list-view",         label: "Products Lists",  icon: StylesIcon },
  { path: "/materials",         label: "Materials Lists", icon: FabricRollIcon },
  { path: "/color-palettes",    label: "Color Studio",    icon: SwatchBook },
  { path: "/size-grid-library", label: "Size Studio",     icon: Ruler },
];

function isDrawerItemActive(item, pathname) {
  if (item.path === "/color-palettes") return pathname.startsWith("/color-palettes");
  if (item.path === "/size-grid-library") return pathname.startsWith("/size-grid-library");
  return pathname === item.path || pathname.startsWith(item.path + "/");
}

function usePopover() {
  const btnRef = useRef(null);
  const popoverRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState({});

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        setStyle({ position: "fixed", bottom: window.innerHeight - rect.top + 8, left: 16, right: 16, zIndex: 9999 });
      } else {
        setStyle({ position: "fixed", top: rect.top, left: rect.right + 8, zIndex: 9999 });
      }
    }
    setOpen((v) => !v);
  };

  return { btnRef, popoverRef, open, toggle, style, close: () => setOpen(false) };
}

export default function Layout() {
  const location = useLocation();
  const [pinnedItems, setPinnedItemsState] = useState(() => getPinnedItems());
  const { subNav } = useSubNav();

  const mainDrawer = usePopover();
  const pinnedDrawer = usePopover();
  const subNavDrawer = usePopover();

  // Cross-device sync
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
    return () => { window.removeEventListener("storage", handler); window.removeEventListener("pinned-items-changed", handler); };
  }, []);

  // Close sub-nav popover when active section changes
  useEffect(() => {
    subNavDrawer.close();
  }, [subNav?.activeId]);

  const activeDrawerItem = DRAWER_ITEMS.find((item) => isDrawerItemActive(item, location.pathname));
  const DrawerIcon = activeDrawerItem?.icon ?? StylesIcon;

  const hasPinnedActive = pinnedItems.some(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path + "/")
  );

  const unpin = (path) => {
    const updated = pinnedItems.filter((p) => p.path !== path);
    setPinnedItems(updated);
    setPinnedItemsState(updated);
    window.dispatchEvent(new Event("pinned-items-changed"));
  };

  // Sub-nav active item
  const activeSubNavItem = subNav?.items?.find((i) => i.id === subNav.activeId);
  const SubNavIcon = activeSubNavItem?.icon;

  // ── Popovers ──────────────────────────────────────────────────────────────

  const MainDrawerPopover = () => (
    <div ref={mainDrawer.popoverRef} style={mainDrawer.style}
      className="bg-popover border border-border rounded-lg shadow-xl py-1.5 min-w-[196px]">
      {DRAWER_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = isDrawerItemActive(item, location.pathname);
        return (
          <Link key={item.path} to={item.path} onClick={mainDrawer.close}
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive ? "text-primary bg-primary/10" : "text-foreground hover:bg-muted"
            }`}>
            <Icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );

  const PinnedDrawerPopover = () => (
    <div ref={pinnedDrawer.popoverRef} style={pinnedDrawer.style}
      className="bg-popover border border-border rounded-lg shadow-xl py-1.5 min-w-[196px]">
      {pinnedItems.length === 0 ? (
        <p className="px-4 py-3 text-xs text-muted-foreground">No pinned items yet.</p>
      ) : pinnedItems.map((item) => {
        const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
        return (
          <div key={item.path} className="group flex items-center">
            <Link to={item.path} onClick={pinnedDrawer.close}
              className={`flex-1 flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "text-primary bg-primary/10" : "text-foreground hover:bg-muted"
              }`}>
              <Pin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
            <button type="button" onClick={() => unpin(item.path)}
              className="pr-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity" title="Unpin">
              <PinOff className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );

  const SubNavPopover = () => {
    if (!subNav) return null;
    return (
      <div ref={subNavDrawer.popoverRef} style={subNavDrawer.style}
        className="bg-popover border border-border rounded-lg shadow-xl py-1.5 min-w-[196px]">
        {subNav.items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === subNav.activeId;
          return (
            <button key={item.id} type="button"
              onClick={() => { subNav.onChange(item.id); subNavDrawer.close(); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                isActive ? "text-primary bg-primary/10" : "text-foreground hover:bg-muted"
              }`}>
              {Icon && <Icon className="w-4 h-4 shrink-0" />}
              <span className="flex-1">{item.label}</span>
              {item.count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // ── Sidebar nav button builder ─────────────────────────────────────────────

  const NavButton = ({ popover, icon: Icon, label, isActive, tooltip, children }) => (
    <div className="group relative w-full">
      <button ref={popover.btnRef} type="button" onClick={popover.toggle}
        className={`w-full flex items-center justify-center py-2.5 rounded-lg transition-all ${
          isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}>
        <Icon className="w-4 h-4" />
      </button>
      {tooltip && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-popover border border-border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-sm transition-opacity">
          {tooltip}
        </div>
      )}
    </div>
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

          {/* Main drawer button */}
          <NavButton
            popover={mainDrawer}
            icon={DrawerIcon}
            isActive={!!activeDrawerItem}
            tooltip={activeDrawerItem?.label ?? "Navigation"}
          />

          {/* Sub-nav drawer button — only when a page has registered sub-nav */}
          {subNav && subNav.items.length > 0 && (
            <>
              <div className="w-full my-1 border-t border-border" />
              <NavButton
                popover={subNavDrawer}
                icon={SubNavIcon ?? (() => <span className="w-4 h-4 flex items-center justify-center text-xs font-bold">≡</span>)}
                isActive={!!activeSubNavItem}
                tooltip={activeSubNavItem?.label ?? "Section"}
              />
            </>
          )}

          {/* Pinned drawer button */}
          {pinnedItems.length > 0 && (
            <>
              <div className="w-full my-1 border-t border-border" />
              <NavButton
                popover={pinnedDrawer}
                icon={Pin}
                isActive={hasPinnedActive}
                tooltip={`Pinned (${pinnedItems.length})`}
              />
            </>
          )}
        </div>

        {/* Settings at bottom */}
        <div className="shrink-0 border-t border-border py-3 px-2 flex justify-center">
          <Link to="/config" title="Settings"
            className={`w-full flex items-center justify-center py-2.5 rounded-lg transition-all ${
              location.pathname.startsWith("/config") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}>
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 overflow-y-auto sm:p-4 pb-[72px] sm:pb-0">
          <Outlet />
        </main>

        {/* iOS-style bottom tab bar — mobile & tablet only */}
        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border">
          <div className="flex items-stretch h-[60px]">

            {/* Main drawer */}
            <button ref={mainDrawer.btnRef} type="button" onClick={mainDrawer.toggle}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                activeDrawerItem ? "text-primary" : "text-muted-foreground"
              }`}>
              <DrawerIcon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-medium leading-none truncate max-w-full px-0.5">
                {activeDrawerItem?.label ?? "Menu"}
              </span>
            </button>

            {/* Sub-nav drawer — only when registered */}
            {subNav && subNav.items.length > 0 && (() => {
              const MobileSubIcon = SubNavIcon;
              return (
                <button ref={subNavDrawer.btnRef} type="button" onClick={subNavDrawer.toggle}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                    activeSubNavItem ? "text-primary" : "text-muted-foreground"
                  }`}>
                  {MobileSubIcon ? <MobileSubIcon className="w-5 h-5 shrink-0" /> : <span className="text-lg font-bold leading-none">≡</span>}
                  <span className="text-[10px] font-medium leading-none truncate max-w-full px-0.5">
                    {activeSubNavItem?.label ?? "Section"}
                  </span>
                </button>
              );
            })()}

            {/* Pinned drawer */}
            <button ref={pinnedDrawer.btnRef} type="button" onClick={pinnedDrawer.toggle}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                hasPinnedActive ? "text-primary" : "text-muted-foreground"
              }`}>
              <Pin className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-medium leading-none">Pinned</span>
            </button>

            {/* Settings */}
            <Link to="/config"
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                location.pathname.startsWith("/config") ? "text-primary" : "text-muted-foreground"
              }`}>
              <Settings className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-medium leading-none">Settings</span>
            </Link>
          </div>
        </nav>
      </div>

      {/* Portals */}
      {mainDrawer.open && createPortal(<MainDrawerPopover />, document.body)}
      {pinnedDrawer.open && createPortal(<PinnedDrawerPopover />, document.body)}
      {subNavDrawer.open && createPortal(<SubNavPopover />, document.body)}
    </div>
  );
}