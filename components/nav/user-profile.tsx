"use client";
import { signOutAction } from "@/actions/auth-action";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { api } from "@/lib/supabase/api";
import { useQuery } from "@/lib/supabase/hooks";
import {
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
} from "@/lib/i18n";

export default function UserProfile() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const locale = normalizeAppLocale(featureSettings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (isMounted) {
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error("Failed to load profile session:", error);
      }
    };

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const imageUrl =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;
  const name =
    user?.user_metadata?.name ?? user?.email ?? messages.navigation.userFallbackName;
  const email = user?.email ?? messages.navigation.userFallbackAccount;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="hover:cursor-pointer">
        <Button
          variant={"secondary"}
          className="m-0 flex w-full min-w-0 items-center justify-start gap-1 bg-white p-1 lg:w-full lg:gap-2 lg:px-3"
        >
          {imageUrl && (
            <Image
              src={imageUrl}
              width={24}
              height={24}
              alt={`${name} ${messages.navigation.profileImageAltSuffix}`}
              className="rounded-full"
            />
          )}
          <p className="min-w-0 truncate text-left">{email}</p>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-56 max-w-[calc(100vw-1rem)]"
      >
        <DropdownMenuItem className="w-full justify-center">
          <form action={signOutAction}>
            <Button
              type="submit"
              variant={"ghost"}
              className="hover:text-primary"
            >
              {messages.navigation.signOut}
            </Button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
