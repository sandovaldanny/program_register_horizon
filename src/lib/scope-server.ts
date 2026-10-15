import "server-only";
import { cookies } from "next/headers";
import { CENTER_SCOPE_COOKIE, isCenterScope, type CenterScope } from "./scope";

export async function getCenterScope(): Promise<CenterScope> {
  const store = await cookies();
  const raw = store.get(CENTER_SCOPE_COOKIE)?.value;
  return isCenterScope(raw) ? raw : "all";
}
