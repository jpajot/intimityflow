import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, ArrowUp, ArrowDown, Settings2 } from "lucide-react";

export default function DataTable({ columns, rows, fixedColumns = [] }) {
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [visibleCols, setVisibleCols] = useState(new Set(columns.map((c) => c.id)));

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

  const sortedRows = useMemo(() => {
    if (!sortBy) return rows;
    const col = columns.find((c) => c.id === sortBy);
    if (!col?.sortKey) return rows;

    return [...rows].sort((a, b) => {
      const aVal = col.sortKey(a);
      const bVal = col.sortKey(b);

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sortBy, sortDir, columns]);

  const visibleColumns = columns.filter((c) => visibleCols.has(c.id));
  const fixedCols = visibleColumns.filter((c) => fixedColumns.includes(c.id));
  const scrollableCols = visibleColumns.filter((c) => !fixedColumns.includes(c.id));

  const fixedWidth = fixedCols.reduce((sum, c) => sum + (c.width || 120), 0);

  return (
    <div className="space-y-3">
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
                    {col.sortKey ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.id)}
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
                    )}
                  </th>
                ))}
                {scrollableCols.map((col) => (
                  <th
                    key={col.id}
                    className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground"
                    style={{ width: col.width }}
                  >
                    {col.sortKey ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.id)}
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
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  {fixedCols.map((col) => (
                    <td
                      key={col.id}
                      className="px-4 py-3 sticky left-0 bg-inherit z-9"
                      style={{ width: col.width }}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                  {scrollableCols.map((col) => (
                    <td
                      key={col.id}
                      className="px-4 py-3"
                      style={{ width: col.width }}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}