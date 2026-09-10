import { Check, Clock, Minus, X } from "lucide-react";
import { STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  confirmed: "border-border-strong bg-secondary text-secondary-foreground",
  pending: "border-warning/40 bg-warning/10 text-warning-foreground",
  completed: "border-success/40 bg-success/10 text-success",
  cancelled: "border-border bg-transparent text-muted-foreground line-through",
  no_show: "border-destructive/40 bg-destructive/8 text-destructive",
};

const icons: Record<string, typeof Check> = {
  confirmed: Check,
  pending: Clock,
  completed: Check,
  cancelled: X,
  no_show: Minus,
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const Icon = icons[status] ?? Clock;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[status] ?? styles.pending,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
