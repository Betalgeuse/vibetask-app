"use client";
import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "../ui/button";
import { Form, FormControl, FormField, FormItem } from "../ui/form";
import { Input } from "../ui/input";
import { useMemo } from "react";
import { api } from "@/lib/supabase/api";
import { useQuery } from "@/lib/supabase/hooks";
import {
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
} from "@/lib/i18n";

export default function SearchForm() {
  const form = useForm();
  const router = useRouter();
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const locale = normalizeAppLocale(featureSettings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);

  const onSubmit = async ({ searchText }: any) => {
    console.log("submitted", { searchText });
    router.push(`/loggedin/search/${searchText}`);
  };

  return (
    <Form {...form}>
      <form
        className="flex w-full items-center justify-end"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex w-full items-center gap-1.5">
          <FormField
            control={form.control}
            name="searchText"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <Input
                    id="searchText"
                    type="search"
                    required
                    placeholder={messages.navigation.searchTasksPlaceholder}
                    className="h-10 w-full appearance-none bg-background shadow-none"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          ></FormField>
          <Button
            type="submit"
            size="icon"
            className="h-10 w-9 shrink-0 hover:bg-orange-600"
          >
            <SearchIcon className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </Form>
  );
}
