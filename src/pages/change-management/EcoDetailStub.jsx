import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  FlowBadge, StatusBadge, PriorityBadge, ReasonBadge, originLabel
} from "@/components/change-management/EcoBadges";

function RelativeDate({ value }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span title={new Date(value).toLocaleString()}>
      {formatDistanceToNow(new Date(value), { addSuffix: true })}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

export default function EcoDetailStub() {
  const { id } = useParams();
  const [eco, setEco] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    base44.entities.ECO.filter({ id })
      .then((rows) => {
        if (rows.length === 0) setNotFound(true);
        else setEco(rows[0]);
        setLoading(false);
      });
  }, [id]);

  const backLink = (
    <Link to="/change-management/ecos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
      <ArrowLeft className="w-4 h-4" /> Back to All ECOs
    </Link>
  );

  if (loading) return (
    <div className="px-4 py-6 space-y-4">
      {backLink}
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  if (notFound) return (
    <div className="px-4 py-6 space-y-4">
      {backLink}
      <p className="text-muted-foreground">ECO not found.</p>
    </div>
  );

  return (
    <div className="px-4 py-6 space-y-6 max-w-3xl">
      {/* Breadcrumb + back */}
      <div className="space-y-1">
        {backLink}
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
          Change Management › All ECOs › {eco.eco_number}
        </p>
        <h1 className="text-2xl font-display font-semibold">
          {eco.eco_number} — {eco.title}
        </h1>
      </div>

      {/* Main card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          <Field label="ECO #">
            <span className="font-mono font-semibold">{eco.eco_number}</span>
          </Field>
          <Field label="Status"><StatusBadge value={eco.status} /></Field>
          <Field label="Flow"><FlowBadge value={eco.flow_type} /></Field>
          <Field label="Priority"><PriorityBadge value={eco.priority} /></Field>
          <Field label="Reason"><ReasonBadge value={eco.reason_category} /></Field>
          <Field label="Origin">{originLabel(eco.origin)}</Field>
          <Field label="Requested By">{eco.requested_by || "—"}</Field>
          <Field label="Requested At"><RelativeDate value={eco.requested_at} /></Field>
          <Field label="Approver">{eco.approver_id || "—"}</Field>
          <Field label="Approved At"><RelativeDate value={eco.approved_at} /></Field>
          <Field label="Applied At"><RelativeDate value={eco.applied_at} /></Field>
          <Field label="Closed At"><RelativeDate value={eco.closed_at} /></Field>
          <Field label="Target Effective Date">
            {eco.target_effective_date
              ? new Date(eco.target_effective_date).toLocaleDateString()
              : "—"}
          </Field>
        </div>

        {eco.description && (
          <div className="space-y-1 border-t border-border pt-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Description</span>
            <p className="text-sm text-foreground leading-relaxed">{eco.description}</p>
          </div>
        )}
      </div>

      {/* Coming soon notice */}
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-muted-foreground text-sm">
        <p className="font-medium">Full ECO detail with AffectedItem and AffectedDownstream tables — coming in Prompt #15b.</p>
      </div>
    </div>
  );
}