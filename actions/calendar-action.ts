"use server";

import {
  buildGoogleCalendarAuthUrl,
  isGoogleCalendarOauthConfigured,
} from "@/lib/google/calendar-client";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

const CALENDAR_OAUTH_STATE_COOKIE = "google_calendar_oauth_state";

function getOriginFromHeaders() {
  const normalize = (value: string) => value.replace(/\/+$/, "");
  const headerList = headers();
  const forwardedHost = headerList.get("x-forwarded-host");
  const rawHost = forwardedHost ?? headerList.get("host");
  const host = rawHost?.split(",")[0]?.trim();
  const rawProtocol = headerList.get("x-forwarded-proto");
  const protocol = rawProtocol?.split(",")[0]?.trim();

  if (host) {
    const resolvedProtocol = protocol ?? (host.includes("localhost") ? "http" : "https");
    return normalize(`${resolvedProtocol}://${host}`);
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return normalize(process.env.NEXT_PUBLIC_SITE_URL);
  }

  return "http://localhost:3000";
}

function toSettingsRoute(search: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  Object.entries(search).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  });

  const query = params.toString();
  return query ? `/loggedin/settings?${query}` : "/loggedin/settings";
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

export async function authorizeCalendarAction() {
  if (!isGoogleCalendarOauthConfigured()) {
    redirect(
      toSettingsRoute({
        error: "Google Calendar env is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      })
    );
  }

  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(toSettingsRoute({ error: "You need to sign in before connecting Calendar." }));
  }

  const origin = getOriginFromHeaders();
  const state = randomUUID();
  const cookieStore = cookies();

  cookieStore.set({
    name: CALENDAR_OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: !origin.includes("localhost"),
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  const url = buildGoogleCalendarAuthUrl({ origin, state });
  redirect(url);
}

export async function disconnectCalendarAction() {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(toSettingsRoute({ error: "You need to sign in before disconnecting Calendar." }));
  }

  const { error } = await supabase
    .from("user_calendar_tokens")
    .delete()
    .eq("user_id", user.id);

  if (error && !isRelationMissingError(error)) {
    redirect(
      toSettingsRoute({
        error: "Failed to disconnect Calendar token. Please retry.",
      })
    );
  }

  redirect(toSettingsRoute({ message: "Google Calendar disconnected." }));
}
