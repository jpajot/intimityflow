import { createContext, useContext, useState, useCallback } from "react";

const SubNavContext = createContext(null);

export function SubNavProvider({ children }) {
  const [subNav, setSubNav] = useState(null);
  // subNav = { items: [{id, label, icon, count}], activeId, onChange }

  const registerSubNav = useCallback((nav) => {
    setSubNav(nav);
  }, []);

  const clearSubNav = useCallback(() => {
    setSubNav(null);
  }, []);

  return (
    <SubNavContext.Provider value={{ subNav, registerSubNav, clearSubNav }}>
      {children}
    </SubNavContext.Provider>
  );
}

export function useSubNav() {
  return useContext(SubNavContext);
}