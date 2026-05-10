import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, ArrowUp, ArrowDown, Settings2, Search, Layers, X, Pin, PinOff } from "lucide-react";

// Context menu component
function ColContextMenu({ x, y, colLabel, onGroup, onPin, isPinned, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top: y, left: x, zIndex: 9999 }}
      className="bg-popover border border-border rounded-md shadow-lg py-1 min-w-[180px]"
    >
      <button
        type="button"
        onClick={() => { onGroup(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
      >
        <Layers className="w-3.5 h-3.5 text-muted-foreground" />
        Group by <span className="font-medium ml-1">{colLabel}</span>
      </button>
      <button
        type="button"
        onClick={() => { onPin(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
      >
        {isPinned ? <PinOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Pin className="w-3.5 h-3.5 text-muted-foreground" />}
        {isPinned ? "Unpin column" : "Pin column"}
      </button>
    </div>
  );
}

export default function DataTable({ columns, rows, fixedColumns = [], groupOptions = [], getGroupKey = null, filterFields = [], onEdit = null, hideColumnToggle = false, onPinColumn = null }) {
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [visibleCols, setVisibleCols] = useState(new Set(columns.map((c) => c.id)));
  const [filterText, setFilterText] = useState("");
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [draggingFrom, setDraggingFrom] = useState(null);
  // Internal grouping state
  const [groupCols, setGroupCols] = useState([]); // up to 3 col IDs
  const [contextMenu, setContextMenu] = useState(null); // { x, y, colId, colLabel }

  useEffect(() => {
    setVisibleCols(new Set(columns.map((c) => c.id)));
  }, [columns]);

  const handleSort = (colId) => {
    if (sortBy === colId) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(colId); setSortDir("asc"); }
  };

  const toggleCol = (colId) => {
    setVisibleCols((prev) => { const next = new Set(prev); next.has(colId) ? next.delete(colId) : next.add(colId); return next; });
  };

  const filteredRows = useMemo(() => {
    if (!filterText || filterFields.length === 0) return rows;
    const lower = filterText.toLowerCase();
    return rows.filter((row) => filterFields.some((field) => field.getValue(row)?.toString().toLowerCase().includes(lower)));
  }, [rows, filterText, filterFields]);

  const sortedRows = useMemo(() => {
    if (!sortBy) return filteredRows;
    const col = columns.find((c) => c.id === sortBy);
    if (!col?.sortKey) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const aVal = col.sortKey(a); const bVal = col.sortKey(b);
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortBy, sortDir, columns]);

  // Build nested groups from groupCols (internal) or legacy getGroupKey
  const groups = useMemo(() => {
    if (groupCols.length > 0) {
      return buildNestedGroups(sortedRows, groupCols, columns);
    }
    if (!getGroupKey) return [{ key: "all", label: null, items: sortedRows }];
    // legacy external groupBy kept for backward compat
    const map = {};
    for (const v of sortedRows) {
      const k = getGroupKey(v, groupOptions[0]?.value || "none");
      if (!map[k]) map[k] = { key: k, label: k, items: [] };
      map[k].items.push(v);
    }
    return Object.values(map);
  }, [sortedRows, groupCols, columns, getGroupKey]);

  const allGroupKeys = useMemo(() => collectGroupKeys(groups), [groups]);

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };

  const toggleAllGroups = () => {
    if (expandedGroups.size === allGroupKeys.length) setExpandedGroups(new Set());
    else setExpandedGroups(new Set(allGroupKeys));
  };

  const addGroupCol = (colId) => {
    setGroupCols((prev) => {
      if (prev.includes(colId) || prev.length >= 3) return prev;
      return [...prev, colId];
    });
    setExpandedGroups(new Set());
  };

  const removeGroupCol = (colId) => {
    setGroupCols((prev) => prev.filter((id) => id !== colId));
    setExpandedGroups(new Set());
  };

  const clearGroups = () => { setGroupCols([]); setExpandedGroups(new Set()); };

  // Long-press for tablets
  const longPressTimer = useRef(null);
  const handleHeaderPointerDown = useCallback((e, col) => {
    if (!col.sortKey && !col.id) return;
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ x: e.clientX, y: e.clientY, colId: col.id, colLabel: col.label });
    }, 600);
  }, []);
  const handleHeaderPointerUp = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);
  const handleHeaderContextMenu = useCallback((e, col) => {
    e.preventDefault();
    clearTimeout(longPressTimer.current);
    setContextMenu({ x: e.clientX, y: e.clientY, colId: col.id, colLabel: col.label });
  }, []);

  const visibleColumns = columns.filter((c) => visibleCols.has(c.id));
  const fixedCols = visibleColumns.filter((c) => fixedColumns.includes(c.id));
  const scrollableCols = visibleColumns.filter((c) => !fixedColumns.includes(c.id));
  const isGrouped = groupCols.length > 0;

  const headerProps = (col) => ({
    onContextMenu: (e) => handleHeaderContextMenu(e, col),
    onPointerDown: (e) => handleHeaderPointerDown(e, col),
    onPointerUp: handleHeaderPointerUp,
    onPointerLeave: handleHeaderPointerUp,
  });

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap">
          {filterFields.length > 0 && (
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Filter…" className="pl-8 h-8 text-xs w-full sm:w-48" />
            </div>
          )}
        </div>
        
      </div>

      {/* Active grouping pills */}
      {groupCols.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Grouped by:</span>
          {groupCols.map((id, idx) => {
            const col = columns.find((c) => c.id === id);
            return (
              <div key={id} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full border border-primary/20">
                {idx > 0 && <span className="text-muted-foreground mr-1">›</span>}
                {col?.label}
                <button type="button" onClick={() => removeGroupCol(id)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
              </div>
            );
          })}
          <button type="button" onClick={clearGroups} className="text-xs text-muted-foreground hover:text-destructive underline-offset-2 hover:underline">Clear all</button>
          <Button type="button" variant="outline" size="sm" onClick={toggleAllGroups} className="h-7 text-xs ml-auto">
            {expandedGroups.size === allGroupKeys.length ? "Collapse All" : "Expand All"}
          </Button>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ColContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          colLabel={contextMenu.colLabel}
          onGroup={() => addGroupCol(contextMenu.colId)}
          onPin={() => onPinColumn && onPinColumn(contextMenu.colId)}
          isPinned={fixedColumns.includes(contextMenu.colId)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Table */}
      {isGrouped ? (
        <div className="space-y-2">
          {renderGroupTree(groups, visibleColumns, fixedCols, scrollableCols, sortBy, sortDir, handleSort, onEdit, editingCell, setEditingCell, editValue, setEditValue, expandedGroups, toggleGroup, headerProps)}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <TableContent
            columns={visibleColumns} fixedCols={fixedCols} scrollableCols={scrollableCols}
            rows={sortedRows} handleSort={handleSort} sortBy={sortBy} sortDir={sortDir}
            onEdit={onEdit} editingCell={editingCell} setEditingCell={setEditingCell}
            editValue={editValue} setEditValue={setEditValue} headerProps={headerProps}
          />
        </div>
      )}
    </div>
  );
}

