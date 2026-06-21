import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

function NoticeStack({ notices }: { notices: Array<{ tone: "info" | "error" | "success"; message: string }> }) {
  const visible = notices.filter((notice) => notice.message.trim().length > 0);
  if (!visible.length) return null;

  return (
    <div className="grid gap-3">
      {visible.map((notice) => (
        <NoticeCard key={`${notice.tone}-${notice.message}`} tone={notice.tone}>
          {notice.message}
        </NoticeCard>
      ))}
    </div>
  );
}

function NoticeCard({ tone, children }: { tone: "info" | "error" | "success"; children: ReactNode }) {
  const toneClasses =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-sky-200 bg-sky-50 text-sky-800";

  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info;

  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xs", toneClasses)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="leading-6">{children}</div>
    </div>
  );
}

export { NoticeStack };
