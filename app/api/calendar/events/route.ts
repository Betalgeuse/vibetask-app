import {
  fetchGoogleCalendarEvents,
  refreshGoogleCalendarAccessToken,
} from "@/lib/google/calendar-client";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type CalendarTokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};

function toRange(searchParams: URLSearchParams) {
  const now = new Date();
  const defaultMin = now.toISOString();
  const defaultMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const timeMin = searchParams.get("timeMin") ?? defaultMin;
  const timeMax = searchParams.get("timeMax") ?? defaultMax;

  if (Number.isNaN(new Date(timeMin).getTime()) || Number.isNaN(new Date(timeMax).getTime())) {
    throw new Error("timeMin/timeMax must be valid ISO datetime strings.");
  }

  return { timeMin, timeMax };
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

function needsRefresh(expiresAt: string | null) {
  if (!expiresAt) {
    return false;
  }

  const expiry = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiry)) {
    return false;
  }

  return expiry <= Date.now() + 30_000;
}

function toExpiresAt(expiresIn?: number) {
  if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn)) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

export async function GET(request: Request) {
  let range: { timeMin: string; timeMax: string };

  try {
    range = toRange(new URL(request.url).searchParams);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid date range.",
      },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tokenRow, error: tokenError } = await supabase
    .from("user_calendar_tokens")
    .select("access_token,refresh_token,expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (tokenError) {
    if (isRelationMissingError(tokenError)) {
      return NextResponse.json(
        {
          error: "Calendar token table is missing. Apply v8 migration first.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: "Failed to read calendar token." }, { status: 500 });
  }

  const tokens = tokenRow as CalendarTokenRow | null;

  if (!tokens?.access_token && !tokens?.refresh_token) {
    return NextResponse.json({ error: "Calendar not connected" }, { status: 400 });
  }

  let accessToken = tokens?.access_token ?? null;
  const refreshToken = tokens?.refresh_token ?? null;

  if ((!accessToken || needsRefresh(tokens?.expires_at ?? null)) && refreshToken) {
    try {
      const refreshed = await refreshGoogleCalendarAccessToken({ refreshToken });
      accessToken = refreshed.accessToken;

      const { error: updateError } = await supabase
        .from("user_calendar_tokens")
        .update({
          access_token: refreshed.accessToken,
          token_type: refreshed.tokenType ?? null,
          scope: refreshed.scope ?? null,
          expires_at: toExpiresAt(refreshed.expiresIn),
        })
        .eq("user_id", user.id);

      if (updateError && !isRelationMissingError(updateError)) {
        return NextResponse.json(
          { error: "Failed to persist refreshed calendar token." },
          { status: 500 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to refresh Calendar access token.",
        },
        { status: 401 }
      );
    }
  }

  if (!accessToken) {
    return NextResponse.json(
      {
        error: "Calendar access token is missing. Reconnect Google Calendar.",
      },
      { status: 400 }
    );
  }

  try {
    const { events } = await fetchGoogleCalendarEvents({
      accessToken,
      timeMin: range.timeMin,
      timeMax: range.timeMax,
    });

    return NextResponse.json(
      {
        connected: true,
        timeMin: range.timeMin,
        timeMax: range.timeMax,
        events,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch calendar events.",
      },
      { status: 502 }
    );
  }
}
