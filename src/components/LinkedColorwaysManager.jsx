import { useState } from "react";
import LinkedColorwaysView from "./LinkedColorwaysView";

export default function LinkedColorwaysManager({
  colorways,
  products,
  techColors,
  commColors,
  navigate,
  search,
  onSearchChange,
  projectId,
  allColorways,
  onLinked,
  onViewRef,
  activeViewId,
  onSelectView,
  quickFilters = [],
}) {
  const [view, setView] = useState("grid");
  const [activeColumns, setActiveColumns] = useState(null);

  return (
    <LinkedColorwaysView
      colorways={colorways}
      products={products}
      techColors={techColors}
      commColors={commColors}
      navigate={navigate}
      search={search}
      onSearchChange={onSearchChange}
      view={view}
      onViewChange={setView}
      activeColumns={activeColumns}
      onColumnsChange={setActiveColumns}
      projectId={projectId}
      allColorways={allColorways}
      onLinked={onLinked}
      onViewRef={onViewRef}
      activeViewId={activeViewId}
      onSelectView={onSelectView}
      quickFilters={quickFilters}
    />
  );
}