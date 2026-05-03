import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import FabricRollIcon from "./icons/FabricRollIcon";
import ProjectsIcon from "./icons/ProjectsIcon";
import StylesIcon from "./icons/StylesIcon";
import SliderIcon from "./icons/SliderIcon";
import { Shirt, SwatchBook, Ruler, Settings, Pin, PinOff, ChevronRight, ChevronDown, Building2, ClipboardList } from "lucide-react";
import { useSubNav } from "@/lib/SubNavContext";
import { usePageOptions } from "@/lib/PageOptionsContext";

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
  { path: "/suppliers",         label: "Suppliers",       icon: Building2 },
  { path: "/boms",              label: "BOMs",            icon: ClipboardList },
];

function isDrawerItemActive(item, pathname) {
  if (item.path === "/color-palettes") return pathname.startsWith("/color-palettes");
  if (item.path === "/size-grid-library") return pathname.startsWith("/size-grid-library");
  // For product detail pages, check the stored nav context to distinguish materials vs products
  if (pathname.startsWith("/products/") && pathname !== "/products/new") {
    const navContext = sessionStorage.getItem("productNavContext");
    if (item.path === "/materials") return navContext === "materials";
    if (item.path === "/list-view") return navContext !== "materials";
  }
  return pathname === item.path || pathname.startsWith(item.path + "/");
}

