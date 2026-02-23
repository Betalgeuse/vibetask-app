"use client";

import { Hash, Menu } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { primaryNavItems } from "@/utils";
import Image from "next/image";
import SearchForm from "./search-form";
import UserProfile from "./user-profile";
import { api } from "@/lib/supabase/api";
import { useQuery } from "@/lib/supabase/hooks";
import {
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
} from "@/lib/i18n";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import AddProjectDialog from "../projects/add-project-dialog";

export default function MobileNav({
  navTitle = "",
  navLink = "#",
}: {
  navTitle?: string;
  navLink?: string;
}) {
  const pathname = usePathname();
  const projectList = useQuery(api.projects.getProjects) ?? [];
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const locale = normalizeAppLocale(featureSettings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);
  const navigationMessages = messages.navigation;

  const getLocalizedNavItemName = useMemo(
    () => (id: string | undefined, link: string, fallbackName: string) => {
      if (id === "primary" || link === "/loggedin") {
        return navigationMessages.itemInbox;
      }
      if (link === "/loggedin/today") {
        return navigationMessages.itemToday;
      }
      if (link === "/loggedin/upcoming") {
        return navigationMessages.itemUpcoming;
      }
      if (link === "/loggedin/kanban") {
        return navigationMessages.itemKanban;
      }
      if (link === "/loggedin/eisenhower") {
        return navigationMessages.itemEisenhower;
      }
      if (id === "filters" || link === "/loggedin/filter-labels") {
        return navigationMessages.itemFilters;
      }
      if (id === "settings" || link === "/loggedin/settings") {
        return navigationMessages.itemSettings;
      }

      return fallbackName;
    },
    [
      navigationMessages.itemEisenhower,
      navigationMessages.itemFilters,
      navigationMessages.itemInbox,
      navigationMessages.itemKanban,
      navigationMessages.itemSettings,
      navigationMessages.itemToday,
      navigationMessages.itemUpcoming,
    ]
  );

  const localizedPrimaryNavItems = useMemo(
    () =>
      primaryNavItems.map((item) => ({
        ...item,
        name: getLocalizedNavItemName(item.id, item.link, item.name),
      })),
    [getLocalizedNavItemName]
  );

  const optionalItems = [
    ...(featureSettings?.enabledModules?.persona
      ? [
          {
            name: navigationMessages.itemPersonas,
            link: "/loggedin/personas",
            icon: <span className="text-xs">🧠</span>,
          },
        ]
      : []),
    ...(featureSettings?.enabledModules?.epic
      ? [
          {
            name: navigationMessages.itemEpics,
            link: "/loggedin/epics",
            icon: <span className="text-xs">🗂️</span>,
          },
        ]
      : []),
  ];

  const navItems = [...localizedPrimaryNavItems, ...optionalItems];

  const resolvedNavTitle = useMemo(() => {
    if (!navTitle.trim()) {
      return navTitle;
    }

    if (navLink === "/loggedin/projects") {
      return navigationMessages.itemMyProjects;
    }

    const titleMap: Record<string, string> = {
      Inbox: navigationMessages.itemInbox,
      Today: navigationMessages.itemToday,
      Upcoming: navigationMessages.itemUpcoming,
      Kanban: navigationMessages.itemKanban,
      "Eisenhower Matrix": navigationMessages.itemEisenhower,
      "Filters & Labels": navigationMessages.itemFilters,
      Settings: navigationMessages.itemSettings,
      Personas: navigationMessages.itemPersonas,
      Epics: navigationMessages.itemEpics,
      "My Projects": navigationMessages.itemMyProjects,
    };

    return titleMap[navTitle] ?? navTitle;
  }, [
    navLink,
    navTitle,
    navigationMessages.itemEisenhower,
    navigationMessages.itemEpics,
    navigationMessages.itemFilters,
    navigationMessages.itemInbox,
    navigationMessages.itemKanban,
    navigationMessages.itemMyProjects,
    navigationMessages.itemPersonas,
    navigationMessages.itemSettings,
    navigationMessages.itemToday,
    navigationMessages.itemUpcoming,
  ]);

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">
              {navigationMessages.toggleNavigationMenu}
            </span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex h-full flex-col overflow-hidden px-4 sm:px-6"
        >
          <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto pr-1 text-lg font-medium">
            <UserProfile />

            {navItems.map(({ name, icon, link }, idx) => (
              <Link
                key={idx}
                href={link}
                className="flex min-w-0 items-center gap-4 rounded-xl px-3 py-2 text-foreground/80 hover:text-foreground"
              >
                {icon}
                {name}
              </Link>
            ))}

            <div className="mb-2 mt-6 flex items-center justify-between gap-2">
              <p className="flex-1 text-base">
                {navigationMessages.itemMyProjects}
              </p>
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background/60 text-foreground">
                <AddProjectDialog />
              </div>
            </div>

            <div className="min-w-0 space-y-1 overflow-x-hidden pb-3">
              {projectList.map((project) => {
                const projectLink = `/loggedin/projects/${project._id}`;
                const isActive = pathname === projectLink;

                return (
                  <Link
                    key={project._id}
                    href={projectLink}
                    className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/80 hover:text-foreground"
                    }`}
                  >
                    <Hash className="h-4 w-4" />
                    <span className="block min-w-0 flex-1 truncate">
                      {project.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </SheetContent>
      </Sheet>
      <div className="flex w-full items-center gap-2 py-2">
        <div className="min-w-0">
          <Link href={navLink}>
            <p className="max-w-[6.5rem] truncate text-sm font-semibold text-foreground/70 sm:max-w-[8rem]">
              {resolvedNavTitle}
            </p>
          </Link>
        </div>
        <div className="min-w-0 flex-1">
          <SearchForm />
        </div>
        <div className="flex h-10 w-10 items-center justify-center lg:h-20 lg:w-16">
          <Image alt="logo" src="/logo/dunnit.png" width={40} height={40} />
        </div>
      </div>
    </header>
  );
}
