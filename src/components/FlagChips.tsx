import { useTranslations } from "next-intl";
import { Badge, type Tone } from "@/components/Badge";
import type { Flag } from "@/lib/metrics";

const FLAG_TONE: Record<Flag, Tone> = {
  worsening: "danger",
  no_score: "warn",
  no_session: "warn",
  no_baseline: "info",
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
