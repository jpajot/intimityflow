import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

/**
 * Reusable confirmation dialog for destructive BOMLine edits.
 *
 * Props:
 *   open           boolean
 *   title          string
 *   description    string | ReactNode  — human-readable summary of what will be lost
 *   deleteCount    number              — shown in the confirm button label
 *   onConfirm      () => void
 *   onCancel       () => void
 */
export default function BOMLineDestructiveConfirmDialog({ open, title, description, deleteCount, onConfirm, onCancel }) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title || "This change will delete existing variant data"}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground space-y-1">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete {deleteCount} record{deleteCount !== 1 ? "s" : ""} and continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}