// ---- Grouping helpers ----
function buildNestedGroups(rows, groupCols, columns, depth = 0) {
  if (depth >= groupCols.length) return rows;
  const col = columns.find((c) => c.id === groupCols[depth]);
  const getKey = col?.sortKey || ((r) => r[groupCols[depth]] || "—");
  const map = {};
  for (const row of rows) {
    const k = getKey(row) || "—";
    if (!map[k]) map[k] = [];
    map[k].push(row);
  }
  return Object.entries(map).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([key, items]) => ({
    key: `${depth}-${key}`,
    label: key,
    depth,
    items: depth + 1 < groupCols.length ? null : items,
    children: depth + 1 < groupCols.length ? buildNestedGroups(items, groupCols, columns, depth + 1) : null,
  }));
}

function collectGroupKeys(groups) {
  const keys = [];
  for (const g of groups) {
    if (g.label) { keys.push(g.key); if (g.children) keys.push(...collectGroupKeys(g.children)); }
  }
  return keys;
}

function renderGroupTree(groups, columns, fixedCols, scrollableCols, sortBy, sortDir, handleSort, onEdit, editingCell, setEditingCell, editValue, setEditValue, expandedGroups, toggleGroup, headerProps, depth = 0) {
  return groups.map((group) => {
    if (!group.label) {
      return (
        <div key="all" className="rounded-xl border border-border overflow-hidden">
          <TableContent columns={columns} fixedCols={fixedCols} scrollableCols={scrollableCols} rows={group.items || []} handleSort={handleSort} sortBy={sortBy} sortDir={sortDir} onEdit={onEdit} editingCell={editingCell} setEditingCell={setEditingCell} editValue={editValue} setEditValue={setEditValue} headerProps={headerProps} />
        </div>
      );
    }
    const isExpanded = expandedGroups.has(group.key);
    const count = group.items ? group.items.length : countLeaves(group.children || []);
    const indent = depth * 12;
    return (
      <div key={group.key} className="rounded-xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => toggleGroup(group.key)}
          className="w-full px-4 py-2 bg-muted/60 border-b border-border hover:bg-muted/80 transition-colors flex items-center justify-between"
          style={{ paddingLeft: 16 + indent }}
        >
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label} ({count})</span>
          <span className="text-sm font-semibold text-muted-foreground">{isExpanded ? "−" : "+"}</span>
        </button>
        {isExpanded && (
          group.children
            ? <div className="space-y-2 p-2">{renderGroupTree(group.children, columns, fixedCols, scrollableCols, sortBy, sortDir, handleSort, onEdit, editingCell, setEditingCell, editValue, setEditValue, expandedGroups, toggleGroup, headerProps, depth + 1)}</div>
            : <TableContent columns={columns} fixedCols={fixedCols} scrollableCols={scrollableCols} rows={group.items || []} handleSort={handleSort} sortBy={sortBy} sortDir={sortDir} onEdit={onEdit} editingCell={editingCell} setEditingCell={setEditingCell} editValue={editValue} setEditValue={setEditValue} headerProps={headerProps} />
        )}
      </div>
    );
  });
}

