# VALIDATION REPORT — Phase 5 Prompt #24
## RevisionHistoryPanel Restructure: Grouped-by-Target Hierarchical View

---

## WHAT WAS DONE

### Problem
The `RevisionHistoryPanel` was a flat chronological list of all revisions (newest-first), mixing Product-level and ProductColor-level revisions together. Users couldn't easily see "where am I now?" for a specific target, or browse sibling targets without a dropdown filter.

### Solution: Hierarchical Grouped-by-Target Layout

The panel was completely rewritten into a two-section structure:

```
Panel Header
├─ Title: "Revision History"
├─ "Hide non-ECO revisions" checkbox
└─ "New Revision" button

CURRENT  (focal target — expanded by default)
├─ RevisionGroupHeader card (green-tinted)
│   ├─ Type label (PRODUCT / COLOR)
│   ├─ Target name
│   ├─ Current revision letter badge (large, green)
│   ├─ Context + metadata
│   └─ Linked ECO badges (clickable → /change-management/ecos/:id)
└─ REVISION HISTORY (prior revisions, most recent expanded)
    ├─ [▾] Rev M — context snippet — ECO badge (expanded by default)
    ├─ [▸] Rev L
    ├─ [▸] Rev K
    └─ ...

OTHER TARGETS (siblings — all collapsed by default)
├─ [▸] PRODUCT TST BUTTON — Rev A — 1 rev
├─ [▸] COLOR Pastel Yellow — Rev N — 14 revs
└─ [▸] COLOR Antique White — Rev C — 3 revs
    (expand → same structure as CURRENT section)
```

---

## FILES MODIFIED / CREATED

### Rewritten
- **`components/revisions/RevisionHistoryPanel.jsx`**
  - Removed: flat list, type filter dropdown, dedicated ECO-only toggle row
  - Added: CURRENT section with `RevisionGroupHeader` + `RevisionRow` list
  - Added: OTHER TARGETS section with independent `expandedSiblings` state per group
  - Data fetch: batched (2 ProductRevision queries + 1 ECOAffectedItem + 1 ECO batch)
  - Focal target resolved from `initialTargetType` + `initialTargetId` props (works from BOM matrix badge click AND from Product detail (i) icon)

### New Components
- **`components/revisions/RevisionGroupHeader.jsx`**
  - Green-tinted card showing current revision for a target
  - Large revision letter badge, type label, target name, context, metadata, ECO badges

- **`components/revisions/RevisionRow.jsx`**
  - Expandable row for prior (non-current) revisions
  - Collapsed: letter + context snippet + timestamp + ECO indicator
  - Expanded: full context, field diffs, metadata grid, ECO badge links

- **`components/revisions/SiblingGroupHeader.jsx`**
  - Collapsible header for OTHER TARGETS entries
  - Shows type label, target name, revision count, current revision letter

---

## BUG FIX (This Session)

**Root Cause:** Previous write operations targeted `src/components/revisions/RevisionHistoryPanel.jsx` (wrong path). The actual file at `components/revisions/RevisionHistoryPanel.jsx` was never updated, so the old flat-list UI was still being rendered.

**Fix:** Overwrote the correct file path directly, replacing the old implementation with the new hierarchical one. Also created the 3 new sub-components at the correct paths.

---

## KEY BEHAVIOURS

| Behaviour | Details |
|---|---|
| Focal target | Resolved from `initialTargetType` + `initialTargetId` — works from BOM matrix badge (product_color) and Product detail (i) icon (product) |
| CURRENT section | Always shown expanded at top; green-tinted card + prior rev rows |
| OTHER TARGETS | All siblings collapsed; each expands independently |
| ECO filter | "Hide non-ECO revisions" checkbox; applies to both sections |
| ECO badges | Inline on RevisionGroupHeader and RevisionRow; click → ECO detail page |
| Most recent prior | First RevisionRow is `defaultExpanded=true` |
| No regressions | NewRevisionModal, subscription, product fetch all intact |
| Data efficiency | 4 batched queries on panel open (no N+1) |

---

## NO BACKEND / SCHEMA CHANGES
All changes are frontend only.