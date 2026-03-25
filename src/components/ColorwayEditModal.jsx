import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ColorwayForm from "./ColorwayForm";

export default function ColorwayEditModal({ variant, open, onClose, onSave, onDelete, existingColorways = [] }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{variant ? "Edit Colorway" : "New Colorway"}</DialogTitle>
        </DialogHeader>
        <ColorwayForm
          variant={variant}
          existingColorways={existingColorways}
          onSave={async (data) => { await onSave(data); onClose(); }}
          onCancel={onClose}
          onDelete={variant ? async () => { await onDelete(); onClose(); } : undefined}
        />
      </DialogContent>
    </Dialog>
  );
}