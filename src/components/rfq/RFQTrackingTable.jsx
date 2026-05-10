import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, MoreVertical, ExternalLink, Trophy, ArrowRight, Loader2, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const toggleExpand = (lineId) => {
    setExpandedLineIds((prev) => {
      const next = new Set(prev);
      next.has(lineId) ? next.delete(lineId) : next.add(lineId);
      return next;
    });
  };

  const expandAll = () => setExpandedLineIds(new Set(lines.map((l) => l.id)));
  const collapseAll = () => setExpandedLineIds(new Set());

  const getLineResponses = (lineId) => responses.filter((r) => r.rfq_line_id === lineId);

  const isResponseAwardable = (response) =>
    !response.is_awarded && ["submitted", "under_review", "rejected"].includes(response.status);

  const formatCurrency = (amount, currencyId) => {
    const curr = currencyMap[currencyId];
    if (!amount) return "—";
    return `${amount.toFixed(curr?.decimal_places ?? 2)} ${curr?.code || "?"}`;
  };

  return (
    <div className="space-y-2">
      {/* Expand/Collapse All Buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-7"
          onClick={expandAll}
        >
          <ChevronDown className="w-3 h-3" /> Expand All
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-7"
          onClick={collapseAll}
        >
          <ChevronRight className="w-3 h-3" /> Collapse All
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-8 px-3 py-2 text-left" />
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="px-4 py-2.5 text-xs font-semibold text-muted-foreground text-left"
                  style={{ width: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const lineResponses = getLineResponses(line.id);
              const isExpanded = expandedLineIds.has(line.id);
              const hasResponses = lineResponses.length > 0;

              return (
                <>
                  {/* Parent Row */}
                  <tr className="border-b border-border hover:bg-muted/20 transition-colors">
                    {/* Expand/Collapse */}
                    <td className="px-3 py-3 text-left">
                      {hasResponses ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(line.id)}
                          className="p-0.5 rounded hover:bg-muted text-muted-foreground"
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
                                className="p-0.5 text-muted-foreground/40 cursor-not-allowed"
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
                    {columns.map((col) => (
                      <td key={col.id} className="px-4 py-3" style={{ width: col.width }}>
                        {col.renderParent ? col.renderParent(line) : col.render ? col.render(line) : "—"}
                      </td>
                    ))}
                  </tr>

                  {/* Child Rows (Responses) */}
                  {isExpanded &&
                    lineResponses.map((response) => (
                      <tr
                        key={response.id}
                        className="border-b border-border/50 bg-muted/5 hover:bg-muted/20 transition-colors border-l-2 border-l-slate-300"
                      >
                        {/* Expand chevron (empty for children) */}
                        <td className="px-3 py-3" />

                        {/* Response Cells */}
                        {columns.map((col) => {
                          if (col.id === "select") {
                            return (
                              <td key={col.id} className="px-4 py-3" style={{ width: col.width }}>
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
                              <td key={col.id} className="px-4 py-3" style={{ width: col.width }} />
                            );
                          }

                          if (col.id === "round") {
                            return (
                              <td key={col.id} className="px-4 py-3" style={{ width: col.width }} />
                            );
                          }

                          if (col.id === "product") {
                            return (
                              <td key={col.id} className="px-4 py-3" style={{ width: col.width }}>
                                <div className="flex items-center gap-1.5 text-muted-foreground pl-4">
                                  <ArrowRight className="w-3.5 h-3.5" />
                                  <span className="text-xs">Response</span>
                                </div>
                              </td>
                            );
                          }

                          if (col.id === "granularity") {
                            return (
                              <td key={col.id} className="px-4 py-3" style={{ width: col.width }} />
                            );
                          }

                          if (col.id === "step") {
                            return (
                              <td key={col.id} className="px-4 py-3" style={{ width: col.width }} />
                            );
                          }

                          if (col.id === "supplier") {
                            const sup = supplierMap[line.recipient_supplier_id];
                            return (
                              <td key={col.id} className="px-4 py-3" style={{ width: col.width }}>
                                <span className="text-xs">{sup?.name || "—"}</span>
                              </td>
                            );
                          }

                          if (col.id === "qty") {
                            return (
                              <td key={col.id} className="px-4 py-3" style={{ width: col.width }} />
                            );
                          }

                          if (col.id === "responses") {
                            return (
                              <td key={col.id} className="px-4 py-3" style={{ width: col.width }} />
                            );
                          }

                          if (col.id === "best_quote") {
                            return (
                              <td key={col.id} className="px-4 py-3" style={{ width: col.width }}>
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
                              <td key={col.id} className="px-4 py-3" style={{ width: col.width }}>
                                {response.is_awarded ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono">
                                      {formatCurrency(response.total_cost_target_ccy, (rfqs.find((r) => r.id === line.rfq_id)?.target_currency_id))}
                                    </span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 font-semibold">
                                      Awarded ✓
                                    </span>
                                  </div>
                                ) : null}
                              </td>
                            );
                          }

                          if (col.id === "status") {
                            return (
                              <td key={col.id} className="px-4 py-3" style={{ width: col.width }}>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${RESPONSE_STATUS_COLORS[response.status] || "bg-muted text-muted-foreground border-border"}`}>
                                  {(response.status || "").replace(/_/g, " ")}
                                </span>
                              </td>
                            );
                          }

                          if (col.id === "rfq_status") {
                            return (
                              <td key={col.id} className="px-4 py-3" style={{ width: col.width }} />
                            );
                          }

                          if (col.id === "actions") {
                            return (
                              <td key={col.id} className="px-4 py-3" style={{ width: col.width }}>
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

                          return (
                            <td key={col.id} className="px-4 py-3" style={{ width: col.width }}>
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
  );
}