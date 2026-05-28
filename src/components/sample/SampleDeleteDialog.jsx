import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function SampleDeleteDialog({ open, sample, onClose, onDeleted }) {
  const [alsoDeleteRouting, setAlsoDeleteRouting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasRouting = !!sample?.linked_routing_id;

  const handleDelete = async () => {
    if (!sample) return;
    setDeleting(true);

    // 1. Delete all child SampleSteps
    const steps = await base44.entities.SampleStep.filter({ sample_id: sample.id }, "sequence", 500);
    if (steps.length > 0) {
      await Promise.all(steps.map((s) => base44.entities.SampleStep.delete(s.id)));
    }

    // 2. Optionally delete the generated sample routing + its steps
    if (alsoDeleteRouting && sample.linked_routing_id) {
      const routingSteps = await base44.entities.SupplierRoutingStep.filter(
        { supplier_routing_id: sample.linked_routing_id }, "sequence", 200
      );
      if (routingSteps.length > 0) {
        await Promise.all(routingSteps.map((s) => base44.entities.SupplierRoutingStep.delete(s.id)));
      }
      await base44.entities.SupplierRouting.delete(sample.linked_routing_id);
    }

    // 3. Delete the sample
    await base44.entities.Sample.delete(sample.id);

    toast.success(`Sample ${sample.code} deleted`);
    setDeleting(false);
    onClose();
    onDeleted();
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v && !deleting) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Sample {sample?.code}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete this sample and all its steps. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasRouting && (
          <div className="flex items-start gap-2.5 py-1">
            <Checkbox
              id="delete-routing"
              checked={alsoDeleteRouting}
              onCheckedChange={setAlsoDeleteRouting}
              className="mt-0.5"
            />
            <Label htmlFor="delete-routing" className="text-sm font-normal leading-snug cursor-pointer">
              Also delete the generated sample routing and its routing steps
            </Label>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete Sample
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}