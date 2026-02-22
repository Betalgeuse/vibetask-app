"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import { CalendarDays, ExternalLink, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type CalendarSidebarEvent = {
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

type CalendarEventsResponse = {
  connected?: boolean;
  events?: CalendarSidebarEvent[];
  error?: string;
};

type CalendarSidebarProps = {
  daysAhead?: number;
};

const DEFAULT_DAYS_AHEAD = 7;

function buildCalendarRange(daysAhead: number) {
  const safeDaysAhead = Number.isFinite(daysAhead) ? Math.max(1, Math.floor(daysAhead)) : 1;
  const timeMin = moment().startOf("day").toISOString();
  const timeMax = moment().startOf("day").add(safeDaysAhead, "day").toISOString();
  return { timeMin, timeMax };
}

function getEventDayKey(event: CalendarSidebarEvent) {
  if (!event.start) {
    return "unscheduled";
  }

  const start = moment(event.start);
  if (!start.isValid()) {
    return "unscheduled";
  }

  return start.format("YYYY-MM-DD");
}

function formatDayLabel(dayKey: string) {
  if (dayKey === "unscheduled") {
    return "Unscheduled";
  }

  const date = moment(dayKey, "YYYY-MM-DD", true);
  if (!date.isValid()) {
    return dayKey;
  }

  if (date.isSame(moment(), "day")) {
    return "Today";
  }

  if (date.isSame(moment().add(1, "day"), "day")) {
    return "Tomorrow";
  }

  return date.format("ddd, MMM D");
}

function formatEventTime(event: CalendarSidebarEvent) {
  if (event.allDay) {
    return "All day";
  }

  const start = event.start ? moment(event.start) : null;
  if (!start?.isValid()) {
    return "Time TBD";
  }

  const startLabel = start.format("h:mm A");
  const end = event.end ? moment(event.end) : null;
  if (!end?.isValid()) {
    return startLabel;
  }

  if (start.isSame(end, "day")) {
    return `${startLabel} - ${end.format("h:mm A")}`;
  }

  return `${startLabel} - ${end.format("ddd h:mm A")}`;
}

function normalizeResponseEvents(payload: CalendarEventsResponse | null) {
  if (!Array.isArray(payload?.events)) {
    return [] as CalendarSidebarEvent[];
  }

  return payload.events
    .filter((event): event is CalendarSidebarEvent => {
      return typeof event?.id === "string" && event.id.trim().length > 0;
    })
    .map((event) => ({
      ...event,
      summary: event.summary?.trim() || "(No title)",
      description: event.description?.trim() || null,
      location: event.location?.trim() || null,
      hangoutLink: event.hangoutLink?.trim() || null,
      htmlLink: event.htmlLink?.trim() || null,
      start: event.start?.trim() || null,
      end: event.end?.trim() || null,
      allDay: Boolean(event.allDay),
    }));
}

function isCalendarDisconnectedMessage(message: string | null) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("calendar not connected") ||
    normalized.includes("reconnect google calendar") ||
    normalized.includes("access token is missing")
  );
}

export default function CalendarSidebar({
  daysAhead = DEFAULT_DAYS_AHEAD,
}: CalendarSidebarProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalendarSidebarEvent[]>([]);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const range = buildCalendarRange(daysAhead);
      const response = await fetch(
        `/api/calendar/events?timeMin=${encodeURIComponent(range.timeMin)}&timeMax=${encodeURIComponent(range.timeMax)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const payload = (await response.json().catch(() => null)) as CalendarEventsResponse | null;

      if (!response.ok) {
        const nextError = payload?.error?.trim() || "Failed to load calendar events.";
        setEvents([]);
        setError(nextError);
        setIsConnected(!isCalendarDisconnectedMessage(nextError) ? null : false);
        return;
      }

      setEvents(normalizeResponseEvents(payload));
      setIsConnected(payload?.connected ?? true);
    } catch (nextError) {
      setEvents([]);
      setError(nextError instanceof Error ? nextError.message : "Failed to load calendar events.");
      setIsConnected(null);
    } finally {
      setIsLoading(false);
    }
  }, [daysAhead]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, CalendarSidebarEvent[]>();

    events.forEach((event) => {
      const dayKey = getEventDayKey(event);
      const existing = groups.get(dayKey);
      if (existing) {
        existing.push(event);
      } else {
        groups.set(dayKey, [event]);
      }
    });

    return Array.from(groups.entries()).sort(([left], [right]) => {
      if (left === right) {
        return 0;
      }
      if (left === "unscheduled") {
        return 1;
      }
      if (right === "unscheduled") {
        return -1;
      }
      return left.localeCompare(right);
    });
  }, [events]);

  return (
    <aside className="rounded-lg border bg-card p-4 h-fit xl:sticky xl:top-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Calendar</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={isLoading}
          onClick={() => {
            void loadEvents();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
      <p className="mb-4 text-xs text-foreground/70">
        Google Calendar events for today + next {Math.max(1, Math.floor(daysAhead))} days.
      </p>

      {isLoading && (
        <p className="text-sm text-foreground/70" role="status">
          Loading calendar events...
        </p>
      )}

      {!isLoading && error && (
        <div className="rounded-md border bg-background p-3">
          <p className="text-sm text-foreground/80">{error}</p>
          <div className="mt-3">
            <Button asChild size="sm" variant="outline">
              <Link href="/loggedin/settings">Open calendar settings</Link>
            </Button>
          </div>
        </div>
      )}

      {!isLoading && !error && groupedEvents.length === 0 && (
        <p className="text-sm text-foreground/70">
          {isConnected === false
            ? "Connect Google Calendar in settings to see events."
            : "No upcoming events in this range."}
        </p>
      )}

      {!isLoading && !error && groupedEvents.length > 0 && (
        <div className="space-y-4">
          {groupedEvents.map(([dayKey, dayEvents]) => (
            <section key={dayKey}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/70">
                {formatDayLabel(dayKey)}
              </h3>
              <ul className="space-y-2">
                {dayEvents.map((event) => (
                  <li key={event.id} className="rounded-md border bg-background p-3">
                    <p className="text-sm font-medium leading-snug">{event.summary}</p>
                    <p className="mt-1 text-xs text-foreground/70">{formatEventTime(event)}</p>
                    {event.location && (
                      <p className="mt-1 line-clamp-1 text-xs text-foreground/70">{event.location}</p>
                    )}
                    {event.htmlLink && (
                      <a
                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        href={event.htmlLink}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Open in Google Calendar
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}
