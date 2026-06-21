import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { hasSupabaseConfig, SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/auth/supabaseConfig";

export async function createSupabaseServerClient() {
  if (!hasSupabaseConfig()) {
    throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options: Parameters<typeof cookieStore.set>[2] }>,
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
}
