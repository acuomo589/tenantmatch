import { cn } from "@/lib/utils";

function MetricCard({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}) {
  return (
    <article className={cn("rounded-2xl border bg-card/90 p-4 shadow-xs", className)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-3 text-lg font-semibold tracking-tight text-foreground">{value}</div>
      {detail ? <div className="mt-1 text-xs text-muted-foreground">{detail}</div> : null}
    </article>
  );
}

export { MetricCard };
