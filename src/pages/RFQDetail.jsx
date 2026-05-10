import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, ChevronRight, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import RFQEditHeaderDialog from "@/components/rfq/RFQEditHeaderDialog";
import RFQCostsTab from "@/components/rfq/RFQCostsTab";
import { usePageOptions } from "@/lib/PageOptionsContext";
import { useAuth } from "@/lib/AuthContext";

// ── Feature flags ──────────────────────────────────────────────────────────────
const FEATURE_RFQ_SAMPLE_REQUESTS = false;
const FEATURE_RFQ_SHARED_SPECS    = false;
// ──────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  draft:         "bg-gray-100 text-gray-600 border-gray-200",
  submitted:     "bg-blue-100 text-blue-700 border-blue-200",
  in_collection: "bg-amber-100 text-amber-700 border-amber-200",
  closed:        "bg-green-100 text-green-700 border-green-200",
  archived:      "bg-gray-100 text-gray-400 border-gray-200",
};

const TABS = [
  { id: "costs",           label: "Costs",           visible: true },
  { id: "sample_requests", label: "Sample Requests",  visible: FEATURE_RFQ_SAMPLE_REQUESTS },
  { id: "shared_specs",    label: "Shared Specs",     visible: FEATURE_RFQ_SHARED_SPECS },
];

