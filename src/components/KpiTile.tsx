import Link from "next/link";
import { cn } from "@/lib/cn";

type Tone = "indigo" | "turquoise" | "amber" | "pink" | "steel" | "neutral";

const accents: Record<Tone, string> = {
  indigo: "bg-indigo",
  turquoise: "bg-turquoise",
  amber: "bg-amber",
  pink: "bg-danger",
  steel: "bg-steel",
  neutral: "bg-bluegray",
};

export function KpiTile({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  emphasis = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: Tone;
  href?: string;
  emphasis?: boolean;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col gap-2 rounded-card border border-border bg-surface p-5 shadow-card transition-shadow",
        href && "hover:shadow-card-hover",
        emphasis && "bg-brand text-white border-transparent",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", emphasis ? "bg-turquoise" : accents[tone])} />
        <span className={cn("text-xs font-semibold uppercase tracking-wide", emphasis ? "text-white/80" : "text-bluegray")}>
          {label}
        </span>
      </div>
      <span className={cn("ltr-data text-3xl font-medium leading-none", emphasis ? "text-white" : "text-indigo")}>{value}</span>
      {hint ? <span className={cn("text-xs", emphasis ? "text-white/70" : "text-bluegray")}>{hint}</span> : null}
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
