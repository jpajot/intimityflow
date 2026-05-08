import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePageOptions } from "@/lib/PageOptionsContext";
import { Loader2, Plus, Pencil } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ChangeManagementViewDrawer from "@/components/change-management/ChangeManagementViewDrawer";

const PAGE_KEY = "change_management_ecrs";

const ALL_FIELDS = [
  { id: "ecr_number", label: "ECR #" },
  { id: "title", label: "Title" },
  { id: "status", label: "Status" },
  { id: "priority", label: "Priority" },
  { id: "reason_category", label: "Reason" },
  { id: "requested_by", label: "Requested By" },
  { id: "requested_at", label: "Requested At" },
  { id: "investigator_id", label: "Investigator" },
  { id: "converted_eco_id", label: "ECO" },
  { id: "closed_at", label: "Closed At" },
];

export default function AllEcrsPage() {
  const { setOptions } = usePageOptions();
  const { toast } = useToast();
  const [ecrCount, setEcrCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeViewId, setActiveViewId] = useState("default");
  const [showViewMenu, setShowViewMenu] = useState(false);

  useEffect(() => {
    base44.entities.ECR.list("-created_date", 500).then(rows => {
      setEcrCount(rows.length);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setOptions({
      items: [
        { label: "+ New ECR", icon: Plus, onClick: () => toast({ title: "Coming soon", description: "ECR creation — coming in a future prompt." }) },
        { divider: true },
        { label: "Manage Views", icon: Pencil, onClick: () => setShowViewMenu(v => !v), custom: true },
      ],
      customContent: showViewMenu ? (
        <ChangeManagementViewDrawer
          pageKey={PAGE_KEY}
          activeViewId={activeViewId}
          onSelectView={setActiveViewId}
          allFields={ALL_FIELDS}
          displayMode="list"
        />
      ) : null,
    });
  }, [setOptions, showViewMenu, activeViewId]);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="px-4 py-6 space-y-6">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Change Management</p>
        <h1 className="text-2xl font-display font-semibold mt-0.5">All ECRs</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-3xl font-bold">{ecrCount ?? "—"}</p>
          <p className="text-sm text-muted-foreground mt-1">ECRs in system</p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
        <p className="font-medium">Full ECR list — coming in a future prompt</p>
        <p className="text-xs mt-1 opacity-70">The Manage Views menu above is fully functional now.</p>
      </div>
    </div>
  );
}