export default function RFQDetail() {
  const { id: projectId, rfqId } = useParams();
  const navigate = useNavigate();

  const [rfq, setRfq] = useState(null);
  const [round, setRound] = useState(null);
  const [currency, setCurrency] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const { setOptions } = usePageOptions();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("costs");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Costs tab data
  const [rfqLines, setRfqLines] = useState([]);
  const [costsRefData, setCostsRefData] = useState({ products: [], colors: [], pcams: [], steps: [], suppliers: [] });

  const load = async () => {
    setLoading(true);
    const [rfqList, projList] = await Promise.all([
      base44.entities.RFQ.filter({ id: rfqId }),
      base44.entities.Project.filter({ id: projectId }),
    ]);

    const found = rfqList[0];
    if (!found || found.project_id !== projectId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setRfq(found);
    setProject(projList[0] || null);

    // Resolve linked entities in parallel
    const [roundList, currList] = await Promise.all([
      found.round_id           ? base44.entities.RFQRound.filter({ id: found.round_id })           : Promise.resolve([]),
      found.target_currency_id ? base44.entities.Currency.filter({ id: found.target_currency_id }) : Promise.resolve([]),
    ]);
    setRound(roundList[0] || null);
    setCurrency(currList[0] || null);

    // Load costs tab data in parallel
    const [linesData, products, colors, pcams, steps, suppliers] = await Promise.all([
      base44.entities.RFQLine.filter({ rfq_id: rfqId }, "created_date", 1000),
      base44.entities.Product.list("code", 2000),
      base44.entities.ProductColor.list("-created_date", 2000),
      base44.entities.ProductColorAndMore.list("-created_date", 2000),
      base44.entities.SupplierRoutingStep.list("sequence", 2000),
      base44.entities.Supplier.list("name", 500),
    ]);
    setRfqLines(linesData);
    setCostsRefData({ products, colors, pcams, steps, suppliers });

    setLoading(false);
  };

  useEffect(() => { load(); }, [rfqId, projectId]);

  // Clear options when leaving the costs tab (costs tab registers its own)
  useEffect(() => {
    if (activeTab !== "costs") setOptions(null);
  }, [activeTab]);

  const handleEditSaved = (updated) => {
    setRfq(updated);
    setShowEditDialog(false);
    // Re-resolve round/currency if they changed
    const roundChanged  = updated.round_id           !== rfq?.round_id;
    const currChanged   = updated.target_currency_id !== rfq?.target_currency_id;
    if (roundChanged || currChanged) {
      Promise.all([
        updated.round_id           ? base44.entities.RFQRound.filter({ id: updated.round_id })           : Promise.resolve([]),
        updated.target_currency_id ? base44.entities.Currency.filter({ id: updated.target_currency_id }) : Promise.resolve([]),
      ]).then(([rList, cList]) => {
        if (roundChanged)  setRound(rList[0] || null);
        if (currChanged)   setCurrency(cList[0] || null);
      });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const updated = await base44.entities.RFQ.update(rfqId, {
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submitted_by: user?.email || "",
    });
    setRfq((prev) => ({ ...prev, ...updated }));
    setShowSubmitConfirm(false);
    setSubmitting(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    // Cascade: get lines → get responses → delete responses → delete lines → delete RFQ
    const lines = await base44.entities.RFQLine.filter({ rfq_id: rfqId });
    const lineIds = lines.map((l) => l.id);
    if (lineIds.length > 0) {
      const responses = await base44.entities.RFQResponse.filter({ rfq_line_id: { $in: lineIds } });
      await Promise.all(responses.map((r) => base44.entities.RFQResponse.delete(r.id)));
      await Promise.all(lines.map((l) => base44.entities.RFQLine.delete(l.id)));
    }
    await base44.entities.RFQ.delete(rfqId);
    navigate(`/projects/${projectId}/rfqs`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground">
        <p className="text-sm font-medium">RFQ not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}/rfqs`)}>
          Back to RFQs
        </Button>
      </div>
    );
  }

  const visibleTabs = TABS.filter((t) => t.visible);

  return (
    <div className="space-y-0 pb-20">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap px-1 pt-1 pb-3">
        <Link to="/projects" className="hover:text-foreground transition-colors">Projects</Link>
        <ChevronRight className="w-3 h-3 shrink-0" />
        <button type="button" onClick={() => navigate(`/projects/${projectId}`, { state: { section: "rfqs" } })} className="hover:text-foreground transition-colors">
          {project?.name || "Project"}
        </button>
        <ChevronRight className="w-3 h-3 shrink-0" />
        <button type="button" onClick={() => navigate(`/projects/${projectId}/rfqs`)} className="hover:text-foreground transition-colors">
          RFQs
        </button>
        <ChevronRight className="w-3 h-3 shrink-0" />
        <span className="text-foreground font-medium font-mono">{rfq.code}</span>
      </nav>

      {/* Header card */}
      <div className="bg-card border border-border rounded-xl px-5 py-4 space-y-2 mb-4">
        {/* Row 1 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <span className="font-mono text-lg font-bold tracking-tight">{rfq.code}</span>
            <span className="text-base font-normal text-muted-foreground truncate">{rfq.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] px-2 py-0.5 rounded border font-medium capitalize ${STATUS_COLORS[rfq.status] || "bg-muted text-muted-foreground border-border"}`}>
              {(rfq.status || "").replace(/_/g, " ")}
            </span>
            {rfq.status === "draft" && (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={rfqLines.length === 0}
                title={rfqLines.length === 0 ? "Add at least one line first" : undefined}
                onClick={() => setShowSubmitConfirm(true)}
              >
                Submit RFQ
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Edit Header
                </DropdownMenuItem>
                {rfq.status === "draft" && (
                  <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Delete RFQ
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Row 2 — meta line */}
        <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
          {round && <span>Round: <span className="text-foreground">{round.label}</span></span>}
          <span>Due: <span className="text-foreground">{rfq.due_date ? new Date(rfq.due_date).toLocaleDateString() : "—"}</span></span>
          {currency && <span>Currency: <span className="font-mono text-foreground">{currency.code}</span></span>}
          <span>Created by <span className="text-foreground">{rfq.created_by}</span> on <span className="text-foreground">{rfq.created_date ? new Date(rfq.created_date).toLocaleString() : "—"}</span></span>
        </p>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-border mb-4">
        <div className="flex gap-0">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "costs" && (
          <RFQCostsTab
            rfqId={rfqId}
            projectId={projectId}
            lines={rfqLines}
            refData={costsRefData}
            locked={rfq.status !== "draft"}
            onLinesChange={() => {
              base44.entities.RFQLine.filter({ rfq_id: rfqId }, "created_date", 1000)
                .then(setRfqLines);
            }}
          />
        )}
      </div>

      {/* Edit Header Dialog */}
      {showEditDialog && (
        <RFQEditHeaderDialog
          rfq={rfq}
          onSaved={handleEditSaved}
          onClose={() => setShowEditDialog(false)}
        />
      )}

      {/* Submit Confirm */}
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit RFQ {rfq?.code}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  This RFQ will be sent to{" "}
                  <strong className="text-foreground">
                    {new Set(rfqLines.map((l) => l.recipient_supplier_id)).size} supplier(s)
                  </strong>{" "}
                  across{" "}
                  <strong className="text-foreground">{rfqLines.length} line(s)</strong>.
                </p>
                <p>Once submitted, you can no longer add or remove lines.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this RFQ?</AlertDialogTitle>
            <AlertDialogDescription>
              Lines and responses will be deleted too. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}