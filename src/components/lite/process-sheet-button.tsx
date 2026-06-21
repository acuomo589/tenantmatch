"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LiteProcessSummary } from "@/lib/lite/types";

function ProcessSheetButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [summary, setSummary] = useState<LiteProcessSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-3">
      <Button
        onClick={async () => {
          setPending(true);
          setError(null);

          try {
            const response = await fetch("/api/lite/sheets/process", {
              method: "POST",
            });
            const payload = (await response.json()) as {
              error?: string;
              summary?: LiteProcessSummary;
            };

            if (!response.ok || !payload.summary) {
              throw new Error(payload.error ?? "Could not process sheet rows.");
            }

            setSummary(payload.summary);
            startTransition(() => {
              router.refresh();
            });
          } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Could not process sheet rows.");
          } finally {
            setPending(false);
          }
        }}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {pending ? "Processing..." : "Process new rows"}
      </Button>

      {summary ? (
        <div className="rounded-2xl border bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
          Processed {summary.processedRows} row{summary.processedRows === 1 ? "" : "s"}, updated {summary.updatedRows} link
          {summary.updatedRows === 1 ? "" : "s"}, created {summary.createdLinks} new link{summary.createdLinks === 1 ? "" : "s"}.
          {summary.invalidRows ? ` Skipped ${summary.invalidRows} invalid row${summary.invalidRows === 1 ? "" : "s"}.` : ""}
          {summary.errors.length ? ` ${summary.errors.length} row${summary.errors.length === 1 ? "" : "s"} failed.` : ""}
        </div>
      ) : null}

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
    </div>
  );
}

export { ProcessSheetButton };
