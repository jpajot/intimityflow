import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// ── Constants ──────────────────────────────────────────────────────────────────

const REASON_OPTIONS = [
  { value: "quality",         label: "Quality" },
  { value: "cost",            label: "Cost" },
  { value: "supplier_change", label: "Supplier change" },
  { value: "design_change",   label: "Design change" },
  { value: "regulatory",      label: "Regulatory" },
  { value: "sourcing_update", label: "Sourcing update" },
  { value: "routing_update",  label: "Routing update" },
  { value: "other",           label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "low",      label: "Low",      className: "text-slate-600" },
  { value: "normal",   label: "Normal",   className: "text-blue-700" },
  { value: "high",     label: "High",     className: "text-orange-700" },
  { value: "critical", label: "Critical", className: "text-red-700" },
];

// ── Field error component ─────────────────────────────────────────────────────
function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function FormSection({ title, optional, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {optional && <span className="text-xs text-muted-foreground">optional</span>}
      </div>
      {children}
    </div>
  );
}

// ── Today at midnight (local) for date comparison ─────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ManualEcoPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reasonCategory, setReasonCategory] = useState("");
  const [priority, setPriority] = useState("normal");
  const [targetEffectiveDate, setTargetEffectiveDate] = useState("");
  const [notes, setNotes] = useState("");

  // Errors
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate(fields = {}) {
    const t = fields.title ?? title;
    const r = fields.reasonCategory ?? reasonCategory;
    const d = fields.targetEffectiveDate ?? targetEffectiveDate;
    const errs = {};

    if (!t.trim()) {
      errs.title = "Title is required.";
    } else if (t.trim().length > 200) {
      errs.title = "Title must be 200 characters or fewer.";
    }

    if (!r) {
      errs.reasonCategory = "Select a reason category.";
    }

    if (d && d < todayStr()) {
      errs.targetEffectiveDate = "Target effective date cannot be in the past.";
    }

    return errs;
  }

  const currentErrors = validate();
  const isValid = Object.keys(currentErrors).length === 0;

  function touch(field) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  // Show errors only for touched fields (or after submit attempt)
  function visibleErrors() {
    const errs = validate();
    const visible = {};
    for (const k of Object.keys(errs)) {
      if (touched[k] || touched._all) visible[k] = errs[k];
    }
    return visible;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ _all: true });

    const errs = validate();
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const response = await base44.functions.invoke("createEco", {
        title: title.trim(),
        description: description.trim() || null,
        reason_category: reasonCategory,
        priority,
        target_effective_date: targetEffectiveDate || null,
        notes: notes.trim() || null,
        status: "proposed",
        origin: "manual",
        flow_type: "manual",
        requested_by: user?.email || "",
        requested_at: new Date().toISOString(),
      });

      const eco = response.data;
      toast({
        title: `${eco.eco_number} created`,
        description: "Add affected items to specify what changes.",
      });
      navigate(`/change-management/ecos/${eco.id}`);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Unknown error";
      toast({
        title: "Could not create ECO",
        description: msg,
        variant: "destructive",
      });
      setSubmitting(false);
    }
  }

  const ve = visibleErrors();

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] overflow-hidden">
      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-3 pt-2 pb-2 border-b border-border bg-background z-10">
        <Link
          to="/change-management/ecos"
          className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Back to All ECOs"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold leading-none mb-0.5">
            Change Management
          </p>
          <h1 className="text-base font-display font-semibold leading-none">New ECO</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8"
          onClick={() => navigate("/change-management/ecos")}
        >
          Cancel
        </Button>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-4 py-6 space-y-4 max-w-2xl">
            {/* Subtitle */}
            <p className="text-sm text-muted-foreground">
              Create a manual change order. After submitting, you'll be able to attach affected items and route the ECO for review.
            </p>

            {/* Section A — Identity */}
            <FormSection title="Identity">
              <div className="space-y-1.5">
                <Label className="text-xs">Title <span className="text-destructive">*</span></Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => touch("title")}
                  placeholder="Short, descriptive title (e.g. 'Replace lace component on Brief')"
                  maxLength={220}
                />
                <div className="flex items-center justify-between">
                  <FieldError message={ve.title} />
                  <span className={`text-xs ml-auto ${title.length > 200 ? "text-destructive" : "text-muted-foreground"}`}>
                    {title.length}/200
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain the reason for this change in detail. What's the problem? What needs to happen? Who is affected?"
                  rows={4}
                />
              </div>
            </FormSection>

            {/* Section B — Classification */}
            <FormSection title="Classification">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Reason category <span className="text-destructive">*</span></Label>
                  <Select
                    value={reasonCategory}
                    onValueChange={(v) => { setReasonCategory(v); touch("reasonCategory"); }}
                  >
                    <SelectTrigger onBlur={() => touch("reasonCategory")}>
                      <SelectValue placeholder="Select reason…" />
                    </SelectTrigger>
                    <SelectContent>
                      {REASON_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={ve.reasonCategory} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Priority <span className="text-destructive">*</span></Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <span className={o.className}>{o.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </FormSection>

            {/* Section C — Schedule */}
            <FormSection title="Schedule" optional>
              <div className="space-y-1.5">
                <Label className="text-xs">Target effective date</Label>
                <Input
                  type="date"
                  value={targetEffectiveDate}
                  onChange={(e) => { setTargetEffectiveDate(e.target.value); touch("targetEffectiveDate"); }}
                  onBlur={() => touch("targetEffectiveDate")}
                  min={todayStr()}
                  className="w-48"
                />
                <p className="text-xs text-muted-foreground">
                  Optional cut-in date for when this change should take effect. Leave blank if immediate on approval.
                </p>
                <FieldError message={ve.targetEffectiveDate} />
              </div>
            </FormSection>

            {/* Section D — Additional notes */}
            <FormSection title="Additional notes" optional>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any other context — links to discussions, related ECOs, design files, etc."
                  rows={3}
                />
              </div>
            </FormSection>

            {/* Form footer */}
            <div className="flex items-center justify-end gap-3 pt-2 pb-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/change-management/ecos")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !isValid}
                className="gap-2 min-w-[100px]"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? "Creating…" : "Submit"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}