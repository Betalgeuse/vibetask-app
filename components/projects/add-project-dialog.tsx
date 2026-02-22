"use client";
import { PlusIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Form, FormControl, FormField, FormItem } from "../ui/form";
import { useForm } from "react-hook-form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@/lib/supabase/hooks";
import { api } from "@/lib/supabase/api";
import { useToast } from "../ui/use-toast";
import {
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
} from "@/lib/i18n";
import { useMemo } from "react";

export default function AddProjectDialog() {
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const locale = normalizeAppLocale(featureSettings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);

  return (
    <Dialog>
      <DialogTrigger id="closeDialog">
        <PlusIcon
          className="h-5 w-5"
          aria-label={messages.navigation.addProjectAriaLabel}
        />
      </DialogTrigger>
      <AddProjectDialogContent messages={messages} />
    </Dialog>
  );
}

function AddProjectDialogContent({
  messages,
}: {
  messages: ReturnType<typeof getLocaleMessages>;
}) {
  const form = useForm({ defaultValues: { name: "" } });
  const { toast } = useToast();
  const router = useRouter();

  const createAProject = useMutation(api.projects.createAProject);

  const onSubmit = async ({ name }: any) => {
    console.log("submitted", { name });

    const projectId = await createAProject({ name });

    if (projectId !== undefined) {
      toast({
        title: messages.dialogs.addProject.createdSuccessTitle,
        duration: 3000,
      });
      form.reset({ name: "" });
      router.push(`/loggedin/projects/${projectId}`);
    }
  };
  return (
    <DialogContent className="max-w-xl lg:h-56 flex flex-col md:flex-row lg:justify-between text-right">
      <DialogHeader className="w-full">
        <DialogTitle>{messages.dialogs.addProject.title}</DialogTitle>
        <DialogDescription className="capitalize">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-2 border-2 p-6 border-gray-200 my-2 rounded-sm border-foreground/20"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        id="name"
                        type="text"
                        placeholder={messages.dialogs.addProject.namePlaceholder}
                        required
                        className="border-0 font-semibold text-lg"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              ></FormField>
              <Button className="">{messages.dialogs.addProject.submit}</Button>
            </form>
          </Form>
        </DialogDescription>
      </DialogHeader>
    </DialogContent>
  );
}
