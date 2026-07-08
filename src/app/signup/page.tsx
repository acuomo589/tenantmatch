"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/auth/supabaseBrowser";

export default function SignUpPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      setStatus("error");
      setMessage("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const redirectTo = `${window.location.origin}/auth/callback?next=/workspace`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: fullName.trim() || undefined,
          workspace_name: workspaceName.trim() || undefined,
        },
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Magic link sent. Check your inbox to complete signup.");
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section className="card" style={{ width: "100%", maxWidth: 460, padding: 20, display: "grid", gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Create your TenantMatch workspace</h1>
        <p style={{ color: "#64748b", fontSize: 14 }}>Start on Free. Upgrade when your team needs more capacity.</p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Your name"
            className="input"
          />
          <input
            type="text"
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            placeholder="Workspace name (optional)"
            className="input"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className="input"
          />
          <button className="btn" type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Sending..." : "Send magic link"}
          </button>
        </form>
        {message ? (
          <p style={{ fontSize: 13, color: status === "error" ? "#b91c1c" : "#1d4ed8" }}>{message}</p>
        ) : null}
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Already have an account? <Link href="/signin">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
