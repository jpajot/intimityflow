import { useState, useMemo } from "react";
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
import { ArrowUpDown, ArrowUp, ArrowDown, Settings2, Search } from "lucide-react";

export default function DataTable({ columns, rows, fixedColumns = [], groupOptions = [], getGroupKey = null, filterFields = [], onEdit = null }) {
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [visibleCols, setVisibleCols] = useState(new Set(columns.map((c) => c.id)));
  const [groupBy1, setGroupBy1] = useState("none");
  const [groupBy2, setGroupBy2] = useState("none");
  const [filterText, setFilterText] = useState("");
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");

  const handleSort = (colId) => {
    if (sortBy === colId) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(colId);
      setSortDir("asc");
    }
  };

  const toggleCol = (colId) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      next.has(colId) ? next.delete(colId) : next.add(colId);
      return next;
    });
  };

  const filteredRows = useMemo(() => {
    if (!filterText || filterFields.length === 0) return rows;
    const lower = filterText.toLowerCase();
    return rows.filter((row) =>
      filterFields.some((field) => {
        const val = field.getValue(row);
        return val?.toString().toLowerCase().includes(lower);
      })
    );
  }, [rows, filterText, filterFields]);

  const sortedRows = useMemo(() => {
    if (!sortBy) return filteredRows;
    const col = columns.find((c) => c.id === sortBy);
    if (!col?.sortKey) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const aVal = col.sortKey(a);
      const bVal = col.sortKey(b);

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortBy, sortDir, columns]);

  const buildGroups = () => {
    if (groupBy1 === "none") return [{ key: "all", label: null, items: sortedRows }];
    const map = {};
    for (const v of sortedRows) {
      const k1 = getGroupKey(v, groupBy1);
      if (!map[k1]) map[k1] = { key: k1, label: k1, items: [] };
      map[k1].items.push(v);
    }
    if (groupBy2 === "none" || groupBy2 === groupBy1) return Object.values(map);
    return Object.values(map).map((g) => {
      const subMap = {};
      for (const v of g.items) {
        const k2 = getGroupKey(v, groupBy2);
        if (!subMap[k2]) subMap[k2] = [];
        subMap[k2].push(v);
      }
      return { ...g, subGroups: Object.entries(subMap).map(([k, items]) => ({ key: k, label: k, items })) };
    });
  };

  const groups = getGroupKey ? buildGroups() : [{ key: "all", label: null, items: sortedRows }];

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAllGroups = () => {
    if (expandedGroups.size === groups.length) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(groups.map((g) => g.key)));
    }
  };

  const visibleColumns = columns.filter((c) => visibleCols.has(c.id));
  const fixedCols = visibleColumns.filter((c) => fixedColumns.includes(c.id));
  const scrollableCols = visibleColumns.filter((c) => !fixedColumns.includes(c.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap">
          {filterFields.length > 0 && (
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter…"
                className="pl-8 h-8 text-xs w-full sm:w-48"
              />
            </div>
          )}
          {groupOptions.length > 0 && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Group by</span>
                <Select value={groupBy1} onValueChange={(v) => { setGroupBy1(v); if (v === "none") setGroupBy2("none"); }}>
                  <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {groupOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {groupBy1 !== "none" && groups.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleAllGroups}
                  className="h-8 text-xs gap-1"
                >
                  {expandedGroups.size === groups.length ? "Collapse All" : "Expand All"}
                </Button>
              )}
              {groupBy1 !== "none" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">then by</span>
                  <Select value={groupBy2} onValueChange={setGroupBy2}>
                    <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {groupOptions.filter((o) => o.value !== groupBy1).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
                <Settings2 className="w-3.5 h-3.5" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Show/Hide</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={visibleCols.has(col.id)}
                  onCheckedChange={() => toggleCol(col.id)}
                  className="text-xs"
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {sortedRows.length === 0 && !getGroupKey ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No items found.</p>
        </div>
      ) : getGroupKey ? (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = !group.label || expandedGroups.has(group.key);
            const itemCount = group.subGroups ? group.subGroups.reduce((sum, sub) => sum + sub.items.length, 0) : group.items.length;
            return (
              <div key={group.key} className="rounded-xl border border-border overflow-hidden">
                {group.label ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="w-full px-4 py-2 bg-muted/60 border-b border-border hover:bg-muted/80 transition-colors flex items-center justify-between"
                  >
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label} ({itemCount})</span>
                    <span className="text-sm font-semibold text-muted-foreground">{isExpanded ? "−" : "+"}</span>
                  </button>
                ) : null}
                {isExpanded && (
                  <>
                    {group.subGroups ? (
                      group.subGroups.map((sub) => (
                        <div key={sub.key}>
                          <div className="px-4 py-1.5 bg-muted/30 border-b border-border">
                            <span className="text-xs font-medium text-muted-foreground">{sub.label} ({sub.items.length})</span>
                          </div>
                          <TableContent columns={visibleColumns} fixedCols={fixedCols} scrollableCols={scrollableCols} rows={sub.items} handleSort={handleSort} sortBy={sortBy} sortDir={sortDir} onEdit={onEdit} editingCell={editingCell} setEditingCell={setEditingCell} editValue={editValue} setEditValue={setEditValue} />
                          </div>
                          ))
                          ) : (
                          <TableContent columns={visibleColumns} fixedCols={fixedCols} scrollableCols={scrollableCols} rows={group.items} handleSort={handleSort} sortBy={sortBy} sortDir={sortDir} onEdit={onEdit} editingCell={editingCell} setEditingCell={setEditingCell} editValue={editValue} setEditValue={setEditValue} />
                          )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {fixedCols.map((col) => (
                    <th
                      key={col.id}
                      className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground sticky left-0 bg-muted/40 z-10"
                      style={{ width: col.width }}
                    >
                      <SortHeader col={col} sortBy={sortBy} sortDir={sortDir} onSort={() => handleSort(col.id)} />
                    </th>
                  ))}
                  {scrollableCols.map((col) => (
                    <th
                      key={col.id}
                      className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground"
                      style={{ width: col.width }}
                    >
                      <SortHeader col={col} sortBy={sortBy} sortDir={sortDir} onSort={() => handleSort(col.id)} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    {fixedCols.map((col) => (
                      <EditableCell key={col.id} col={col} row={row} editingCell={editingCell} setEditingCell={setEditingCell} editValue={editValue} setEditValue={setEditValue} onEdit={onEdit} />
                    ))}
                    {scrollableCols.map((col) => (
                      <EditableCell key={col.id} col={col} row={row} editingCell={editingCell} setEditingCell={setEditingCell} editValue={editValue} setEditValue={setEditValue} onEdit={onEdit} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SortHeader({ col, sortBy, sortDir, onSort }) {
  return col.sortKey ? (
    <button
      type="button"
      onClick={onSort}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {col.label}
      {sortBy === col.id ? (
        sortDir === "asc" ? (
          <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowDown className="w-3 h-3" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  ) : (
    col.label
  );
}

function EditableCell({ col, row, editingCell, setEditingCell, editValue, setEditValue, onEdit }) {
  const isEditing = editingCell === `${row.id}-${col.id}`;
  const cellKey = `${row.id}-${col.id}`;

  if (!col.editable || !onEdit) {
    return (
      <td
        key={col.id}
        className="px-4 py-3 text-sm"
        style={{ width: col.width }}
      >
        {col.render(row)}
      </td>
    );
  }

  const handleStart = () => {
    setEditingCell(cellKey);
    setEditValue(col.getDisplayValue(row));
  };

  const handleSave = async () => {
    const entityId = col.getValue(row);
    await onEdit(row.id, col.entityField, editValue, col.entityType, entityId);
    setEditingCell(null);
  };

  return (
    <td
      key={col.id}
      className="px-4 py-3 text-sm"
      style={{ width: col.width }}
      onClick={handleStart}
    >
      {isEditing ? (
        <Input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setEditingCell(null);
          }}
          className="h-6 text-xs"
        />
      ) : (
        <div className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">{col.render(row)}</div>
      )}
    </td>
  );
}

function TableContent({ columns, fixedCols, scrollableCols, rows, handleSort, sortBy, sortDir, onEdit, editingCell, setEditingCell, editValue, setEditValue }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {fixedCols.map((col) => (
              <th
                key={col.id}
                className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground sticky left-0 bg-muted/40 z-10"
                style={{ width: col.width }}
              >
                <SortHeader col={col} sortBy={sortBy} sortDir={sortDir} onSort={() => handleSort(col.id)} />
              </th>
            ))}
            {scrollableCols.map((col) => (
              <th
                key={col.id}
                className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground"
                style={{ width: col.width }}
              >
                <SortHeader col={col} sortBy={sortBy} sortDir={sortDir} onSort={() => handleSort(col.id)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
              {fixedCols.map((col) => (
                <EditableCell key={col.id} col={col} row={row} editingCell={editingCell} setEditingCell={setEditingCell} editValue={editValue} setEditValue={setEditValue} onEdit={onEdit} />
              ))}
              {scrollableCols.map((col) => (
                <EditableCell key={col.id} col={col} row={row} editingCell={editingCell} setEditingCell={setEditingCell} editValue={editValue} setEditValue={setEditValue} onEdit={onEdit} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}