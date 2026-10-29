import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T | "all";
  options: readonly T[];
  onChange: (v: T | "all") => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T | "all")}>
      <SelectTrigger className={cn("h-9 w-full text-xs sm:w-[150px]", className)} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
