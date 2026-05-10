import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, ChevronUp, MoreVertical, ExternalLink, Trophy, ArrowRight, Loader2, Edit3, Trash2, Search, Pin, PinOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { base44 } from "@/api/base44Client";

const STATUS_COLORS = {
  pending: "bg-gray-100 text-gray-600 border-gray-200",
  answered: "bg-blue-100 text-blue-700 border-blue-200",
  awarded: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-400 border-gray-200",
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  submitted: "bg-blue-100 text-blue-700 border-blue-200",
  under_review: "bg-amber-100 text-amber-700 border-amber-200",
  superseded: "bg-slate-100 text-slate-600 border-slate-200",
};

const RESPONSE_STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  submitted: "bg-blue-100 text-blue-700 border-blue-200",
  under_review: "bg-amber-100 text-amber-700 border-amber-200",
  awarded: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  superseded: "bg-slate-100 text-slate-600 border-slate-200",
};

function ResizeHandle({ colId, onResize }) {
  const startX = useRef(null);

  const startResize = (clientX) => {
    startX.current = clientX;
    const onMove = (e) => {
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      onResize(x - startX.current);
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
      className="absolute top-0 right-0 h-full w-1 cursor-col-resize group/resize hover:bg-primary transition-colors"
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(e.clientX); }}
      onTouchStart={(e) => { e.stopPropagation(); startResize(e.touches[0].clientX); }}
    />
  );
}

