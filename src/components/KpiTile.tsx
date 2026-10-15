import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type KpiTone = "indigo" | "turquoise" | "amber" | "danger" | "steel" | "neutral";

const iconTones: Record<KpiTone, string> = {
  indigo: "bg-indigo/10 text-indigo",
  turquoise: "bg-turquoise/25 text-turquoise-dark",
  amber: "bg-amber/20 text-amber",
  danger: "bg-danger-soft/50 text-danger",
  steel: "bg-steel/10 text-steel",
  neutral: "bg-surface-soft text-bluegray",
};

export function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
  href,
  highlight = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  tone?: KpiTone;
  href?: string;
  highlight?: boolean;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full items-center gap-3.5 rounded-card border bg-surface px-4 py-3.5 transition-colors",
        highlight ? "border-indigo/30 bg-indigo/[0.04]" : "border-border",
        href && "hover:border-turquoise hover:bg-surface-soft/40",
      )}
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", iconTones[tone])}>
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="ltr-data text-2xl font-medium leading-none text-indigo">{value}</div>
        <div className="mt-1 text-xs font-medium leading-tight text-bluegray">{label}</div>
        {hint ? <div className="mt-0.5 text-[11px] leading-tight text-bluegray/80">{hint}</div> : null}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
