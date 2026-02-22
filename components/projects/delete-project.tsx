import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/supabase/api";
import { useAction, useQuery } from "@/lib/supabase/hooks";
import { EllipsisIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useToast } from "../ui/use-toast";
import { Id } from "@/lib/supabase/types";
import {
  DEFAULT_APP_LOCALE,
  getLocaleMessages,
  normalizeAppLocale,
} from "@/lib/i18n";
import { useMemo } from "react";

export default function DeleteProject({
  projectId,
}: {
  projectId: Id<"projects">;
}) {
  const form = useForm({ defaultValues: { name: "" } });
  const { toast } = useToast();
  const router = useRouter();
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const locale = normalizeAppLocale(featureSettings?.locale, DEFAULT_APP_LOCALE);
  const messages = useMemo(() => getLocaleMessages(locale), [locale]);

  const deleteProject = useAction(api.projects.deleteProjectAndItsTasks);

  const onSubmit = async () => {
    const result = await deleteProject({ projectId });

    if (!result?.ok) {
      toast({
        title: messages.dialogs.deleteProject.reminderTitle,
        description:
          result?.reason || messages.dialogs.deleteProject.reminderDescription,
        duration: 3000,
      });
      return;
    }

    toast({
      title: messages.dialogs.deleteProject.successTitle,
      duration: 3000,
    });
    router.push(`/loggedin/projects`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <EllipsisIcon className="w-5 h-5 text-foreground hover:cursor-pointer" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="w-40 lg:w-56">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <button type="submit" className="flex gap-2">
              <Trash2 className="w-5 h-5 rotate-45 text-foreground/40" />
              {messages.dialogs.deleteProject.actionLabel}
            </button>
          </form>
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
