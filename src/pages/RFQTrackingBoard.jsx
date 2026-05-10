import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, MoreVertical, ExternalLink, Trophy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import RFQTrackingTable from "@/components/rfq/RFQTrackingTable";
import BulkAwardDialogResponses from "@/components/rfq/BulkAwardDialogResponses";
import AddResponseDialog from "@/components/rfq/AddResponseDialog";
import AwardConfirmDialog from "@/components/rfq/AwardConfirmDialog";
import QuickFiltersPanel, { applyQuickFilters } from "@/components/QuickFiltersPanel";
import ViewDrawerContent from "@/components/ViewDrawerContent";
import { usePageOptions } from "@/lib/PageOptionsContext";
import { Filter, Pencil, Search, X } from "lucide-react";

const STATUS_COLORS = {
  pending:   "bg-gray-100 text-gray-600 border-gray-200",
  answered:  "bg-blue-100 text-blue-700 border-blue-200",
  awarded:   "bg-green-100 text-green-700 border-green-200",
  declined:  "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-400 border-gray-200",
};

const RFQ_STATUS_COLORS = {
  draft:         "bg-gray-100 text-gray-600 border-gray-200",
  submitted:     "bg-blue-100 text-blue-700 border-blue-200",
  in_collection: "bg-amber-100 text-amber-700 border-amber-200",
  closed:        "bg-green-100 text-green-700 border-green-200",
  archived:      "bg-gray-100 text-gray-400 border-gray-200",
};

