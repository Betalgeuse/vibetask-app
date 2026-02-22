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
  const supabase = createClient();
  const origin = getOriginFromHeaders();

  let oauthUrl: string | null = null;
  let oauthError: string | null = null;

  try {
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

    oauthError = error?.message ?? null;
    oauthUrl = data?.url ?? null;
  } catch (error) {
    oauthError =
      error instanceof Error ? error.message : "Google sign-in failed.";
  }

  if (oauthError) {
    redirect(`/?error=${encodeURIComponent(oauthError)}`);
  }

  if (!oauthUrl) {
    redirect("/?error=Unable%20to%20start%20Google%20sign-in");
  }

  redirect(oauthUrl);
}

export async function signInAction() {
  return signInWithGoogleAction();
}

export async function signInWithEmailAction(formData: FormData) {
  const emailValue = formData?.get?.("email");
  const email =
    typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";

  if (!email) {
    redirect("/?error=Email%20is%20required.");
  }

  const supabase = createClient();
  const origin = getOriginFromHeaders();

  let otpError: string | null = null;

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/loggedin`,
      },
    });

    otpError = error?.message ?? null;
  } catch (error) {
    otpError =
      error instanceof Error ? error.message : "Email sign-in failed.";
  }

  if (otpError) {
    redirect(`/?error=${encodeURIComponent(otpError)}`);
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
