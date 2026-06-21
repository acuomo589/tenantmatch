import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/auth/supabaseServer";

export default async function LandingPage() {
  const hasSupabaseConfig =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (hasSupabaseConfig) {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        redirect("/workspace");
      }
    } catch {
      // Fall back to the public landing page if auth lookup fails.
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section className="card" style={{ width: "100%", maxWidth: 840, padding: 28, display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ fontSize: 12, letterSpacing: 1.1, textTransform: "uppercase", color: "#1d4ed8", fontWeight: 700 }}>
            Timpani Lite
          </p>
          <h1 style={{ fontSize: 42, lineHeight: 1.05, fontWeight: 800 }}>
            Turn sheet rows into paid workbook links.
          </h1>
          <p style={{ color: "#475569", maxWidth: 700 }}>
            Add an address and buyer email to your Google Sheet, process new rows from the admin panel, and share a buyer-specific
            paywall URL that unlocks CSV and PDF downloads after purchase.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/workspace" className="btn">
            Open admin
          </Link>
          <Link href="/signin" className="btn secondary">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
