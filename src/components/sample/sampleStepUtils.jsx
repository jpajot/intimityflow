// ── Workflow Status palette ────────────────────────────────────────────────────
export const WORKFLOW_STATUS_OPTIONS = [
  { value: "created",            label: "Created" },
  { value: "in_progress",        label: "In Progress" },
  { value: "blocked",            label: "Blocked" },
  { value: "sent",               label: "Sent" },
  { value: "partially_sent",     label: "Partially Sent" },
  { value: "pending",            label: "Pending" },
  { value: "shipped",            label: "Shipped" },
  { value: "partially_received", label: "Partially Received" },
  { value: "received",           label: "Received" },
];

export const WORKFLOW_STATUS_STYLE = {
  created:            { background: "#E5E7EB", color: "#374151" },
  in_progress:        { background: "#FEF3C7", color: "#92400E" },
  blocked:            { background: "#FECACA", color: "#991B1B" },
  sent:               { background: "#DBEAFE", color: "#1E40AF" },
  partially_sent:     { background: "#DBEAFE", color: "#1E40AF" },
  pending:            { background: "#E0E7FF", color: "#3730A3" },
  shipped:            { background: "#EDE9FE", color: "#5B21B6" },
  partially_received: { background: "#D1FAE5", color: "#065F46" },
  received:           { background: "#A7F3D0", color: "#065F46" },
};

export function getWorkflowStatusStyle(status) {
  return WORKFLOW_STATUS_STYLE[status] || WORKFLOW_STATUS_STYLE.created;
}

export function getWorkflowStatusLabel(status) {
  return WORKFLOW_STATUS_OPTIONS.find((o) => o.value === status)?.label || status || "—";
}

// ── Roll-up logic (Section E) ─────────────────────────────────────────────────
const SENT_RANGE = new Set(["sent", "partially_sent", "pending", "shipped"]);

export function computeParentWorkflowStatus(steps) {
  if (!steps || steps.length === 0) return null;

  const statuses = steps.map((s) => {
    const st = s.workflow_status;
    return WORKFLOW_STATUS_STYLE[st] ? st : "created";
  });

  // Rule 1
  if (statuses.some((s) => s === "blocked")) return "blocked";
  // Rule 2
  if (statuses.every((s) => s === "received")) return "received";
  // Rule 3
  if (statuses.some((s) => s === "partially_received" || s === "received")) return "partially_received";
  // Rule 4
  if (statuses.every((s) => SENT_RANGE.has(s))) return "sent";
  // Rule 5
  if (statuses.some((s) => SENT_RANGE.has(s))) return "partially_sent";
  // Rule 6
  if (statuses.some((s) => s === "in_progress")) return "in_progress";
  // Rule 7
  return "created";
}