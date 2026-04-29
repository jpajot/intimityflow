import { useState } from "react";

const PREFIX = "qf_";

function load(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(key, filters) {
  // Strip non-serialisable getValue functions before persisting
  const serialisable = filters.map(({ getValue, ...rest }) => rest);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(serialisable));
  } catch {}
}

/**
 * Like useState for quick filters, but backed by localStorage.
 * `key` should be a stable unique string per section (e.g. "styles_listview").
 * Returns [filters, setAndPersistFilters, clearFilters]
 */
export function usePersistedQuickFilters(key) {
  const [filters, setFilters] = useState(() => load(key));

  const set = (newFilters) => {
    setFilters(newFilters);
    save(key, newFilters);
  };

  const clear = () => {
    setFilters([]);
    try { localStorage.removeItem(PREFIX + key); } catch {}
  };

  return [filters, set, clear];
}