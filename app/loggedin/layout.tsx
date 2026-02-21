import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LoggedInLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient();
  let user = null;

  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch {
    redirect("/?error=Please%20sign%20in%20again.");
  }

  if (!user) {
    redirect("/");
  }

  return <>{children}</>;
}
