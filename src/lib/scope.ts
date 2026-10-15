import type { Center } from "@/db/schema";

export const CENTER_SCOPE_COOKIE = "horizon_center";
export const CENTER_SCOPES = ["all", "al_falah", "al_bateen"] as const;
export type CenterScope = (typeof CENTER_SCOPES)[number];

export const isCenterScope = (v: unknown): v is CenterScope =>
  typeof v === "string" && (CENTER_SCOPES as readonly string[]).includes(v);

export const scopeToCenter = (scope: CenterScope): Center | null => (scope === "all" ? null : scope);

export const CENTER_LABELS: Record<Center, string> = {
  al_falah: "Al Falah",
  al_bateen: "Al Bateen",
};
