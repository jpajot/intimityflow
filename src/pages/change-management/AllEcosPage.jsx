import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePageOptions } from "@/lib/PageOptionsContext";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Pencil } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ChangeManagementViewDrawer from "@/components/change-management/ChangeManagementViewDrawer";

const PAGE_KEY = "change_management_ecos";

const ALL_FIELDS = [
  { id: "eco_number", label: "ECO #" },
  { id: "title", label: "Title" },
  { id: "flow_type", label: "Flow" },
  { id: "status", label: "Status" },
  { id: "priority", label: "Priority" },
  { id: "reason_category", label: "Reason" },
  { id: "requested_by", label: "Requested By" },
  { id: "requested_at", label: "Requested At" },
  { id: "applied_at", label: "Applied At" },
  { id: "approved_at", label: "Approved At" },
  { id: "approver_id", label: "Approver" },
  { id: "origin", label: "Origin" },
];

export default function AllEcosPage() {
  const { setOptions } = usePageOptions();
  const { toast } = useToast();
  const [ecoCount, setEcoCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeViewId, setActiveViewId] = useState("default");
  const [showViewMenu, setShowViewMenu] = useState(false);

  useEffect(() => {
    base44.entities.ECO.list("-created_date", 500).then(rows => {
      setEcoCount(rows.length);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setOptions({
      items: [
        { label: "+ New ECO", icon: Plus, onClick: () => toast({ title: "Coming soon", description: "Manual ECO creation — coming in Prompt #16." }) },
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
        <h1 className="text-2xl font-display font-semibold mt-0.5">All ECOs</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-3xl font-bold">{ecoCount ?? "—"}</p>
          <p className="text-sm text-muted-foreground mt-1">ECOs in system</p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
        <p className="font-medium">Full ECO list — coming in Prompt #15</p>
        <p className="text-xs mt-1 opacity-70">The Manage Views menu above is fully functional now.</p>
      </div>
    </div>
  );
}