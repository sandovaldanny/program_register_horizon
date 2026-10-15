"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { CENTER_SCOPE_COOKIE, isCenterScope } from "@/lib/scope";

const YEAR = 60 * 60 * 24 * 365;

export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setCenterScopeAction(scope: string): Promise<void> {
  if (!isCenterScope(scope)) return;
  const store = await cookies();
  store.set(CENTER_SCOPE_COOKIE, scope, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}
