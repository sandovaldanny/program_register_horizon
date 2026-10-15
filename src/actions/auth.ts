"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** Constant-time compare of two strings regardless of their lengths. */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

export type LoginState = { error: string | null };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  const expectedUser = process.env.ADMIN_USERNAME ?? "";
  const expectedPass = process.env.ADMIN_PASSWORD ?? "";
  const ok =
    expectedUser.length > 0 &&
    expectedPass.length > 0 &&
    safeEqual(username, expectedUser) &&
    safeEqual(password, expectedPass);

  if (!ok) {
    await new Promise((r) => setTimeout(r, 300));
    return { error: "invalid" };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(username), sessionCookieOptions());
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
