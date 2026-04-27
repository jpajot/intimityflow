import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PageOptionsContext = createContext(null);

export function PageOptionsProvider({ children }) {
  const [options, setOptions] = useState(null);
  const location = useLocation();

  // Clear stale options whenever the route changes
  useEffect(() => {
    setOptions(null);
  }, [location.pathname]);

  return (
    <PageOptionsContext.Provider value={{ options, setOptions }}>
      {children}
    </PageOptionsContext.Provider>
  );
}

export function usePageOptions() {
  const context = useContext(PageOptionsContext);
  if (!context) throw new Error('usePageOptions must be used within PageOptionsProvider');
  return context;
}