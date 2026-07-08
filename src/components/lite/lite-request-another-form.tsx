"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LiteRequestAnotherForm(args: {
  token: string;
  defaultBuyerEmail: string;
  defaultBuyerName: string | null;
  adminSignature?: string | null;
  mode: "public" | "admin";
}) {
  const [listingAddress, setListingAddress] = useState("");
  const [buyerEmail, setBuyerEmail] = useState(args.defaultBuyerEmail);
  const [buyerName, setBuyerName] = useState(args.defaultBuyerName ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-[2rem] border bg-white/95 px-6 py-6 shadow-sm">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Run Another Listing</h2>
        <p className="text-sm text-muted-foreground">
          Spin up a fresh TenantMatch preview link for another address using the same broker contact.
        </p>
      </div>

      <form
        className="mt-5 grid gap-4 md:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);

          try {
            const response = await fetch("/api/lite/listings/request-another", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                token: args.token,
                adminSignature: args.adminSignature,
                listingAddress,
                buyerEmail,
                buyerName,
              }),
            });

            const payload = (await response.json()) as { error?: string; url?: string; adminUrl?: string };
            const nextUrl = args.mode === "admin" ? payload.adminUrl || payload.url : payload.url;
            if (!response.ok || !nextUrl) {
              throw new Error(payload.error ?? "Could not generate a new listing link.");
            }

            window.location.href = nextUrl;
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Could not generate a new listing link.");
            setPending(false);
          }
        }}
      >
        <div className="grid gap-2 md:col-span-2">
          <label className="text-sm font-medium text-foreground" htmlFor="request-another-address">
            Listing address
          </label>
          <Input
            id="request-another-address"
            value={listingAddress}
            onChange={(event) => setListingAddress(event.target.value)}
            placeholder="123 Main St, City, ST ZIP"
            required
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-foreground" htmlFor="request-another-email">
            Broker email
          </label>
          <Input
            id="request-another-email"
            value={buyerEmail}
            onChange={(event) => setBuyerEmail(event.target.value)}
            placeholder="broker@example.com"
            required
            type="email"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-foreground" htmlFor="request-another-name">
            Broker name
          </label>
          <Input
            id="request-another-name"
            value={buyerName}
            onChange={(event) => setBuyerName(event.target.value)}
            placeholder="Broker name"
          />
        </div>

        <div className="md:col-span-2">
          <Button disabled={pending} type="submit">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {pending ? "Creating link..." : "Generate next listing"}
          </Button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 md:col-span-2">
            {error}
          </div>
        ) : null}
      </form>
    </section>
  );
}

export { LiteRequestAnotherForm };
