import { FileSearch } from "lucide-react";

export default function ProjectRFQs({ projectId }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
      <FileSearch className="w-10 h-10 opacity-25" />
      <p className="text-sm font-medium">RFQs list — coming soon.</p>
    </div>
  );
}