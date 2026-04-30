import { useEffect, useRef } from "react";
import { useSubNav } from "@/lib/SubNavContext";

const PENDING_KEY = "pendingSubNavId";

/**
 * Call this in any page to register a sub-nav into the sidebar.
 * items: [{id, label, icon, count?}]
 * activeId: current active tab string
 * onChange: (id) => void
 */
export function useRegisterSubNav(items, activeId, onChange, pageTitle) {
  const { registerSubNav, clearSubNav } = useSubNav();
  const appliedPending = useRef(false);

  useEffect(() => {
    // On first mount, check if there's a pending sub-nav ID to activate
    if (!appliedPending.current) {
      appliedPending.current = true;
      const pending = sessionStorage.getItem(PENDING_KEY);
      if (pending && items.some((i) => i.id === pending)) {
        sessionStorage.removeItem(PENDING_KEY);
        onChange(pending);
        registerSubNav({ items, activeId: pending, onChange, pageTitle });
        return;
      }
    }
    registerSubNav({ items, activeId, onChange, pageTitle });
    return () => clearSubNav();
    // Re-register whenever active changes so button reflects current section
  }, [activeId, pageTitle, JSON.stringify(items.map((i) => ({ id: i.id, label: i.label, count: i.count })))]);
}