function countLeaves(groups) {
  return groups.reduce((sum, g) => sum + (g.items ? g.items.length : countLeaves(g.children || [])), 0);
}

function SortHeader({ col, sortBy, sortDir, onSort }) {
  return col.sortKey ? (
    <button type="button" onClick={onSort} className="flex items-center gap-1 hover:text-foreground transition-colors select-none">
      {col.label}
      {sortBy === col.id ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
    </button>
  ) : col.label;
}

function EditableCell({ col, row, rowIdx, allRows, editingCell, setEditingCell, editValue, setEditValue, onEdit, draggingFrom, setDraggingFrom }) {
  const isEditing = editingCell === `${row.id}-${col.id}`;
  const cellKey = `${row.id}-${col.id}`;
  const isDragging = draggingFrom?.colId === col.id;
  const dragHandleRef = React.useRef(null);
  
  if (!col.editable || !onEdit) {
    return <td className="px-4 py-3 text-sm" style={{ width: col.width }}>{col.render ? col.render(row) : "—"}</td>;
  }
  
  const handleStart = () => { setEditingCell(cellKey); setEditValue(col.getDisplayValue(row)); };
  const handleSave = async () => { await onEdit(row.id, col.entityField, editValue, col.entityType, col.getValue(row)); setEditingCell(null); };
  
  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'copy';
    setDraggingFrom({ colId: col.id, value: col.getDisplayValue(row), rowIdx });
  };
  
  const handleDragEnter = () => {
    if (draggingFrom?.colId === col.id && draggingFrom.rowIdx !== rowIdx) {
      onEdit(row.id, col.entityField, draggingFrom.value, col.entityType, draggingFrom.value);
    }
  };
  
  const handleDragEnd = () => {
    setDraggingFrom(null);
  };
  
  return (
    <td 
      className={`px-4 py-3 text-sm relative ${isDragging ? 'bg-primary/20' : ''}`} 
      style={{ width: col.width }} 
      onClick={handleStart}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
    >
      {isEditing ? (
        col.options ? (
          <Select value={editValue} onValueChange={async (val) => { setEditValue(val); await onEdit(row.id, col.entityField, val, col.entityType, val); setEditingCell(null); }}>
            <SelectTrigger className="h-6 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{col.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <Input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditingCell(null); }} className="h-6 text-xs" />
        )
      ) : (
        <div className="group hover:bg-muted/50 px-2 py-1 rounded flex items-center justify-between cursor-text">
          <span>{col.render(row)}</span>
          <div 
            ref={dragHandleRef}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className="opacity-0 group-hover:opacity-100 transition-opacity cursor-move ml-1 text-muted-foreground hover:text-foreground"
            title="Drag to fill"
          >
            ⋮
          </div>
        </div>
      )}
    </td>
  );
}

