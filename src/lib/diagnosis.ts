/** Split a free-text multi-value field ("Depression + anxiety, sleep disorder") into atomic labels. */
export function splitLabels(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const token of raw.split(/[,+/;]|\band\b/i)) {
    const label = token.replace(/\s+/g, " ").trim();
    if (label && !out.some((x) => x.toLowerCase() === label.toLowerCase())) out.push(label);
  }
  return out;
}

/** Map free-text labels onto catalogue labels (case-insensitive); unmatched ones are returned as-is. */
export function matchLabels(labels: string[], catalog: string[]): string[] {
  const byLower = new Map(catalog.map((c) => [c.toLowerCase(), c]));
  return labels.map((l) => byLower.get(l.toLowerCase()) ?? l);
}

export const splitDiagnosis = splitLabels;
export const matchDiagnosis = matchLabels;

/** Care-plan wording from the source sheets → catalogue labels. */
export const CARE_PLAN_LABELS = ["Psychotherapy", "Medication", "Referred to psychology"] as const;

export function normalizeCarePlan(raw: string | null | undefined): string[] {
  const out = new Set<string>();
  for (const token of splitLabels(raw)) {
    const s = token.toLowerCase();
    if (/^meds?\b|medication/.test(s)) out.add("Medication");
    else if (/refer/.test(s)) out.add("Referred to psychology");
    else if (/psychotherapy|cbt|therapy/.test(s)) out.add("Psychotherapy");
    else out.add(token);
  }
  return [...out];
}
