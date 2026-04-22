import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabaseServer";
import { ensureTenantProvisionedForUser } from "@/lib/auth/provisioning";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/workspace";

  if (!code) {
    return NextResponse.redirect(new URL("/signin", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/signin", url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id && user.email) {
    await ensureTenantProvisionedForUser({
      userId: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name as string | undefined,
      workspaceName: user.user_metadata?.workspace_name as string | undefined,
    });
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
