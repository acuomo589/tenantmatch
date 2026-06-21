import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  children,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "rounded-[2rem] border bg-card/95 px-6 py-6 shadow-sm backdrop-blur md:px-8 md:py-8",
        className,
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="grid gap-4">
          <div className="grid gap-2">
            {eyebrow ? <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</span> : null}
            <div className="grid gap-2">
              <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
              {description ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">{description}</p> : null}
            </div>
          </div>
          {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
      </div>

      {children ? <div className="mt-6">{children}</div> : null}
    </header>
  );
}

export { PageHeader };
