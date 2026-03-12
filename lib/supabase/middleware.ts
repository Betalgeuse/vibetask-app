import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    return null;
  }
  return value;
}

export async function updateSession(request: NextRequest) {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    // Keep app bootable even when Supabase env is not configured yet.
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { pathname, searchParams } = request.nextUrl;

  // Some OAuth flows can return to "/" with ?code=... in production.
  // Force that through our callback route so the session cookie is exchanged.
  if (pathname === "/" && searchParams.get("code")) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    callbackUrl.searchParams.set("next", "/loggedin");
    return NextResponse.redirect(callbackUrl);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set({ name, value });
        });

        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        });
      },
    },
  });

  // Only check auth for protected routes to minimize Supabase API calls (egress).
  if (pathname.startsWith("/loggedin")) {
    // Protected route: verify token server-side with getUser().
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }
  } else if (pathname === "/") {
    // Landing page: use getSession() (cookie-only, no API call) for redirect.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/loggedin";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}
