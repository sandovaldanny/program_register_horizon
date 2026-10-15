"use client";

import { useFormatter, useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AssessmentPoint } from "@/lib/metrics";

type Row = { date: string; phq9: number | null; gad7: number | null; phqEst: boolean; gadEst: boolean };

const C = { indigo: "#16455C", turquoise: "#4FA8A3", grid: "#DCE5EA", bluegray: "#8B9EA5" };

/**
 * One x-position per (date, nth screening of that scale on that date). Imported
 * baseline + latest share a date, so the n-th PHQ and the n-th GAD of a day line up.
 */
function buildRows(points: AssessmentPoint[]): Row[] {
  const rows = new Map<string, Row>();
  const seen = new Map<string, number>();
  const sorted = [...points].sort((a, b) => (a.assessedAt + a.createdAt).localeCompare(b.assessedAt + b.createdAt));
  for (const p of sorted) {
    const n = seen.get(`${p.scale}|${p.assessedAt}`) ?? 0;
    seen.set(`${p.scale}|${p.assessedAt}`, n + 1);
    const key = `${p.assessedAt}#${n}`;
    let row = rows.get(key);
    if (!row) {
      row = { date: key, phq9: null, gad7: null, phqEst: false, gadEst: false };
      rows.set(key, row);
    }
    if (p.scale === "phq9") {
      row.phq9 = p.score;
      row.phqEst = p.dateSource === "estimated";
    } else {
      row.gad7 = p.score;
      row.gadEst = p.dateSource === "estimated";
    }
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function AssessmentChart({ points }: { points: AssessmentPoint[] }) {
  const t = useTranslations("enums.scale");
  const fmt = useFormatter();
  const rows = buildRows(points);
  const label = (key: string) => fmt.dateTime(new Date(`${key.slice(0, 10)}T00:00:00`), { month: "short", day: "numeric", year: "2-digit" });

  const dot = (estKey: "phqEst" | "gadEst", color: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Dot = (props: any) => {
      const { cx, cy, payload, value } = props;
      if (value === null || value === undefined || cx === undefined) return <g key={`${estKey}-${cx}-${cy}`} />;
      const hollow = payload[estKey];
      return (
        <circle
          key={`${estKey}-${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={5}
          fill={hollow ? "#FFFFFF" : color}
          stroke={color}
          strokeWidth={2}
          strokeDasharray={hollow ? "2 2" : undefined}
        />
      );
    };
    return Object.assign(Dot, { displayName: `Dot_${estKey}` });
  };

  return (
    <div dir="ltr" className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 16, left: -12, bottom: 4 }}>
          <ReferenceArea y1={20} y2={27} fill="#EFB6BE" fillOpacity={0.18} />
          <ReferenceArea y1={15} y2={20} fill="#EFB6BE" fillOpacity={0.1} />
          <ReferenceArea y1={10} y2={15} fill="#E9A941" fillOpacity={0.1} />
          <ReferenceArea y1={5} y2={10} fill="#70C8C3" fillOpacity={0.08} />
          <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={label} tick={{ fill: C.bluegray, fontSize: 12 }} axisLine={{ stroke: C.grid }} tickLine={false} />
          <YAxis domain={[0, 27]} ticks={[0, 5, 10, 15, 20, 27]} tick={{ fill: C.bluegray, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            labelFormatter={(v) => label(String(v))}
            formatter={(value, name) => [value as number, name === "phq9" ? t("phq9") : t("gad7")]}
            contentStyle={{ borderRadius: 12, border: `1px solid ${C.grid}`, boxShadow: "0 6px 24px rgba(22,69,92,0.10)", fontSize: 13 }}
          />
          <Line type="monotone" dataKey="phq9" name="phq9" stroke={C.indigo} strokeWidth={2.5} connectNulls dot={dot("phqEst", C.indigo)} activeDot={{ r: 6 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="gad7" name="gad7" stroke={C.turquoise} strokeWidth={2.5} connectNulls dot={dot("gadEst", C.turquoise)} activeDot={{ r: 6 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
