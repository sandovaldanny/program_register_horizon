import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth/require-session";
import { getCenterScope } from "@/lib/scope-server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireSession();
  const scope = await getCenterScope();
  return <AppShell scope={scope}>{children}</AppShell>;
}
