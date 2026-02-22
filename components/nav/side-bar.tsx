"use client";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { primaryNavItems } from "@/utils";
import UserProfile from "./user-profile";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { api } from "@/lib/supabase/api";
import { useQuery } from "@/lib/supabase/hooks";
import { useEffect, useMemo, useState } from "react";
import { Hash, PlusIcon } from "lucide-react";
import { Doc } from "@/lib/supabase/types";
import { Dialog, DialogTrigger } from "../ui/dialog";
import AddProjectDialog from "../projects/add-project-dialog";
import AddLabelDialog from "../labels/add-label-dialog";
import {
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
} from "@/lib/i18n";

interface MyListTitleType {
  [key: string]: string;
}

export default function SideBar() {
  const pathname = usePathname();

  const projectList = useQuery(api.projects.getProjects);
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const locale = normalizeAppLocale(featureSettings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);
  const navigationMessages = messages.navigation;

  const LIST_OF_TITLE_IDS: MyListTitleType = useMemo(
    () => ({
      primary: "",
      projects: navigationMessages.sectionTitleProjects,
      productivity: navigationMessages.sectionTitleProductivity,
    }),
    [
      navigationMessages.sectionTitleProductivity,
      navigationMessages.sectionTitleProjects,
    ]
  );

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

  const [navItems, setNavItems] = useState(localizedPrimaryNavItems);

  const renderItems = (projectList: Array<Doc<"projects">>) => {
    return projectList.map(({ _id, name }, idx) => {
      return {
        ...(idx === 0 && { id: "projects" }),
        name,
        link: `/loggedin/projects/${_id.toString()}`,
        icon: <Hash className="w-4 h-4" />,
      };
    });
  };
  useEffect(() => {
    if (projectList) {
      const projectItems = renderItems(projectList);
      const optionalItems = [
        ...(featureSettings?.enabledModules?.persona
          ? [
              {
                id: "productivity",
                name: navigationMessages.itemPersonas,
                link: "/loggedin/personas",
                icon: <Hash className="w-4 h-4" />,
              },
            ]
          : []),
        ...(featureSettings?.enabledModules?.epic
          ? [
              {
                name: navigationMessages.itemEpics,
                link: "/loggedin/epics",
                icon: <Hash className="w-4 h-4" />,
              },
            ]
          : []),
      ];
      const items = [...localizedPrimaryNavItems, ...optionalItems, ...projectItems];
      setNavItems(items);
    }
  }, [
    featureSettings?.enabledModules?.epic,
    featureSettings?.enabledModules?.persona,
    localizedPrimaryNavItems,
    navigationMessages.itemEpics,
    navigationMessages.itemPersonas,
    projectList,
  ]);

  return (
    <div className="hidden border-r bg-muted/40 md:flex md:h-screen md:flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex justify-between h-14 items-center border-b p-1 lg:h-[60px] lg:px-2">
          <UserProfile />
        </div>
        <nav className="grid min-h-0 flex-1 items-start overflow-y-auto px-1 text-sm font-medium lg:px-4">
          {navItems.map(({ name, icon, link, id }, idx) => (
            <div key={idx}>
              {id && (
                <div
                  className={cn(
                    "flex items-center mt-6 mb-2",
                    id === "filters" && "my-0"
                  )}
                >
                  <p className="flex flex-1 text-base">
                    {LIST_OF_TITLE_IDS[id]}
                  </p>
                  {id === "projects" && <AddProjectDialog />}
                </div>
              )}
              <div className={cn("flex items-center lg:w-full")}>
                <div
                  className={cn(
                    "flex items-center text-left lg:gap-3 rounded-lg py-2 transition-all hover:text-primary justify-between w-full",
                    pathname === link
                      ? "active rounded-lg bg-primary/10 text-primary transition-all hover:text-primary"
                      : "text-foreground "
                  )}
                >
                  <Link
                    key={idx}
                    href={link}
                    className={cn(
                      "flex items-center text-left gap-3 rounded-lg transition-all hover:text-primary w-full"
                    )}
                  >
                    <div className="flex gap-4 items-center w-full">
                      <div className="flex gap-2 items-center">
                        <p className="flex text-base text-left">
                          {icon || <Hash />}
                        </p>
                        <p>{name}</p>
                      </div>
                    </div>
                  </Link>
                  {id === "filters" && (
                    <Dialog>
                      <DialogTrigger id="closeDialog">
                        <PlusIcon
                          className="h-5 w-5"
                          aria-label={navigationMessages.addLabelAriaLabel}
                        />
                      </DialogTrigger>
                      <AddLabelDialog />
                    </Dialog>
                  )}
                </div>
              </div>
            </div>
          ))}
        </nav>
      </div>
      <div className="mt-auto p-4">
        <Card x-chunk="dashboard-02-chunk-0">
          <CardHeader className="p-2 pt-0 md:p-4">
            <CardTitle>{navigationMessages.upgradeTitle}</CardTitle>
            <CardDescription>
              {navigationMessages.upgradeDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 pt-0 md:p-4 md:pt-0">
            <Button size="sm" className="w-full">
              {navigationMessages.upgradeCta}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
