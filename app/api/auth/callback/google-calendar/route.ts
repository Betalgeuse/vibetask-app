import { exchangeGoogleCalendarCodeForTokens } from "@/lib/google/calendar-client";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type CalendarTokenRow = {
  refresh_token: string | null;
};
const CALENDAR_OAUTH_STATE_COOKIE = "google_calendar_oauth_state";

function redirectToSettings(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/loggedin/settings", request.url);

  Object.entries(params).forEach(([key, value]) => {
    if (value.trim()) {
      url.searchParams.set(key, value);
    }
  });

  const response = NextResponse.redirect(url);
  response.cookies.set({
    name: CALENDAR_OAUTH_STATE_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function isRelationMissingError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";

  return code === "42P01" || message.toLowerCase().includes("user_calendar_tokens");
}

function getExpiresAt(expiresInSeconds?: number) {
  if (typeof expiresInSeconds !== "number" || !Number.isFinite(expiresInSeconds)) {
    return null;
  }

  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const errorDescription =
    request.nextUrl.searchParams.get("error_description") ||
    request.nextUrl.searchParams.get("error");

  if (errorDescription) {
    return redirectToSettings(request, {
      error: `Calendar authorization failed: ${errorDescription}`,
    });
  }

  if (!code) {
    return redirectToSettings(request, {
      error: "Calendar authorization code is missing.",
    });
  }

  const expectedState = request.cookies.get(CALENDAR_OAUTH_STATE_COOKIE)?.value;
  const state = request.nextUrl.searchParams.get("state");

  if (!expectedState || !state || expectedState !== state) {
    return redirectToSettings(request, {
      error: "Calendar authorization state is invalid. Please try again.",
    });
  }

  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return redirectToSettings(request, {
      error: "You need to sign in before completing Calendar connection.",
    });
  }

  try {
    const tokens = await exchangeGoogleCalendarCodeForTokens({
      code,
      origin: request.nextUrl.origin,
    });

    const { data: existingTokens } = await supabase
      .from("user_calendar_tokens")
      .select("refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    const refreshToken =
      tokens.refreshToken ??
      (existingTokens as CalendarTokenRow | null)?.refresh_token ??
      null;

    const { error: upsertError } = await supabase.from("user_calendar_tokens").upsert(
      {
        user_id: user.id,
        access_token: tokens.accessToken,
        refresh_token: refreshToken,
        token_type: tokens.tokenType ?? null,
        scope: tokens.scope ?? null,
        expires_at: getExpiresAt(tokens.expiresIn),
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      if (isRelationMissingError(upsertError)) {
        return redirectToSettings(request, {
          error:
            "Calendar token table is missing. Apply v8 migration before connecting Calendar.",
        });
      }

      return redirectToSettings(request, {
        error: "Failed to save Calendar token. Please retry.",
      });
    }

    return redirectToSettings(request, {
      message: "Google Calendar connected successfully.",
    });
  } catch (error) {
    return redirectToSettings(request, {
      error: error instanceof Error ? error.message : "Calendar callback failed.",
    });
  }
}
