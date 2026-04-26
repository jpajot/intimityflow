import { useEffect } from "react";
import { useSubNav } from "@/lib/SubNavContext";

/**
 * Call this in any page to register a sub-nav into the sidebar.
 * items: [{id, label, icon, count?}]
 * activeId: current active tab string
 * onChange: (id) => void
 */
export function useRegisterSubNav(items, activeId, onChange) {
  const { registerSubNav, clearSubNav } = useSubNav();

  useEffect(() => {
    registerSubNav({ items, activeId, onChange });
    return () => clearSubNav();
    // Re-register whenever active changes so button reflects current section
  }, [activeId, JSON.stringify(items.map((i) => ({ id: i.id, label: i.label, count: i.count })))]);
}