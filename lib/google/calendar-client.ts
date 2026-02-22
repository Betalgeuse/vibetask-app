const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_EVENTS_ENDPOINT =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const DEFAULT_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";

type CalendarAuthEnv = {
  clientId: string;
  clientSecret: string;
};

type CalendarTokenExchangeRaw = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GoogleCalendarEventDate = {
  date?: string;
  dateTime?: string;
};

type GoogleCalendarEventRaw = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  htmlLink?: string;
  start?: GoogleCalendarEventDate;
  end?: GoogleCalendarEventDate;
};

type GoogleCalendarEventsRaw = {
  items?: GoogleCalendarEventRaw[];
};

export type CalendarTokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
};

export type CalendarEvent = {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  hangoutLink: string | null;
  htmlLink: string | null;
  start: string | null;
  end: string | null;
  allDay: boolean;
};

export function getCalendarScopes() {
  return [DEFAULT_SCOPE];
}

export function isGoogleCalendarOauthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function getCalendarAuthEnv(): CalendarAuthEnv {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Calendar OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
    );
  }

  return { clientId, clientSecret };
}

function normalizeOrigin(origin?: string | null) {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  const source = origin?.trim() || fromEnv?.trim() || "http://localhost:3000";
  return source.replace(/\/+$/, "");
}

export function getGoogleCalendarCallbackUrl(origin?: string | null) {
  return `${normalizeOrigin(origin)}/api/auth/callback/google-calendar`;
}

export function buildGoogleCalendarAuthUrl(params?: {
  origin?: string | null;
  state?: string;
  scopes?: string[];
}) {
  const { clientId } = getCalendarAuthEnv();
  const redirectUri = getGoogleCalendarCallbackUrl(params?.origin);
  const scopes = params?.scopes && params.scopes.length > 0 ? params.scopes : getCalendarScopes();

  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");

  if (params?.state) {
    url.searchParams.set("state", params.state);
  }

  return url.toString();
}

function toTokenErrorMessage(payload: CalendarTokenExchangeRaw | null, fallback: string) {
  const message = payload?.error_description || payload?.error || "";
  return message.trim() || fallback;
}

export async function exchangeGoogleCalendarCodeForTokens(params: {
  code: string;
  origin?: string | null;
}): Promise<CalendarTokenSet> {
  const { clientId, clientSecret } = getCalendarAuthEnv();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: params.code,
    grant_type: "authorization_code",
    redirect_uri: getGoogleCalendarCallbackUrl(params.origin),
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as CalendarTokenExchangeRaw | null;

  if (!response.ok || !payload?.access_token) {
    throw new Error(
      toTokenErrorMessage(payload, "Failed to exchange calendar authorization code.")
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    tokenType: payload.token_type,
    scope: payload.scope,
  };
}

export async function refreshGoogleCalendarAccessToken(params: {
  refreshToken: string;
}): Promise<CalendarTokenSet> {
  const { clientId, clientSecret } = getCalendarAuthEnv();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: params.refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as CalendarTokenExchangeRaw | null;

  if (!response.ok || !payload?.access_token) {
    throw new Error(toTokenErrorMessage(payload, "Failed to refresh calendar access token."));
  }

  return {
    accessToken: payload.access_token,
    refreshToken: params.refreshToken,
    expiresIn: payload.expires_in,
    tokenType: payload.token_type,
    scope: payload.scope,
  };
}

export async function fetchGoogleCalendarEvents(params: {
  accessToken: string;
  timeMin: string;
  timeMax: string;
  maxResults?: number;
}) {
  const url = new URL(GOOGLE_EVENTS_ENDPOINT);
  url.searchParams.set("timeMin", params.timeMin);
  url.searchParams.set("timeMax", params.timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(params.maxResults ?? 100));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(payload?.error?.message || "Failed to fetch calendar events.");
  }

  const payload = (await response.json()) as GoogleCalendarEventsRaw;

  const events: CalendarEvent[] = (payload.items ?? [])
    .filter((event): event is GoogleCalendarEventRaw & { id: string } => {
      return typeof event.id === "string" && event.id.trim().length > 0;
    })
    .map((event) => {
      const start = event.start?.dateTime ?? event.start?.date ?? null;
      const end = event.end?.dateTime ?? event.end?.date ?? null;
      const allDay = Boolean(event.start?.date && !event.start?.dateTime);

      return {
        id: event.id,
        summary: event.summary?.trim() || "(No title)",
        description: event.description?.trim() || null,
        location: event.location?.trim() || null,
        hangoutLink: event.hangoutLink?.trim() || null,
        htmlLink: event.htmlLink?.trim() || null,
        start,
        end,
        allDay,
      };
    });

  return { events };
}
