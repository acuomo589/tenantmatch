"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function LiteCheckoutButton({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-3">
      <Button
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);

          try {
            const response = await fetch(`/api/lite/links/${token}/checkout`, {
              method: "POST",
            });
            const payload = (await response.json()) as { error?: string; url?: string };
            if (!response.ok || !payload.url) {
              throw new Error(payload.error ?? "Could not start checkout.");
            }

            window.location.href = payload.url;
          } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Could not start checkout.");
            setPending(false);
          }
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {pending ? "Redirecting..." : "Unlock full workbook"}
      </Button>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
    </div>
  );
}

export { LiteCheckoutButton };
