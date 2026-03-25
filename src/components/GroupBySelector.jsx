import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const GROUP_OPTIONS = [
  { value: "category", label: "Category" },
  { value: "sub_category", label: "Sub-Category" },
  { value: "customer_need", label: "Customer Need" },
  { value: "season", label: "Season" },
  { value: "status", label: "Status" },
];

export default function GroupBySelector({ label, value, onChange, excludeValues = [] }) {
  const options = GROUP_OPTIONS.filter((o) => !excludeValues.includes(o.value));

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}