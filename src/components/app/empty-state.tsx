import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid gap-3 rounded-[2rem] border border-dashed bg-card/80 px-6 py-10 text-center shadow-sm md:px-10",
        className,
      )}
    >
      <div className="grid gap-2">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="mt-2 flex justify-center">{action}</div> : null}
    </section>
  );
}

export { EmptyState };
