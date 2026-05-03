/**
 * BOMQuickFilters — utility exports for quick-filter logic used by BOMDetail and BOMOptionsContent.
 *
 * DEFAULT_QUICK_FILTERS  — initial/empty filter state
 * applyQuickFilters      — filters axis members based on active filter state
 * isFilterActive         — returns true when any filter is set
 */

export const DEFAULT_QUICK_FILTERS = {
  project_id: null,       // filter colorways by project membership
  colorway_status: null,  // filter colorways by status
  tech_color_ids: [],     // filter colorways that have at least one of these TCX IDs linked
  supplier_ids: [],       // (future) filter lines by supplier
};

export function isFilterActive(filters) {
  if (!filters) return false;
  return (
    !!filters.project_id ||
    !!filters.colorway_status ||
    (filters.tech_color_ids?.length > 0) ||
    (filters.supplier_ids?.length > 0)
  );
}

/**
 * Returns filtered versions of each axis array.
 * Filtering is AND-based: a colorway must pass all active filters to be included.
 */
export function applyQuickFilters(filters, { colorVariants, styleSizes, colorAndMores, allSizes, techColors, commColors, allProducts }) {
  if (!filters || !isFilterActive(filters)) {
    return { filteredColors: colorVariants, filteredSizes: styleSizes, filteredColorAndMores: colorAndMores };
  }

  let filteredColors = colorVariants;

  // Filter by project membership
  if (filters.project_id) {
    filteredColors = filteredColors.filter(
      (cw) => cw.project_ids?.includes(filters.project_id) || cw.creation_project_id === filters.project_id
    );
  }

  // Filter by colorway status
  if (filters.colorway_status) {
    filteredColors = filteredColors.filter(
      (cw) => (cw.colorway_status || "approved") === filters.colorway_status
    );
  }

  // Filter by linked TechnicalColor IDs (colorway must link to at least one)
  if (filters.tech_color_ids?.length > 0) {
    filteredColors = filteredColors.filter(
      (cw) => cw.linked_tech_color_id && filters.tech_color_ids.includes(cw.linked_tech_color_id)
    );
  }

  // Sizes and ColorAndMores are not filtered by quick filters (only colorways are columnar)
  return {
    filteredColors,
    filteredSizes: styleSizes,
    filteredColorAndMores: colorAndMores,
  };
}