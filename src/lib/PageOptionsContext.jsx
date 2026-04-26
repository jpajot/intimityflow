import { createContext, useContext, useState } from 'react';

const PageOptionsContext = createContext(null);

export function PageOptionsProvider({ children }) {
  const [options, setOptions] = useState(null);

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