function ResizeHandle({ colId, onResize }) {
  const startX = useRef(null);

  const startResize = (clientX) => {
    startX.current = clientX;
    const onMove = (e) => {
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      onResize(colId, x - startX.current);
      startX.current = x;
    };
    const onEnd = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
  };

  return (
    <div
      className="absolute top-0 right-0 h-full w-3 cursor-col-resize flex items-center justify-center group/resize z-20"
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(e.clientX); }}
      onTouchStart={(e) => { e.stopPropagation(); startResize(e.touches[0].clientX); }}
    >
      <div className="w-0.5 h-4 bg-border group-hover/resize:bg-primary transition-colors rounded-full" />
    </div>
  );
}

function TableContent({ columns, fixedCols, scrollableCols, rows, handleSort, sortBy, sortDir, onEdit, editingCell, setEditingCell, editValue, setEditValue, headerProps }) {
  const [draggingFrom, setDraggingFrom] = useState(null);
  const [colWidths, setColWidths] = useState({});

  const getWidth = (col) => colWidths[col.id] ?? col.width ?? 120;

  const handleResize = useCallback((colId, delta) => {
    setColWidths((prev) => {
      const col = [...fixedCols, ...scrollableCols].find((c) => c.id === colId);
      const current = prev[colId] ?? col?.width ?? 120;
      return { ...prev, [colId]: Math.max(50, current + delta) };
    });
  }, [fixedCols, scrollableCols]);

  // Compute cumulative left offsets for sticky columns
  const fixedOffsets = useMemo(() => {
    const offsets = [];
    let acc = 0;
    for (const col of fixedCols) {
      offsets.push(acc);
      acc += getWidth(col);
    }
    return offsets;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedCols, colWidths]);

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-20">
          <tr className="border-b border-border bg-muted/40">
            {fixedCols.map((col, i) => (
              <th key={col.id} className="relative text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground sticky bg-muted/40 z-30 cursor-context-menu select-none border-r border-border/60" style={{ width: getWidth(col), minWidth: getWidth(col), left: fixedOffsets[i] }} {...(headerProps ? headerProps(col) : {})}>
                <SortHeader col={col} sortBy={sortBy} sortDir={sortDir} onSort={() => handleSort(col.id)} />
                <ResizeHandle colId={col.id} onResize={handleResize} />
              </th>
            ))}
            {scrollableCols.map((col) => (
              <th key={col.id} className="relative text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground cursor-context-menu select-none" style={{ width: getWidth(col), minWidth: getWidth(col) }} {...(headerProps ? headerProps(col) : {})}>
                <SortHeader col={col} sortBy={sortBy} sortDir={sortDir} onSort={() => handleSort(col.id)} />
                <ResizeHandle colId={col.id} onResize={handleResize} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
              {fixedCols.map((col, i) => (
                <td key={col.id} className="px-4 py-3 text-sm sticky bg-card border-r border-border/60 z-[5]" style={{ left: fixedOffsets[i], width: getWidth(col), minWidth: getWidth(col) }}>
                  {col.render ? col.render(row) : "—"}
                </td>
              ))}
              {scrollableCols.map((col) => <EditableCell key={col.id} col={col} row={row} rowIdx={rowIdx} allRows={rows} editingCell={editingCell} setEditingCell={setEditingCell} editValue={editValue} setEditValue={setEditValue} onEdit={onEdit} draggingFrom={draggingFrom} setDraggingFrom={setDraggingFrom} />)}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={fixedCols.length + scrollableCols.length} className="px-4 py-8 text-center text-sm text-muted-foreground">No items found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}