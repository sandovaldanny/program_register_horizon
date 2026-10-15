import { useTranslations } from "next-intl";
import { Badge } from "@/components/Badge";
import type { Flag } from "@/lib/metrics";

const FLAG_TONE: Record<Flag, "danger" | "warn" | "info" | "neutral"> = {
  high_priority: "danger",
  worsening: "danger",
  severe: "danger",
  assessment_overdue: "warn",
  confirm_active: "warn",
  attendance_concern: "warn",
  assessment_due_soon: "info",
  no_scores: "info",
  minimal_scores: "neutral",
  care_plan_missing: "neutral",
};

export function FlagChips({ flags, max = 4 }: { flags: Flag[]; max?: number }) {
  const t = useTranslations("flags");
  if (flags.length === 0) return <span className="text-xs text-bluegray">—</span>;
  const shown = flags.slice(0, max);
  const rest = flags.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((f) => (
        <Badge key={f} tone={FLAG_TONE[f]}>
          {t(f)}
        </Badge>
      ))}
      {rest > 0 ? <Badge tone="neutral">+{rest}</Badge> : null}
    </div>
  );
}
