import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

const PKCE_STORAGE_ERROR = "pkce code verifier not found in storage";

function formatCallbackErrorMessage(message: string, origin: string) {
  if (message.toLowerCase().includes(PKCE_STORAGE_ERROR)) {
    return `Google sign-in couldn't be completed because the PKCE verifier was missing. Finish sign-in in the same browser and device, keep the same domain, and add ${origin}/auth/callback to Supabase Auth Redirect URLs.`;
  }

  return message;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/loggedin";

  if (code) {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const message = formatCallbackErrorMessage(error.message, requestUrl.origin);
        return NextResponse.redirect(
          new URL(`/?error=${encodeURIComponent(message)}`, requestUrl.origin)
        );
      }
    } catch (error) {
      const message = formatCallbackErrorMessage(
        error instanceof Error ? error.message : "OAuth callback failed",
        requestUrl.origin
      );
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(message)}`, requestUrl.origin)
      );
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
