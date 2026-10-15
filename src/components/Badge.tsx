import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Severity, Trend } from "@/lib/metrics";

export type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "indigo";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-soft text-indigo",
  ok: "bg-turquoise/25 text-indigo",
  warn: "bg-amber/30 text-indigo",
  danger: "bg-danger-soft/60 text-indigo",
  info: "bg-steel/10 text-steel",
  indigo: "bg-indigo text-white",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const trendTone = (trend: Trend | null): Tone =>
  trend === "improving" ? "ok" : trend === "worsening" ? "danger" : trend === "mixed" ? "warn" : trend === "stable" ? "info" : "neutral";

export const severityTone = (s: Severity | null): Tone =>
  s === "severe" || s === "moderately_severe" ? "danger" : s === "moderate" ? "warn" : s === "mild" ? "info" : s === "minimal" ? "ok" : "neutral";

export const priorityTone = (p: "routine" | "low" | "mid" | "high"): Tone =>
  p === "high" ? "danger" : p === "mid" ? "warn" : p === "low" ? "info" : "neutral";
