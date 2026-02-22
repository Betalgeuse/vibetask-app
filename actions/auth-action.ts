"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

function getOriginFromHeaders() {
  const normalize = (value: string) => value.replace(/\/+$/, "");

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return normalize(process.env.NEXT_PUBLIC_SITE_URL);
  }

  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";

  if (host) {
    return normalize(`${protocol}://${host}`);
  }

  return "http://localhost:3000";
}

export async function signInWithGoogleAction() {
  try {
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google sign-in failed.";
    redirect(`/?error=${encodeURIComponent(message)}`);
  }
}

export async function signInAction() {
  return signInWithGoogleAction();
}

export async function signInWithEmailAction(formData: FormData) {
  const emailValue = formData.get("email");
  const email =
    typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";

  if (!email) {
    redirect("/?error=Email%20is%20required.");
  }

  try {
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Email sign-in failed.";
    redirect(`/?error=${encodeURIComponent(message)}`);
  }
}

export async function signOutAction() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    redirect(`/?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}
