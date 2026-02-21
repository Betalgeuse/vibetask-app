"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

function getOriginFromHeaders() {
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (host) {
    return `${protocol}://${host}`;
  }

  return "http://localhost:3000";
}

export async function signInWithGoogleAction() {
  const supabase = createClient();
  const origin = getOriginFromHeaders();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=/loggedin`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    redirect(`/?error=${encodeURIComponent(error.message)}`);
  }

  if (!data.url) {
    redirect("/?error=Unable%20to%20start%20Google%20sign-in");
  }

  redirect(data.url);
}

export async function signInAction() {
  return signInWithGoogleAction();
}

export async function signInWithEmailAction(formData: FormData) {
  const emailValue = formData.get("email");
  const email =
    typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";

  if (!email) {
    throw new Error("Email is required.");
  }

  const supabase = createClient();
  const origin = getOriginFromHeaders();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/loggedin`,
    },
  });

  if (error) {
    redirect(`/?error=${encodeURIComponent(error.message)}`);
  }

  redirect(
    "/?message=Check%20your%20email%20for%20the%20sign-in%20link%20to%20continue."
  );
}

export async function signOutAction() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    redirect(`/?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}
