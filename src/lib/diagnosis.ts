/** Split a free-text diagnosis ("Depression + anxiety, sleep disorder") into atomic labels. */
export function splitDiagnosis(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const token of raw.split(/[,+/;]|\band\b/i)) {
    const label = token.replace(/\s+/g, " ").trim();
    if (label && !out.some((x) => x.toLowerCase() === label.toLowerCase())) out.push(label);
  }
  return out;
}

/** Map free-text labels onto catalogue labels (case-insensitive); unmatched ones are returned as-is. */
export function matchDiagnosis(labels: string[], catalog: string[]): string[] {
  const byLower = new Map(catalog.map((c) => [c.toLowerCase(), c]));
  return labels.map((l) => byLower.get(l.toLowerCase()) ?? l);
}
