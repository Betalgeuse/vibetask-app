import {
  createGoogleCalendarEvent,
  refreshGoogleCalendarAccessToken,
} from "@/lib/google/calendar-client";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type CalendarTokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};

type CreateEventRequestBody = {
  taskName?: unknown;
  description?: unknown;
  dueDate?: unknown;
  durationMinutes?: unknown;
  timeZone?: unknown;
};

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

function parseDurationMinutes(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.min(Math.round(value), 24 * 60);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(parsed, 24 * 60);
    }
  }

  return 60;
}

function parseDate(value: unknown) {
  if (typeof value === "number" || typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function parseCreateEventBody(body: CreateEventRequestBody) {
  const taskName = typeof body.taskName === "string" ? body.taskName.trim() : "";
  if (!taskName) {
    throw new Error("taskName is required.");
  }

  const description =
    typeof body.description === "string" ? body.description.trim() || null : null;

  const startAt = parseDate(body.dueDate);
  const durationMinutes = parseDurationMinutes(body.durationMinutes);
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

  const timeZone =
    typeof body.timeZone === "string" && body.timeZone.trim().length > 0
      ? body.timeZone.trim()
      : undefined;

  return {
    taskName,
    description,
    durationMinutes,
    timeZone,
    start: startAt.toISOString(),
    end: endAt.toISOString(),
  };
}

export async function POST(request: Request) {
  let parsedBody: ReturnType<typeof parseCreateEventBody>;

  try {
    const requestBody = (await request.json()) as CreateEventRequestBody;
    parsedBody = parseCreateEventBody(requestBody);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid request body for calendar export.",
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
    const { event } = await createGoogleCalendarEvent({
      accessToken,
      event: {
        summary: parsedBody.taskName,
        description: parsedBody.description,
        start: parsedBody.start,
        end: parsedBody.end,
        timeZone: parsedBody.timeZone,
      },
    });

    return NextResponse.json(
      {
        connected: true,
        event,
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
        error:
          error instanceof Error ? error.message : "Failed to create calendar event.",
      },
      { status: 502 }
    );
  }
}
