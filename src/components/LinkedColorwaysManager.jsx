import LinkedColorwaysView from "./LinkedColorwaysView";

export default function LinkedColorwaysManager({
  colorways,
  products,
  techColors,
  commColors,
  navigate,
  search,
  onSearchChange,
  view,
  onViewChange,
  activeColumns,
  onColumnsChange,
  projectId,
  allColorways,
  onLinked,
}) {
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
      onViewChange={onViewChange}
      activeColumns={activeColumns}
      onColumnsChange={onColumnsChange}
      projectId={projectId}
      allColorways={allColorways}
      onLinked={onLinked}
    />
  );
}