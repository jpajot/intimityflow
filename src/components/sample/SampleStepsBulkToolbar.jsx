import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WORKFLOW_STATUS_OPTIONS, getWorkflowStatusStyle } from "./sampleStepUtils";
import { ChevronDown, CalendarIcon } from "lucide-react";

export default function SampleStepsBulkToolbar({
  selectedCount,
  suppliersArray,
  onChangeSupplier,
  onChangeDueDate,
  onChangeStatus,
}) {
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-xs">
      <span className="font-medium text-primary shrink-0">
        {selectedCount} step{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="flex items-center gap-2 ml-auto flex-wrap">
        {/* Change Supplier */}
        <DropdownMenu open={supplierOpen} onOpenChange={setSupplierOpen}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              Change Supplier <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[220px] max-h-60 overflow-y-auto">
            {suppliersArray.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onSelect={() => { onChangeSupplier(s.id); setSupplierOpen(false); }}
                className="text-xs"
              >
                <span className="font-mono text-muted-foreground mr-1.5">{s.code}</span>
                {s.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Change Due Date */}
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <CalendarIcon className="w-3 h-3" />
              Change Due Date
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              onSelect={(d) => {
                if (d) {
                  onChangeDueDate(format(d, "yyyy-MM-dd"));
                  setDateOpen(false);
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Change Status */}
        <DropdownMenu open={statusOpen} onOpenChange={setStatusOpen}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              Change Status <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            {WORKFLOW_STATUS_OPTIONS.map((o) => {
              const style = getWorkflowStatusStyle(o.value);
              return (
                <DropdownMenuItem
                  key={o.value}
                  onSelect={() => { onChangeStatus(o.value); setStatusOpen(false); }}
                  className="text-xs gap-2"
                >
                  <span
                    className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: style.background, color: style.color }}
                  >
                    {o.label}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}