export default function RFQTrackingTable({
  lines,
  responses,
  rfqs,
  productMap,
  stepMap,
  supplierMap,
  currencyMap,
  columns,
  selectedResponseIds,
  onSelectedResponsesChange,
  onEditResponse,
  onDeleteResponse,
  onAwardResponse,
  onNavigate,
  projectId,
}) {
  const [expandedLineIds, setExpandedLineIds] = useState(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [colWidths, setColWidths] = useState({});
  const [pinnedCols, setPinnedCols] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);

  // Load persistent column widths and pinned columns
  useEffect(() => {
    const saved = localStorage.getItem("rfq_tracking_table_state");
    if (saved) {
      const { widths, pinned } = JSON.parse(saved);
      setColWidths(widths || {});
      setPinnedCols(pinned || []);
    }
  }, []);

  // Save column state
  const saveColumnState = (newWidths, newPinned) => {
    localStorage.setItem("rfq_tracking_table_state", JSON.stringify({
      widths: newWidths,
      pinned: newPinned,
    }));
  };

  const toggleExpand = (lineId) => {
    setExpandedLineIds((prev) => {
      const next = new Set(prev);
      next.has(lineId) ? next.delete(lineId) : next.add(lineId);
      return next;
    });
  };

  const toggleAllExpand = () => {
    if (allExpanded) {
      setExpandedLineIds(new Set());
    } else {
      setExpandedLineIds(new Set(lines.map((l) => l.id)));
    }
    setAllExpanded(!allExpanded);
  };

  const getLineResponses = (lineId) => responses.filter((r) => r.rfq_line_id === lineId);

  const isResponseAwardable = (response) =>
    !response.is_awarded && ["submitted", "under_review", "rejected"].includes(response.status);

  const formatCurrency = (amount, currencyId) => {
    const curr = currencyMap[currencyId];
    if (!amount) return "—";
    return `${amount.toFixed(curr?.decimal_places ?? 2)} ${curr?.code || "?"}`;
  };

  const handleHeaderContextMenu = (e, colId) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, colId });
  };

  const togglePinColumn = (colId) => {
    const newPinned = pinnedCols.includes(colId)
      ? pinnedCols.filter((c) => c !== colId)
      : [...pinnedCols, colId];
    setPinnedCols(newPinned);
    saveColumnState(colWidths, newPinned);
    setContextMenu(null);
  };

  const getWidth = (col) => colWidths[col.id] ?? col.width ?? 120;

  const filteredLines = useMemo(() => {
    if (!searchText.trim()) return lines;
    const q = searchText.toLowerCase();
    return lines.filter((l) => {
      const sup = supplierMap[l.recipient_supplier_id];
      const prod = productMap[l.product_id];
      const rfq = rfqs.find((r) => r.id === l.rfq_id);
      return (
        (sup?.name || "").toLowerCase().includes(q) ||
        (prod?.name || "").toLowerCase().includes(q) ||
        (rfq?.code || "").toLowerCase().includes(q)
      );
    });
  }, [lines, searchText, supplierMap, productMap, rfqs]);

  return (
    <div className="space-y-3">
      {/* Toolbar - consolidated search + expand */}
      <div className="flex items-center gap-1.5">
        {showSearch && (
          <div className="relative flex-1">
            <Input
              autoFocus
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search…"
              className="h-7 text-xs"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearchText(""); }}
          className={`p-1.5 rounded-md transition-colors border ${showSearch ? "bg-primary/10 border-primary/30 text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"}`}
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={toggleAllExpand}
        >
          {allExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {allExpanded ? "Collapse" : "Expand"}
        </Button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
          className="bg-popover border border-border rounded-md shadow-lg py-1 min-w-[160px]"
          onMouseLeave={() => setContextMenu(null)}
        >
          <button
            type="button"
            onClick={() => togglePinColumn(contextMenu.colId)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
          >
            {pinnedCols.includes(contextMenu.colId) ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            {pinnedCols.includes(contextMenu.colId) ? "Unpin" : "Pin"}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-border bg-muted/40">
                <th className="w-6 px-1 py-2 text-left sticky left-0 z-30 bg-muted/40" />
                {columns.map((col, idx) => {
                  const isPinned = pinnedCols.includes(col.id);
                  let left = 24;
                  for (let i = 0; i < idx; i++) {
                    if (pinnedCols.includes(columns[i].id)) {
                      left += getWidth(columns[i]);
                    }
                  }
                  return (
                    <th
                      key={col.id}
                      className={`px-4 py-2.5 text-xs font-semibold text-muted-foreground text-left cursor-context-menu select-none relative ${isPinned ? "sticky z-30 bg-muted/40" : ""}`}
                      style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }}
                      onContextMenu={(e) => handleHeaderContextMenu(e, col.id)}
                    >
                      {col.label}
                      <ResizeHandle colId={col.id} onResize={(delta) => {
                        const newWidths = { ...colWidths, [col.id]: Math.max(50, (colWidths[col.id] ?? col.width ?? 120) + delta) };
                        setColWidths(newWidths);
                        saveColumnState(newWidths, pinnedCols);
                      }} />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredLines.map((line) => {
              const lineResponses = getLineResponses(line.id);
              const isExpanded = expandedLineIds.has(line.id);
              const hasResponses = lineResponses.length > 0;

              return (
                <>
                  {/* Parent Row */}
                  <tr className="border-b border-border hover:bg-muted/20 transition-colors">
                    {/* Expand/Collapse */}
                     <td className="w-6 px-1 py-3 text-left">
                       {hasResponses ? (
                         <button
                           type="button"
                           onClick={() => toggleExpand(line.id)}
                           className="p-0 rounded hover:bg-muted text-muted-foreground"
                         >
                           {isExpanded ? (
                             <ChevronDown className="w-4 h-4" />
                           ) : (
                             <ChevronRight className="w-4 h-4" />
                           )}
                         </button>
                       ) : (
                         <TooltipProvider>
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <button
                                 type="button"
                                 disabled
                                 className="p-0 text-muted-foreground/40 cursor-not-allowed"
                               >
                                 <ChevronRight className="w-4 h-4" />
                               </button>
                             </TooltipTrigger>
                             <TooltipContent side="right">
                               <p className="text-xs">No responses yet</p>
                             </TooltipContent>
                           </Tooltip>
                         </TooltipProvider>
                       )}
                     </td>

                    {/* Parent Row Cells */}
                    {columns.map((col, idx) => {
                      const isPinned = pinnedCols.includes(col.id);
                      let left = 24; // Start after expand column (w-6 = 24px)
                      for (let i = 0; i < idx; i++) {
                        if (pinnedCols.includes(columns[i].id)) {
                          left += getWidth(columns[i]);
                        }
                      }
                      return (
                        <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-card" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }}>
                          {col.renderParent ? col.renderParent(line) : col.render ? col.render(line) : "—"}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Child Rows (Responses) */}
                  {isExpanded &&
                    lineResponses.map((response) => (
                      <tr
                        key={response.id}
                        className="border-b border-border/50 bg-muted/5 hover:bg-muted/20 transition-colors border-l-2 border-l-slate-300"
                      >
                        {/* Expand chevron (empty for children) */}
                         <td className="w-6 px-1 py-3" />

                        {/* Response Cells */}
                        {columns.map((col, idx) => {
                          const isPinned = pinnedCols.includes(col.id);
                          let left = 24;
                          for (let i = 0; i < idx; i++) {
                            if (pinnedCols.includes(columns[i].id)) {
                              left += getWidth(columns[i]);
                            }
                          }
                          if (col.id === "select") {
                            return (
                              <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }}>
                                {isResponseAwardable(response) ? (
                                  <Checkbox
                                    checked={selectedResponseIds.has(response.id)}
                                    onCheckedChange={(checked) => {
                                      const next = new Set(selectedResponseIds);
                                      checked ? next.add(response.id) : next.delete(response.id);
                                      onSelectedResponsesChange(next);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : null}
                              </td>
                            );
                          }

                          if (col.id === "rfq") {
                            return (
                              <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }} />
                            );
                          }

                          if (col.id === "round") {
                            return (
                              <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }} />
                            );
                          }

                          if (col.id === "product") {
                            return (
                              <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }}>
                                <div className="flex items-center gap-1.5 text-muted-foreground pl-4">
                                  <ArrowRight className="w-3.5 h-3.5" />
                                  <span className="text-xs">Response</span>
                                </div>
                              </td>
                            );
                          }

                          if (col.id === "granularity") {
                            return (
                              <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }} />
                            );
                          }

                          if (col.id === "step") {
                            return (
                              <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }} />
                            );
                          }

                          if (col.id === "supplier") {
                            const sup = supplierMap[line.recipient_supplier_id];
                            return (
                              <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }}>
                                <span className="text-xs">{sup?.name || "—"}</span>
                              </td>
                            );
                          }

                          if (col.id === "qty") {
                            return (
                              <td key={col.id} className={`px-4 py-3 text-xs font-mono ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }}>
                                <div className="space-y-0.5">
                                  {response.min_qty != null && <div>Min: {response.min_qty}</div>}
                                  {response.max_qty != null && <div>Max: {response.max_qty}</div>}
                                  {response.leadtime_days && <div>{response.leadtime_days}d lead</div>}
                                </div>
                              </td>
                            );
                          }

                          if (col.id === "responses") {
                            return (
                              <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }} />
                            );
                          }

                          if (col.id === "best_quote") {
                            return (
                              <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }}>
                                <span className="text-xs font-mono">
                                  {response.total_cost_supplier_ccy && response.supplier_currency_id ? (
                                    <>
                                      {formatCurrency(response.total_cost_supplier_ccy, response.supplier_currency_id)} ={" "}
                                      {formatCurrency(response.total_cost_target_ccy, (rfqs.find((r) => r.id === line.rfq_id)?.target_currency_id))}
                                    </>
                                  ) : (
                                    "—"
                                  )}
                                </span>
                              </td>
                            );
                          }

                          if (col.id === "awarded_cost") {
                            return (
                              <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }}>
                                {response.is_awarded ? (
                                  <span className="text-xs font-mono">
                                    {formatCurrency(response.total_cost_target_ccy, (rfqs.find((r) => r.id === line.rfq_id)?.target_currency_id))}
                                  </span>
                                ) : null}
                              </td>
                            );
                          }

                          if (col.id === "status") {
                            return (
                              <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }}>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${RESPONSE_STATUS_COLORS[response.status] || "bg-muted text-muted-foreground border-border"}`}>
                                  {(response.status || "").replace(/_/g, " ")}
                                </span>
                              </td>
                            );
                          }

                          if (col.id === "rfq_status") {
                            return (
                              <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }} />
                            );
                          }

                          if (col.id === "actions") {
                            return (
                              <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }}>
                                <div className="flex items-center gap-1">
                                  {isResponseAwardable(response) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                      title="Award this response"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onAwardResponse(response, line);
                                      }}
                                    >
                                      <Trophy className="w-3.5 h-3.5" />
                                    </Button>
                                  )}

                                  {response.status === "draft" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                      title="Edit response"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditResponse(response);
                                      }}
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}

                                  {(response.status === "draft" || (response.status === "rejected" && !response.is_awarded)) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      title="Delete response"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteResponse(response);
                                      }}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            );
                          }

                          if (col.id === "responses") {
                            return (
                              <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }} />
                            );
                          }

                          return (
                            <td key={col.id} className={`px-4 py-3 ${isPinned ? "sticky z-10 bg-muted/5" : ""}`} style={{ width: getWidth(col), minWidth: getWidth(col), left: isPinned ? `${left}px` : undefined }}>
                              —
                            </td>
                          );
                          })}
                      </tr>
                      ))}
                      </>
                      );
                      })}
                      </tbody>
                      </table>
                      </div>
                      </div>
                      </div>
                      );
                      }