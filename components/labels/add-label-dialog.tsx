import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/supabase/api";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "../ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "../ui/form";
import { Input } from "../ui/input";
import { useToast } from "../ui/use-toast";
import { Id } from "@/lib/supabase/types";
import { useMutation } from "@/lib/supabase/hooks";
import { useState } from "react";
import { Loader } from "lucide-react";

type AddLabelFormValues = {
  name: string;
  color: string;
};

export default function AddLabelDialog() {
  const addLabelMutation = useMutation(api.labels.createALabel);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { toast } = useToast();
  const form = useForm<AddLabelFormValues>({
    defaultValues: {
      name: "",
      color: "#6366f1",
    },
  });

  const onSubmit = async ({ name, color }: AddLabelFormValues) => {
    if (!name) {
      return;
    }

    setIsLoading(true);
    try {
      const labelId: Id<"labels"> | null = await addLabelMutation({
        name,
        color,
      });

      if (labelId != undefined) {
        router.push(`/loggedin/filter-labels/${labelId}`);
        // document.getElementById("closeDialog")?.click();

        toast({
          title: "😎 Successfully created a Label!",
          duration: 5000,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogContent className="max-w-xl flex flex-col md:flex-row lg:justify-between text-right">
      <DialogHeader className="w-full">
        <DialogTitle>Add a Label</DialogTitle>
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
                        placeholder="Label name"
                        required
                        className="border-0 font-semibold text-lg"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              ></FormField>
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-foreground/70">
                      Label color
                    </FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <Input
                          id="color"
                          type="color"
                          className="h-10 w-16 cursor-pointer p-1"
                          {...field}
                        />
                        <span className="text-xs text-foreground/70">
                          {field.value}
                        </span>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button disabled={isLoading} className="">
                {isLoading ? (
                  <div className="flex gap-2">
                    <Loader className="h-5 w-5 text-primary" />
                  </div>
                ) : (
                  "Add"
                )}
              </Button>
            </form>
          </Form>
        </DialogDescription>
      </DialogHeader>
    </DialogContent>
  );
}
