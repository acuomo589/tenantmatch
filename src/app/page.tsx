import Link from "next/link";

export default function LandingPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section className="card" style={{ width: "100%", maxWidth: 840, padding: 28, display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ fontSize: 12, letterSpacing: 1.1, textTransform: "uppercase", color: "#1d4ed8", fontWeight: 700 }}>
            Timpani
          </p>
          <h1 style={{ fontSize: 42, lineHeight: 1.05, fontWeight: 800 }}>
            From listing upload to proposals and outbound emails.
          </h1>
          <p style={{ color: "#475569", maxWidth: 700 }}>
            A lean AI workflow for commercial real estate teams: ingest listings, explore repositioning options, generate
            workbooks, and launch outreach from a single workspace.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/signup" className="btn">
            Start free
          </Link>
          <Link href="/signin" className="btn secondary">
            Sign in
          </Link>
          <Link href="/pricing" className="btn secondary">
            Pricing
          </Link>
        </div>
      </section>
    </main>
  );
}
