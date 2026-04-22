import Link from "next/link";
import { PLAN_CATALOG, getPlanDisplayPrice } from "@/lib/billing/plans";

export const metadata = {
  title: "Pricing | Timpani",
  description: "Simple self-serve pricing for Timpani: Free, Plus, and Pro tiers.",
};

export default function PricingPage() {
  return (
    <main style={{ minHeight: "100vh", padding: "48px 20px", maxWidth: 1040, margin: "0 auto" }}>
      <header style={{ display: "grid", gap: 8, marginBottom: 24 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800 }}>Pricing</h1>
        <p style={{ color: "#475569" }}>Start free. Upgrade as your listing and outreach volume grows.</p>
      </header>

      <section style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {PLAN_CATALOG.map((plan) => (
          <article key={plan.code} className="card" style={{ padding: 18, display: "grid", gap: 10 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700 }}>{plan.name}</h2>
            <div style={{ fontSize: 32, fontWeight: 800 }}>
              {getPlanDisplayPrice(plan.monthlyPriceCents)}
              <span style={{ fontSize: 14, color: "#64748b", marginLeft: 4 }}>/month</span>
            </div>

            <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", display: "grid", gap: 6, fontSize: 14 }}>
              <li>{plan.limits.listings} listings</li>
              <li>{plan.limits.contacts} contacts</li>
              <li>{plan.limits.workbooks} workbooks</li>
              <li>{plan.limits.workbookRows} workbook rows / month</li>
            </ul>

            <div style={{ marginTop: 8 }}>
              <Link href={plan.code === "FREE" ? "/signup" : "/workspace"} className="btn">
                {plan.code === "FREE" ? "Start free" : "Upgrade"}
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