export default function RFQTrackingBoard() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();

  const [loading, setLoading] = useState(true);
  const [rfqs, setRfqs] = useState([]);
  const [lines, setLines] = useState([]);
  const [allResponses, setAllResponses] = useState([]);
  const [refData, setRefData] = useState({
    products: [], colors: [], pcams: [], steps: [], suppliers: [], currencies: [], rounds: [],
  });

  const [selectedResponseIds, setSelectedResponseIds] = useState(new Set());
  const [showBulkAwardDialog, setShowBulkAwardDialog] = useState(false);
  const [editingResponse, setEditingResponse] = useState(null);
  const [deletingResponse, setDeletingResponse] = useState(null);
  const [awardingResponse, setAwardingResponse] = useState(null);
  const [awardingLine, setAwardingLine] = useState(null);
  const [priorCost, setPriorCost] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showKpis, setShowKpis] = useState(true);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showQF, setShowQF] = useState(false);
  const [quickFilters, setQuickFilters] = useState([]);
  const [activeViewId, setActiveViewId] = useState("default");

  const [filters, setFilters] = useState({
    rfqs: [],
    rounds: [],
    suppliers: [],
    statuses: [],
    rfqStatuses: [],
    hasResponses: null,
    awarded: null,
  });

  // Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [rfqList, products, colors, pcams, steps, suppliers, currencies, rounds] = await Promise.all([
        base44.entities.RFQ.filter({ project_id: projectId }),
        base44.entities.Product.list("code", 2000),
        base44.entities.ProductColor.list("-created_date", 2000),
        base44.entities.ProductColorAndMore.list("-created_date", 2000),
        base44.entities.SupplierRoutingStep.list("sequence", 2000),
        base44.entities.Supplier.list("name", 500),
        base44.entities.Currency.filter({ is_active: true }),
        base44.entities.RFQRound.filter({ is_active: true }),
      ]);

      setRfqs(rfqList);
      setRefData({ products, colors, pcams, steps, suppliers, currencies, rounds });

      if (rfqList.length > 0) {
        const rfqIds = rfqList.map((r) => r.id);
        const linesList = await base44.entities.RFQLine.filter({ rfq_id: { $in: rfqIds } }, "-created_date", 5000);
        setLines(linesList || []);
        
        if (linesList?.length > 0) {
          const responsesList = await base44.entities.RFQResponse.filter({ rfq_line_id: { $in: linesList.map((l) => l.id) } }, "-created_date", 5000);
          setAllResponses(responsesList || []);
        }
      }

      setLoading(false);
    };

    load();
  }, [projectId]);



  const { products: productMap, colors: colorMap, pcams: pcamMap, steps: stepMap, suppliers: supplierMap, currencies: currencyMap, rounds: roundMap } = useMemo(() => {
    return {
      products: Object.fromEntries(refData.products.map((p) => [p.id, p])),
      colors: Object.fromEntries(refData.colors.map((c) => [c.id, c])),
      pcams: Object.fromEntries(refData.pcams.map((p) => [p.id, p])),
      steps: Object.fromEntries(refData.steps.map((s) => [s.id, s])),
      suppliers: Object.fromEntries(refData.suppliers.map((s) => [s.id, s])),
      currencies: Object.fromEntries(refData.currencies.map((c) => [c.id, c])),
      rounds: Object.fromEntries(refData.rounds.map((r) => [r.id, r])),
    };
  }, [refData]);

  // Compute KPIs
  const kpis = useMemo(() => {
    const open = lines.filter((l) => ["pending", "answered"].includes(l.status)).length;
    const awarded = lines.filter((l) => l.status === "awarded").length;
    const noResponses = lines.filter((l) => l.status === "pending" && !allResponses.some((r) => r.rfq_line_id === l.id)).length;
    const avgResponses = lines.length > 0 ? (allResponses.length / lines.length).toFixed(1) : 0;
    return { open, awarded, noResponses, avgResponses };
  }, [lines, allResponses]);

  // Filter lines
  const filteredLines = useMemo(() => {
    let list = lines;

    // Text search
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter((line) => {
        const prod = productMap[line.product_id];
        const sup = supplierMap[line.recipient_supplier_id];
        const step = stepMap[line.routing_step_id];
        const rfq = rfqs.find((r) => r.id === line.rfq_id);
        return (
          (prod?.code || "").toLowerCase().includes(q) ||
          (prod?.name || "").toLowerCase().includes(q) ||
          (sup?.name || "").toLowerCase().includes(q) ||
          (step?.step_type || "").toLowerCase().includes(q) ||
          (rfq?.code || "").toLowerCase().includes(q)
        );
      });
    }

    // Apply filters
    if (filters.rfqs.length > 0) list = list.filter((l) => filters.rfqs.includes(l.rfq_id));
    if (filters.rounds.length > 0) {
      list = list.filter((l) => {
        const rfq = rfqs.find((r) => r.id === l.rfq_id);
        return filters.rounds.includes(rfq?.round_id);
      });
    }
    if (filters.suppliers.length > 0) list = list.filter((l) => filters.suppliers.includes(l.recipient_supplier_id));
    if (filters.statuses.length > 0) list = list.filter((l) => filters.statuses.includes(l.status));
    if (filters.rfqStatuses.length > 0) {
      list = list.filter((l) => {
        const rfq = rfqs.find((r) => r.id === l.rfq_id);
        return filters.rfqStatuses.includes(rfq?.status);
      });
    }
    if (filters.hasResponses !== null) {
      const hasResp = filters.hasResponses;
      list = list.filter((l) => {
        const hasAny = allResponses.some((r) => r.rfq_line_id === l.id);
        return hasResp ? hasAny : !hasAny;
      });
    }
    if (filters.awarded !== null) {
      const isAwarded = filters.awarded;
      list = list.filter((l) => (l.status === "awarded") === isAwarded);
    }

    // Apply quick filters
    list = applyQuickFilters(list, quickFilters);

    return list;
  }, [lines, searchText, filters, rfqs, productMap, supplierMap, stepMap, allResponses, quickFilters]);

  const getGranularity = (line) => {
    if (line.product_color_and_more_id) return "PCAM";
    if (line.product_color_id) return "ProductColor";
    return "Product";
  };

  const getGranLabel = (line) => {
    if (line.product_color_and_more_id) {
      const c = colorMap[line.product_color_id];
      const pc = pcamMap[line.product_color_and_more_id];
      return c && pc ? `${c.color_name} › ${pc.name}` : "PCAM";
    }
    if (line.product_color_id) {
      const c = colorMap[line.product_color_id];
      return c ? c.color_name : "Color";
    }
    return "";
  };

  const getBestQuote = (lineId) => {
    const lineResponses = allResponses.filter((r) => r.rfq_line_id === lineId && r.status === "submitted");
    if (lineResponses.length === 0) return null;
    const best = lineResponses.reduce((min, r) => !min || (r.total_cost_target_ccy < min.total_cost_target_ccy) ? r : min);
    const curr = currencyMap[best.supplier_currency_id];
    return `${best.total_cost_target_ccy?.toFixed(curr?.decimal_places ?? 2)} ${currencyMap[best.supplier_currency_id?.replace?.(/.*/, (c) => rfqs.find((q) => q.id === lines.find((l) => l.id === lineId)?.rfq_id)?.target_currency_id) || best.supplier_currency_id]?.code || "?"}`;
  };

  const getAwardedCost = (lineId) => {
    const line = lines.find((l) => l.id === lineId);
    if (!line?.awarded_response_id) return null;
    const awardedResp = allResponses.find((r) => r.id === line.awarded_response_id);
    if (!awardedResp) return null;
    const rfq = rfqs.find((r) => r.id === line.rfq_id);
    const curr = currencyMap[rfq?.target_currency_id];
    return `${awardedResp.total_cost_target_ccy?.toFixed(curr?.decimal_places ?? 2)} ${curr?.code || "?"}`;
  };

  const columns = useMemo(() => [
    {
      id: "select",
      label: "",
      width: 40,
      renderParent: () => null,
    },
    {
      id: "rfq",
      label: "RFQ",
      width: 100,
      sortKey: (r) => rfqs.find((q) => q.id === r.rfq_id)?.code || "",
      render: (r) => {
        const rfq = rfqs.find((q) => q.id === r.rfq_id);
        return rfq ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/projects/${projectId}/rfqs/${rfq.id}`); }} className="text-xs font-mono text-primary hover:underline">
            {rfq.code}
          </button>
        ) : "—";
      },
    },
    {
      id: "round",
      label: "Round",
      width: 100,
      sortKey: (r) => {
        const rfq = rfqs.find((q) => q.id === r.rfq_id);
        const round = roundMap[rfq?.round_id];
        return round?.sequence || 0;
      },
      render: (r) => {
        const rfq = rfqs.find((q) => q.id === r.rfq_id);
        const round = roundMap[rfq?.round_id];
        return <span className="text-xs">{round?.label || "—"}</span>;
      },
    },
    {
      id: "product",
      label: "Product",
      width: 200,
      sortKey: (r) => productMap[r.product_id]?.code || "",
      render: (r) => {
        const prod = productMap[r.product_id];
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-muted shrink-0 overflow-hidden flex items-center justify-center">
              {prod?.images?.[0]
                ? <img src={prod.images[0]} alt="" className="w-full h-full object-contain" />
                : <span className="text-[9px] font-mono text-muted-foreground">{(prod?.code || "").slice(0, 4)}</span>}
            </div>
            <div className="min-w-0">
              <span className="font-mono text-[10px] text-muted-foreground block">{prod?.code}</span>
              <span className="text-xs font-medium truncate block">{prod?.name}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: "granularity",
      label: "Granularity",
      width: 140,
      sortKey: (r) => getGranularity(r),
      render: (r) => (
        <div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
            {getGranularity(r)}
          </span>
          {getGranLabel(r) && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[110px]">{getGranLabel(r)}</p>
          )}
        </div>
      ),
    },
    {
      id: "step",
      label: "Routing Step",
      width: 160,
      sortKey: (r) => (stepMap[r.routing_step_id]?.sequence || 0).toString().padStart(5, "0"),
      render: (r) => {
        const s = stepMap[r.routing_step_id];
        return s ? <span className="text-xs">Step {s.sequence}: {s.step_type?.replace(/_/g, " ")}</span> : "—";
      },
    },
    {
      id: "supplier",
      label: "Recipient Supplier",
      width: 160,
      sortKey: (r) => supplierMap[r.recipient_supplier_id]?.name || "",
      render: (r) => {
        const sup = supplierMap[r.recipient_supplier_id];
        const step = stepMap[r.routing_step_id];
        const isAlt = step?.supplier_id && r.recipient_supplier_id !== step.supplier_id;
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs">{sup?.name || "—"}</span>
            {isAlt && <span className="text-[9px] px-1 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700 font-semibold uppercase">alt</span>}
          </div>
        );
      },
    },
    {
      id: "qty",
      label: "Fcst. Qty",
      width: 120,
      sortKey: (r) => r.forecasted_qty ?? 0,
      render: (r) => <span className="text-xs font-mono">{r.forecasted_qty ?? 0} {r.forecasted_qty_uom || ""}</span>,
    },
    {
      id: "responses",
      label: "Responses",
      width: 100,
      sortKey: (r) => allResponses.filter((resp) => resp.rfq_line_id === r.id).length,
      render: (r) => {
        const count = allResponses.filter((resp) => resp.rfq_line_id === r.id).length;
        return (
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold border ${count > 0 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-muted text-muted-foreground border-border"}`}>
            {count}
          </span>
        );
      },
    },
    {
      id: "best_quote",
      label: "Best Quote",
      width: 120,
      render: (r) => {
        const quote = getBestQuote(r.id);
        return <span className="text-xs font-mono">{quote || "—"}</span>;
      },
    },
    {
      id: "awarded_cost",
      label: "Awarded Cost",
      width: 120,
      render: (r) => {
        const cost = getAwardedCost(r.id);
        return <span className="text-xs font-mono">{cost || "—"}</span>;
      },
    },
    {
      id: "status",
      label: "Status",
      width: 110,
      sortKey: (r) => r.status || "",
      render: (r) => (
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${STATUS_COLORS[r.status] || "bg-muted text-muted-foreground border-border"}`}>
          {(r.status || "").replace(/_/g, " ")}
        </span>
      ),
    },
    {
      id: "rfq_status",
      label: "RFQ Status",
      width: 110,
      sortKey: (r) => rfqs.find((q) => q.id === r.rfq_id)?.status || "",
      render: (r) => {
        const rfq = rfqs.find((q) => q.id === r.rfq_id);
        return (
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${RFQ_STATUS_COLORS[rfq?.status] || "bg-muted text-muted-foreground border-border"}`}>
            {(rfq?.status || "").replace(/_/g, " ")}
          </span>
        );
      },
    },
    {
      id: "actions",
      label: "",
      width: 44,
      render: (r) => {
        const submittedResponses = allResponses.filter((resp) => resp.rfq_line_id === r.id && resp.status === "submitted");
        const canAward = ["pending", "answered"].includes(r.status) && submittedResponses.length === 1;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { navigate(`/projects/${projectId}/rfqs/${r.rfq_id}`); }}>
                <ExternalLink className="w-3.5 h-3.5 mr-2" /> View RFQ
              </DropdownMenuItem>
              {canAward && (
                <DropdownMenuItem onClick={() => {
                  setAwardingResponse(submittedResponses[0]);
                  setAwardingLine(r);
                  base44.entities.ProductCost.filter({
                    status: 'active',
                    project_id: rfqs.find((q) => q.id === r.rfq_id)?.project_id,
                    product_id: r.product_id,
                    product_color_id: r.product_color_id || null,
                    product_color_and_more_id: r.product_color_and_more_id || null,
                    routing_step_id: r.routing_step_id,
                    supplier_id: r.recipient_supplier_id,
                  }).then((priors) => {
                    if (priors.length > 0) {
                      base44.entities.RFQ.filter({ id: priors[0].source_rfq_id }).then((rfqList) => {
                        setPriorCost({ ...priors[0], source_rfq: rfqList[0] });
                      });
                    } else {
                      setPriorCost(null);
                    }
                  });
                }}>
                  <Trophy className="w-3.5 h-3.5 mr-2" /> Award
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [projectId, rfqs, productMap, colorMap, pcamMap, stepMap, supplierMap, currencyMap, roundMap, allResponses, selectedLineIds, navigate]);

  // Register options
  useEffect(() => {
    const qfFields = [
      { id: "rfq_code", label: "RFQ Code", getValue: (l) => rfqs.find((r) => r.id === l.rfq_id)?.code || "" },
      { id: "status", label: "Line Status", getValue: (l) => l.status || "" },
      { id: "rfq_status", label: "RFQ Status", getValue: (l) => rfqs.find((r) => r.id === l.rfq_id)?.status || "" },
      { id: "supplier", label: "Recipient Supplier", getValue: (l) => supplierMap[l.recipient_supplier_id]?.name || "" },
      { id: "product", label: "Product", getValue: (l) => productMap[l.product_id]?.name || "" },
    ];

    setOptions({
      items: [
        {
          label: `Award ${selectedResponseIds.size} response${selectedResponseIds.size !== 1 ? "s" : ""}`,
          icon: Trophy,
          onClick: () => setShowBulkAwardDialog(true),
          badge: selectedResponseIds.size > 0 ? selectedResponseIds.size : null,
          disabled: selectedResponseIds.size === 0,
        },
        {
          label: "Quick Filters",
          icon: Filter,
          onClick: () => { setShowQF((v) => !v); setShowViewMenu(false); },
          custom: true,
          badge: quickFilters.length > 0 ? quickFilters.length : null,
        },
        { divider: true },
        {
          label: "Manage Views",
          icon: Pencil,
          onClick: () => { setShowViewMenu((v) => !v); setShowQF(false); },
          custom: true,
        },
        {
          label: "Export to Excel",
          icon: Download,
          onClick: () => { /* TODO: implement export */ },
        },
      ],
      customContent: showQF
        ? () => (
            <QuickFiltersPanel
              fields={qfFields}
              activeFilters={quickFilters}
              onApply={(f) => { setQuickFilters(f); }}
            />
          )
        : showViewMenu
        ? () => (
            <ViewDrawerContent
              pageKey="rfq_tracking_board"
              activeViewId={activeViewId}
              onSelectView={setActiveViewId}
              allFields={[
                { id: "rfq", label: "RFQ" },
                { id: "round", label: "Round" },
                { id: "product", label: "Product" },
                { id: "granularity", label: "Granularity" },
                { id: "step", label: "Routing Step" },
                { id: "supplier", label: "Recipient Supplier" },
                { id: "qty", label: "Fcst. Qty" },
                { id: "responses", label: "Responses" },
                { id: "best_quote", label: "Best Quote" },
                { id: "awarded_cost", label: "Awarded Cost" },
                { id: "status", label: "Status" },
                { id: "rfq_status", label: "RFQ Status" },
                { id: "actions", label: "Actions" },
              ]}
            />
          )
        : null,
    });
  }, [setOptions, selectedResponseIds, showQF, showViewMenu, quickFilters, activeViewId, rfqs, productMap, supplierMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <h2 className="font-semibold text-base">RFQ Tracking</h2>

      {/* KPI Cards - Collapsible */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowKpis((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
        >
          <span className="text-sm font-semibold">Stats</span>
          <span className="text-sm font-semibold text-muted-foreground">{showKpis ? "−" : "+"}</span>
        </button>
        {showKpis && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-4 border-t border-border">
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...f, statuses: ["pending", "answered"] }))}
              className="text-left bg-muted/40 border border-border rounded-lg px-4 py-3 hover:bg-muted transition-colors"
            >
              <p className="text-xs text-muted-foreground mb-1">Open Lines</p>
              <p className="text-2xl font-bold">{kpis.open}</p>
            </button>
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...f, statuses: ["awarded"] }))}
              className="text-left bg-green-50 border border-green-200 rounded-lg px-4 py-3 hover:bg-green-100 transition-colors"
            >
              <p className="text-xs text-green-700 mb-1">Awarded</p>
              <p className="text-2xl font-bold text-green-700">{kpis.awarded}</p>
            </button>
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...f, statuses: ["pending"], hasResponses: false }))}
              className={`text-left border rounded-lg px-4 py-3 hover:opacity-90 transition-colors ${kpis.noResponses > 0 ? "bg-amber-50 border-amber-200" : "bg-muted/40 border-border"}`}
            >
              <p className={`text-xs mb-1 ${kpis.noResponses > 0 ? "text-amber-700" : "text-muted-foreground"}`}>No Responses</p>
              <p className={`text-2xl font-bold ${kpis.noResponses > 0 ? "text-amber-700" : ""}`}>{kpis.noResponses}</p>
            </button>
            <div className="bg-muted/40 border border-border rounded-lg px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Avg Responses/Line</p>
              <p className="text-2xl font-bold">{kpis.avgResponses}</p>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar - Collapsible Search */}
      <div className="flex items-center gap-2">
        {showSearch && (
          <div className="relative flex-1">
            <Input
              autoFocus
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search product, supplier, RFQ…"
              className="h-8 text-xs pr-7"
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
      </div>

      {/* Empty state */}
      {filteredLines.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
          <p className="text-sm font-medium">No RFQ lines found.</p>
          <p className="text-xs">Create an RFQ to start collecting costs.</p>
        </div>
      )}

      {/* Data Table */}
      {filteredLines.length > 0 && (
        <RFQTrackingTable
          lines={filteredLines}
          responses={allResponses}
          rfqs={rfqs}
          productMap={productMap}
          stepMap={stepMap}
          supplierMap={supplierMap}
          currencyMap={currencyMap}
          columns={columns}
          selectedResponseIds={selectedResponseIds}
          onSelectedResponsesChange={setSelectedResponseIds}
          onEditResponse={setEditingResponse}
          onDeleteResponse={setDeletingResponse}
          onAwardResponse={(response, line) => {
            setAwardingResponse(response);
            setAwardingLine(line);
            base44.entities.ProductCost.filter({
              status: 'active',
              project_id: rfqs.find((q) => q.id === line.rfq_id)?.project_id,
              product_id: line.product_id,
              product_color_id: line.product_color_id || null,
              product_color_and_more_id: line.product_color_and_more_id || null,
              routing_step_id: line.routing_step_id,
              supplier_id: line.recipient_supplier_id,
            }).then((priors) => {
              if (priors.length > 0) {
                base44.entities.RFQ.filter({ id: priors[0].source_rfq_id }).then((rfqList) => {
                  setPriorCost({ ...priors[0], source_rfq: rfqList[0] });
                });
              } else {
                setPriorCost(null);
              }
            });
          }}
          onNavigate={navigate}
          projectId={projectId}
        />
      )}

      {/* Edit Response Dialog */}
      {editingResponse && (
        <AddResponseDialog
          line={lines.find((l) => l.id === editingResponse.rfq_line_id)}
          rfq={rfqs.find((r) => r.id === lines.find((l) => l.id === editingResponse.rfq_line_id)?.rfq_id)}
          productMap={productMap}
          stepMap={stepMap}
          supplierMap={supplierMap}
          existingResponse={editingResponse}
          onSaved={() => {
            setEditingResponse(null);
            const rfqIds = rfqs.map((r) => r.id);
            Promise.all([
              base44.entities.RFQLine.filter({ rfq_id: { $in: rfqIds } }),
              base44.entities.RFQResponse.filter({ rfq_line_id: { $in: lines.map((l) => l.id) } }),
            ]).then(([newLines, newResponses]) => {
              setLines(newLines);
              setAllResponses(newResponses);
            });
          }}
          onClose={() => setEditingResponse(null)}
        />
      )}

      {/* Delete Response Confirm */}
      {deletingResponse && (
        <AlertDialog open={!!deletingResponse} onOpenChange={(o) => { if (!o) setDeletingResponse(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this response?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await base44.entities.RFQResponse.delete(deletingResponse.id);
                  setDeletingResponse(null);
                  const rfqIds = rfqs.map((r) => r.id);
                  Promise.all([
                    base44.entities.RFQLine.filter({ rfq_id: { $in: rfqIds } }),
                    base44.entities.RFQResponse.filter({ rfq_line_id: { $in: lines.map((l) => l.id) } }),
                  ]).then(([newLines, newResponses]) => {
                    setLines(newLines);
                    setAllResponses(newResponses);
                  });
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Award Response Dialog */}
      {awardingResponse && awardingLine && (
        <AwardConfirmDialog
          open={!!awardingResponse}
          onOpenChange={(open) => { if (!open) { setAwardingResponse(null); setAwardingLine(null); setPriorCost(null); } }}
          response={awardingResponse}
          line={awardingLine}
          rfq={rfqs.find((r) => r.id === awardingLine.rfq_id)}
          productMap={productMap}
          stepMap={stepMap}
          supplierMap={supplierMap}
          currencyMap={currencyMap}
          priorCost={priorCost}
          onConfirmed={() => {
            setAwardingResponse(null);
            setAwardingLine(null);
            setPriorCost(null);
            const rfqIds = rfqs.map((r) => r.id);
            Promise.all([
              base44.entities.RFQLine.filter({ rfq_id: { $in: rfqIds } }),
              base44.entities.RFQResponse.filter({ rfq_line_id: { $in: lines.map((l) => l.id) } }),
            ]).then(([newLines, newResponses]) => {
              setLines(newLines);
              setAllResponses(newResponses);
            });
          }}
        />
      )}

      {/* Bulk Award Dialog */}
      {showBulkAwardDialog && (
        <BulkAwardDialogResponses
          open={showBulkAwardDialog}
          onOpenChange={setShowBulkAwardDialog}
          selectedResponseIds={Array.from(selectedResponseIds)}
          responses={allResponses}
          lines={lines}
          rfqs={rfqs}
          productMap={productMap}
          stepMap={stepMap}
          supplierMap={supplierMap}
          currencyMap={currencyMap}
          onConfirmed={() => {
            setSelectedResponseIds(new Set());
            const rfqIds = rfqs.map((r) => r.id);
            Promise.all([
              base44.entities.RFQLine.filter({ rfq_id: { $in: rfqIds } }),
              base44.entities.RFQResponse.filter({ rfq_line_id: { $in: lines.map((l) => l.id) } }),
            ]).then(([newLines, newResponses]) => {
              setLines(newLines);
              setAllResponses(newResponses);
            });
          }}
        />
      )}
    </div>
  );
}