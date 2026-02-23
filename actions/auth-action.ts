"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

function getOriginFromHeaders() {
  const normalize = (value: string) => value.replace(/\/+$/, "");
  const headerList = headers();
  const forwardedHost = headerList.get("x-forwarded-host");
  const rawHost = forwardedHost ?? headerList.get("host");
  const host = rawHost?.split(",")[0]?.trim();
  const rawProtocol = headerList.get("x-forwarded-proto");
  const protocol = rawProtocol?.split(",")[0]?.trim();

  if (host) {
    const resolvedProtocol =
      protocol ?? (host.includes("localhost") ? "http" : "https");
    return normalize(`${resolvedProtocol}://${host}`);
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return normalize(process.env.NEXT_PUBLIC_SITE_URL);
  }

  return "http://localhost:3000";
}

function toRoute(pathname: string, search: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  Object.entries(search).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  });

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function toHomeRoute(search: Record<string, string | null | undefined>) {
  return toRoute("/", search);
}

function toSettingsRoute(search: Record<string, string | null | undefined>) {
  return toRoute("/loggedin/settings", search);
}

function isMissingDeleteMyAccountFunction(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";
  const normalized = message.toLowerCase();

  return (
    code === "PGRST202" ||
    code === "42883" ||
    (normalized.includes("delete_my_account") &&
      (normalized.includes("function") || normalized.includes("schema cache")))
  );
}

async function deleteUserWithServiceRole(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return "회원 탈퇴 기능이 아직 완전히 설정되지 않았습니다. v9 SQL 마이그레이션을 적용해 주세요.";
  }

  const serviceRoleClient = createServiceRoleClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await serviceRoleClient.auth.admin.deleteUser(userId);
  return error?.message ?? null;
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

export async function deleteAccountAction() {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(toHomeRoute({ error: "회원 탈퇴를 하려면 먼저 로그인해 주세요." }));
  }

  const { error: rpcError } = await supabase.rpc("delete_my_account");
  let deletionErrorMessage = rpcError?.message ?? null;

  if (rpcError && isMissingDeleteMyAccountFunction(rpcError)) {
    deletionErrorMessage = await deleteUserWithServiceRole(user.id);
  }

  if (deletionErrorMessage) {
    redirect(toSettingsRoute({ error: deletionErrorMessage }));
  }

  await supabase.auth.signOut();
  redirect(toHomeRoute({ message: "회원 탈퇴가 완료되었습니다." }));
}
