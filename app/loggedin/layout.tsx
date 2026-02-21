import Providers from "../providers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LoggedInLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return <Providers>{children}</Providers>;
}
