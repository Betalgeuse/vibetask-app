"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  authorizeCalendarAction,
  disconnectCalendarAction,
} from "@/actions/calendar-action";
import { useToast } from "@/components/ui/use-toast";
import {
  APP_LOCALE_OPTIONS,
  APP_LOCALE_STORAGE_KEY,
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
  type AppLocale,
} from "@/lib/i18n";
import { api } from "@/lib/supabase/api";
import { useMutation, useQuery } from "@/lib/supabase/hooks";
import {
  DEFAULT_TASK_MODULE_FLAGS,
  TASK_MODULE_KEYS,
  type TaskModuleKey,
} from "@/lib/types/task-payload";

export default function SettingsModules() {
  const { toast } = useToast();
  const settings = useQuery(api.userFeatureSettings.getMySettings);
  const upsertSettings = useMutation(api.userFeatureSettings.upsertMySettings);
  const [locale, setLocale] = useState<AppLocale>(DEFAULT_APP_LOCALE);
  const [isSavingLocale, setIsSavingLocale] = useState(false);

  const enabledModules = useMemo(
    () => settings?.enabledModules ?? DEFAULT_TASK_MODULE_FLAGS,
    [settings?.enabledModules]
  );
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);
  const moduleLabels = messages.settings.modules;

  useEffect(() => {
    if (settings?.locale) {
      const nextLocale = normalizeAppLocale(settings.locale, DEFAULT_APP_LOCALE);
      setLocale(nextLocale);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, nextLocale);
      }
      return;
    }

    if (typeof window !== "undefined") {
      const storedLocale = window.localStorage.getItem(APP_LOCALE_STORAGE_KEY);
      setLocale(normalizeAppLocale(storedLocale, DEFAULT_APP_LOCALE));
    }
  }, [settings?.locale]);

  const onToggle = async (key: TaskModuleKey, enabled: boolean) => {
    const nextModules = {
      ...enabledModules,
      [key]: enabled,
    };
    const sidebarModules = nextModules.persona ? ["personas"] : [];

    await upsertSettings({
      enabledModules: nextModules,
      locale,
      sidebarModules,
      taskPropertyVisibility: {
        persona: nextModules.persona,
        epic: nextModules.epic,
        story: nextModules.story,
        workload: nextModules.workload,
        workflowStatus: nextModules.workflowStatus,
      },
    });
  };

  const onLocaleChange = async (nextValue: string) => {
    const nextLocale = normalizeAppLocale(nextValue, locale);
    if (nextLocale === locale) {
      return;
    }

    const previousLocale = locale;
    setLocale(nextLocale);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, nextLocale);
    }

    setIsSavingLocale(true);

    try {
      await upsertSettings({ locale: nextLocale });
    } catch (error) {
      setLocale(previousLocale);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, previousLocale);
      }
      toast({
        title: messages.settings.languageSaveErrorTitle,
        description:
          error instanceof Error
            ? error.message
            : messages.settings.languageSaveErrorDescription,
        duration: 3500,
      });
    } finally {
      setIsSavingLocale(false);
    }
  };

  return (
    <div className="xl:px-40">
      <h1 className="text-lg font-semibold md:text-2xl">
        {messages.settings.featureTitle}
      </h1>
      <p className="text-sm text-foreground/70 mt-2 mb-4">
        {messages.settings.featureDescription}
      </p>

      <div className="rounded-lg border bg-card p-4 mb-4">
        <p className="font-medium">{messages.settings.languageTitle}</p>
        <p className="text-xs text-foreground/70 mt-1">
          {messages.settings.languageDescription}
        </p>
        <div className="mt-3 max-w-xs">
          <label className="mb-1 block text-xs font-medium text-foreground/80">
            {messages.settings.languageLabel}
          </label>
          <select
            value={locale}
            disabled={isSavingLocale}
            onChange={(event) => {
              void onLocaleChange(event.target.value);
            }}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {APP_LOCALE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {isSavingLocale && (
            <p className="mt-2 text-xs text-foreground/70">
              {messages.settings.languageSaving}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {TASK_MODULE_KEYS.map((key) => {
          const label = moduleLabels[key];
          const checked = enabledModules[key];
          return (
            <div
              key={key}
              className="flex items-start justify-between gap-4 border-b last:border-b-0 p-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium">{label.title}</p>
                <p className="text-xs text-foreground/70 mt-1">{label.description}</p>
                {key === "calendarSync" && checked && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form action={authorizeCalendarAction}>
                      <button
                        type="submit"
                        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                      >
                        {messages.settings.connectCalendar}
                      </button>
                    </form>
                    <form action={disconnectCalendarAction}>
                      <button
                        type="submit"
                        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                      >
                        {messages.settings.disconnectCalendar}
                      </button>
                    </form>
                    <p className="basis-full text-xs text-foreground/70">
                      {messages.settings.calendarSidebarHint}
                    </p>
                    <Link
                      href="/loggedin/today"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {messages.settings.openTodayCalendar}
                    </Link>
                  </div>
                )}
              </div>
              <label className="mt-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={checked}
                  onChange={(event) => onToggle(key, event.target.checked)}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
