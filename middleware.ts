import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseConfig, isSupabaseConfigError } from "@/lib/auth/supabaseConfig";

const PUBLIC_PATH_PREFIXES = ["/", "/signin", "/signup", "/pricing", "/auth/callback", "/r/"];

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => prefix !== "/" && pathname.startsWith(prefix));
}

function isPublicApi(pathname: string) {
  return pathname.startsWith("/api/webhooks/") || /^\/api\/lite\/links\/[^/]+\/(opened|checkout)$/.test(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const shouldSkipAuthLookup =
    (pathname !== "/" && isPublicPath(pathname)) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    isPublicApi(pathname);

  if (shouldSkipAuthLookup) {
    return NextResponse.next();
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  let user = null;

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(
            cookiesToSet: Array<{ name: string; value: string; options: Parameters<typeof response.cookies.set>[2] }>,
          ) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    const authResult = await supabase.auth.getUser();
    user = authResult.data.user;
  } catch (error) {
    if (isSupabaseConfigError(error)) {
      return NextResponse.next();
    }
    throw error;
  }

  if (user && pathname === "/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/workspace";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (!user && (pathname.startsWith("/workspace") || pathname.startsWith("/listings") || pathname.startsWith("/api/"))) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/signin";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
