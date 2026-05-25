import { getWorkflowStatusStyle, getWorkflowStatusLabel } from "./sampleStepUtils";

export default function WorkflowStatusBadge({ status, className = "" }) {
  if (!status) return <span className="text-xs text-muted-foreground/40">—</span>;
  const style = getWorkflowStatusStyle(status);
  return (
    <span
      className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${className}`}
      style={{
        backgroundColor: style.background,
        color: style.color,
        borderColor: style.background,
      }}
    >
      {getWorkflowStatusLabel(status)}
    </span>
  );
}