function usePopover() {
  const desktopBtnRef = useRef(null);
  const mobileBtnRef = useRef(null);
  const popoverRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState({});

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      // Don't close if the click is inside a Radix portal (e.g. Select dropdown)
      if (e.target.closest("[data-radix-popper-content-wrapper]")) return;
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        desktopBtnRef.current && !desktopBtnRef.current.contains(e.target) &&
        mobileBtnRef.current && !mobileBtnRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (isMobileClick = false) => {
    const ref = isMobileClick ? mobileBtnRef : desktopBtnRef;
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      if (isMobileClick) {
        setStyle({ position: "fixed", bottom: window.innerHeight - rect.top + 8, left: 16, right: 16, zIndex: 9999 });
      } else {
        const popoverHeight = 320;
        const top = Math.max(8, Math.min(rect.top, window.innerHeight - popoverHeight - 8));
        setStyle({ position: "fixed", top, left: rect.right + 8, zIndex: 9999 });
      }
    }
    setOpen((v) => !v);
  };

  return { desktopBtnRef, mobileBtnRef, popoverRef, open, toggle, style, close: () => setOpen(false) };
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [pinnedItems, setPinnedItemsState] = useState(() => getPinnedItems());
  const { subNav } = useSubNav();
  const { options } = usePageOptions();
  const mainDrawer = usePopover();
  const pinnedDrawer = usePopover();
  const subNavDrawer = usePopover();
  const optionsDrawer = usePopover();



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

  const activeDrawerItem = DRAWER_ITEMS.find((item) => isDrawerItemActive(item, location.pathname));
  const DrawerIcon = activeDrawerItem?.icon ?? StylesIcon;

  const hasPinnedActive = pinnedItems.some((item) => {
    const pathMatch = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
    if (!pathMatch) return false;
    if (item.subNavId && subNav) return item.subNavId === subNav.activeId;
    return pathMatch;
  });

  const unpin = (key) => {
    const updated = pinnedItems.filter((p) => (p.subNavId ? `${p.path}#${p.subNavId}` : p.path) !== key);
    setPinnedItems(updated);
    setPinnedItemsState(updated);
    window.dispatchEvent(new Event("pinned-items-changed"));
  };

  const pinSubNavItem = (item) => {
    const current = getPinnedItems();
    const key = `${location.pathname}#${item.id}`;
    const alreadyPinned = current.some((p) => p.subNavId === item.id && p.path === location.pathname);
    let updated;
    if (alreadyPinned) {
      updated = current.filter((p) => !(p.subNavId === item.id && p.path === location.pathname));
    } else {
      if (current.length >= 6) return;
      // Use the page's own title (e.g. project name) if available, otherwise fall back to drawer label
      const pageLabel = subNav?.pageTitle || DRAWER_ITEMS.find((d) => isDrawerItemActive(d, location.pathname))?.label || location.pathname.split("/").filter(Boolean).pop() || "Page";
      updated = [...current, { path: location.pathname, label: `${pageLabel} › ${item.label}`, subNavId: item.id }];
    }
    setPinnedItems(updated);
    setPinnedItemsState(updated);
    window.dispatchEvent(new Event("pinned-items-changed"));
  };

  // Sub-nav active item
  const activeSubNavItem = subNav?.items?.find((i) => i.id === subNav.activeId);
  const SubNavIcon = activeSubNavItem?.icon;

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

          {/* Pinned drawer button — first position */}
          {pinnedItems.length > 0 && (
            <button ref={pinnedDrawer.desktopBtnRef} type="button" onClick={() => pinnedDrawer.toggle(false)}
              className={`w-full flex items-center justify-center py-2.5 rounded-lg transition-all relative hover:bg-muted ${
                hasPinnedActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Pin className="w-5 h-5 shrink-0" />
              <ChevronRight className="absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 opacity-40" />
            </button>
          )}

          {pinnedItems.length > 0 && (
            <div className="w-full my-0.5 border-t border-border" />
          )}

          {/* Main drawer button */}
          <button ref={mainDrawer.desktopBtnRef} type="button" onClick={() => mainDrawer.toggle(false)}
            className={`w-full flex items-center justify-center py-2.5 rounded-lg transition-all relative hover:bg-muted ${
              activeDrawerItem ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}>
            <DrawerIcon className="w-5 h-5 shrink-0" />
            <ChevronRight className="absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 opacity-40" />
          </button>

          {/* Sub-nav drawer button — only when a page has registered sub-nav */}
          {subNav && subNav.items.length > 0 && (
            <>
              <div className="w-full my-0.5 border-t border-border" />
              {/* Down arrow to indicate this is a child of the main drawer */}
              <div className="flex justify-center w-full">
                <ChevronDown className="w-2.5 h-2.5 text-muted-foreground/40" />
              </div>
              <button ref={subNavDrawer.desktopBtnRef} type="button" onClick={() => subNavDrawer.toggle(false)}
                className={`w-full flex items-center justify-center py-2.5 rounded-lg transition-all relative hover:bg-muted ${
                  activeSubNavItem ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}>
                {SubNavIcon ? <SubNavIcon className="w-5 h-5 shrink-0" /> : <span className="w-5 h-5 flex items-center justify-center text-xs font-bold">≡</span>}
                <ChevronRight className="absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 opacity-40" />
              </button>
            </>
          )}

          {/* More Options drawer button — last position */}
          {options && (
            <>
              <div className="w-full my-0.5 border-t border-border" />
              <button ref={optionsDrawer.desktopBtnRef} type="button" onClick={() => optionsDrawer.toggle(false)}
                className="w-full flex items-center justify-center py-2.5 rounded-lg transition-all relative hover:bg-muted text-muted-foreground hover:text-foreground">
                <SliderIcon className="w-5 h-5 shrink-0" />
                <ChevronRight className="absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 opacity-40" />
                {options.items?.some((item) => item.badge) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
            </>
          )}
          </div>

        {/* Settings at bottom */}
        <div className="shrink-0 border-t border-border py-3 px-2 flex justify-center">
          <Link to="/config" title="Settings"
            className={`w-full flex items-center justify-center py-2.5 rounded-lg transition-all hover:bg-muted ${
              location.pathname.startsWith("/config") ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}>
            <Settings className="w-5 h-5" />
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

              {/* Pinned drawer — first position */}
            <button ref={pinnedDrawer.mobileBtnRef} type="button" onClick={() => pinnedDrawer.toggle(true)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                hasPinnedActive ? "text-primary" : "text-muted-foreground"
              }`}>
              <div className="relative">
                <Pin className="w-5 h-5 shrink-0" />
                <ChevronRight className="absolute -right-2 -top-1 w-2.5 h-2.5 opacity-40" />
              </div>
              <span className="text-[10px] font-medium leading-none">Pinned</span>
            </button>

            {/* Main drawer */}
            <button ref={mainDrawer.mobileBtnRef} type="button" onClick={() => mainDrawer.toggle(true)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                activeDrawerItem ? "text-primary" : "text-muted-foreground"
              }`}>
              <div className="relative">
                <DrawerIcon className="w-5 h-5 shrink-0" />
                <ChevronRight className="absolute -right-2 -top-1 w-2.5 h-2.5 opacity-40" />
              </div>
              <span className="text-[10px] font-medium leading-none truncate max-w-full px-0.5">
                {activeDrawerItem?.label ?? "Menu"}
              </span>
            </button>

            {/* Sub-nav drawer — only when registered */}
            {subNav && subNav.items.length > 0 && (() => {
              const MobileSubIcon = SubNavIcon;
              return (
                <button ref={subNavDrawer.mobileBtnRef} type="button" onClick={() => subNavDrawer.toggle(true)}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                    activeSubNavItem ? "text-primary" : "text-muted-foreground"
                  }`}>
                  <div className="relative">
                    {MobileSubIcon ? <MobileSubIcon className="w-5 h-5 shrink-0" /> : <span className="text-lg font-bold leading-none">≡</span>}
                    <ChevronRight className="absolute -right-2 -top-1 w-2.5 h-2.5 opacity-40" />
                  </div>
                  <span className="text-[10px] font-medium leading-none truncate max-w-full px-0.5">
                    {activeSubNavItem?.label ?? "Section"}
                  </span>
                </button>
              );
            })()}

            {/* More Options — last position */}
             {options && (
               <button ref={optionsDrawer.mobileBtnRef} type="button" onClick={() => optionsDrawer.toggle(true)}
                 className="flex-1 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors text-muted-foreground">
                 <div className="relative">
                   <SliderIcon className="w-5 h-5 shrink-0" />
                   <ChevronRight className="absolute -right-2 -top-1 w-2.5 h-2.5 opacity-40" />
                   {options.items?.some((item) => item.badge) && (
                     <span className="absolute -top-1 -right-2.5 w-2 h-2 rounded-full bg-red-500" />
                   )}
                 </div>
                 <span className="text-[10px] font-medium leading-none">Options</span>
               </button>
             )}

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
       {mainDrawer.open && createPortal(
         <div ref={mainDrawer.popoverRef} style={mainDrawer.style}
           className="bg-popover border border-border rounded-lg shadow-xl py-1.5 min-w-[210px]">
           <p className="px-4 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-border mb-1">Navigate to</p>
           {DRAWER_ITEMS.map((item) => {
             const Icon = item.icon;
             const isActive = isDrawerItemActive(item, location.pathname);
             return (
               <Link key={item.path} to={item.path} onClick={mainDrawer.close}
                 className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${isActive ? "text-primary bg-primary/10" : "text-foreground hover:bg-muted"}`}>
                 <Icon className="w-4 h-4 shrink-0" />
                 <span>{item.label}</span>
               </Link>
             );
           })}
         </div>,
         document.body
       )}

       {pinnedDrawer.open && createPortal(
         <div ref={pinnedDrawer.popoverRef} style={pinnedDrawer.style}
           className="bg-popover border border-border rounded-lg shadow-xl py-1.5 min-w-[210px]">
           {pinnedItems.length === 0 ? (
             <p className="px-4 py-3 text-xs text-muted-foreground">No pinned items yet.</p>
           ) : pinnedItems.map((item) => {
             const key = item.subNavId ? `${item.path}#${item.subNavId}` : item.path;
             const pathMatch = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
             const isActive = pathMatch && (!item.subNavId || item.subNavId === subNav?.activeId);
             const handleClick = () => {
               pinnedDrawer.close();
               if (item.subNavId) {
                 const alreadyOnPage = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                 if (alreadyOnPage && subNav) {
                   subNav.onChange(item.subNavId);
                 } else {
                   // Store pending sub-nav ID in sessionStorage so the page picks it up on mount
                   sessionStorage.setItem("pendingSubNavId", item.subNavId);
                   navigate(item.path);
                 }
               }
             };
             return (
               <div key={key} className="group flex items-center">
                 {item.subNavId ? (
                   <button type="button" onClick={handleClick}
                     className={`flex-1 flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left ${isActive ? "text-primary bg-primary/10" : "text-foreground hover:bg-muted"}`}>
                     <Pin className="w-3.5 h-3.5 shrink-0" />
                     <span className="truncate">{item.label}</span>
                   </button>
                 ) : (
                   <Link to={item.path} onClick={pinnedDrawer.close}
                     className={`flex-1 flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${isActive ? "text-primary bg-primary/10" : "text-foreground hover:bg-muted"}`}>
                     <Pin className="w-3.5 h-3.5 shrink-0" />
                     <span className="truncate">{item.label}</span>
                   </Link>
                 )}
                 <button type="button" onClick={() => unpin(key)}
                   className="pr-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity" title="Unpin">
                   <PinOff className="w-3.5 h-3.5" />
                 </button>
               </div>
             );
           })}
         </div>,
         document.body
       )}

       {subNavDrawer.open && subNav && createPortal(
         <div ref={subNavDrawer.popoverRef} style={subNavDrawer.style}
           className="bg-popover border border-border rounded-lg shadow-xl py-1.5 min-w-[230px]">
           <div className="px-4 pb-1.5 pt-0.5 border-b border-border mb-1">
             <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
               <span className="font-semibold text-foreground/70">{activeDrawerItem?.label ?? "Current"}</span>
               <ChevronRight className="w-3 h-3" />
               <span className="uppercase tracking-widest font-semibold">Sections</span>
             </div>
           </div>
           {subNav.items.map((item) => {
             const Icon = item.icon;
             const isActive = item.id === subNav.activeId;
             const isPinnedItem = pinnedItems.some((p) => p.subNavId === item.id && p.path === location.pathname);
             return (
               <div key={item.id} className="group flex items-center">
                 <button type="button"
                   onClick={() => { subNav.onChange(item.id); subNavDrawer.close(); }}
                   className={`flex-1 flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left ${isActive ? "text-primary bg-primary/10" : "text-foreground hover:bg-muted"}`}>
                   {Icon && <Icon className="w-4 h-4 shrink-0" />}
                   <span className="flex-1">{item.label}</span>
                   {item.count !== undefined && (
                     <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{item.count}</span>
                   )}
                 </button>
                 <button type="button" onClick={() => pinSubNavItem(item)}
                   title={isPinnedItem ? "Unpin" : "Pin to sidebar"}
                   className={`pr-3 transition-all ${isPinnedItem ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"}`}>
                   {isPinnedItem ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                 </button>
               </div>
             );
           })}
         </div>,
         document.body
       )}

       {optionsDrawer.open && options && createPortal(
         <div ref={optionsDrawer.popoverRef} style={{ ...optionsDrawer.style, zIndex: 10000 }}
           className="bg-popover border border-border rounded-lg shadow-xl py-1.5 min-w-[240px] max-h-[80vh] overflow-visible">
           <p className="px-4 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-border mb-1">Options</p>
           {options.items && options.items.map((item, idx) => (
             <div key={idx}>
               {item.divider ? (
                 <div className="my-1 border-t border-border" />
               ) : (
                 <button type="button" onClick={() => { item.onClick?.(); if (!item.custom) optionsDrawer.close(); }}
                   className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left ${item.className || "text-foreground hover:bg-muted"}`}>
                   {item.icon && <item.icon className="w-4 h-4 shrink-0 text-muted-foreground" />}
                   <span className="flex-1">{item.label}</span>
                   {item.badge && (
                     <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{item.badge}</span>
                   )}
                 </button>
               )}
             </div>
           ))}
           {options.customContent && (
             <div className="px-4 py-3 border-t border-border">
               {typeof options.customContent === 'function' ? options.customContent() : options.customContent}
             </div>
           )}
         </div>,
         document.body
       )}
      </div>
      );
      }