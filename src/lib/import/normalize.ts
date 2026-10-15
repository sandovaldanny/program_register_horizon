import { addMonths, formatISO, parseISO } from "date-fns";

/** Raw cell value as exceljs hands it over (formula results, rich text, dates...). */
export type RawCell = unknown;

type FormulaCell = { result?: unknown };
type RichTextCell = { richText: Array<{ text: string }> };
type HyperlinkCell = { text: unknown };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Unwrap exceljs cell wrappers down to a primitive or Date. */
export function cellValue(v: RawCell): string | number | boolean | Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (isObj(v)) {
    if ("richText" in v) {
      return (v as RichTextCell).richText.map((r) => r.text).join("");
    }
    if ("result" in v) return cellValue((v as FormulaCell).result);
    if ("text" in v) return cellValue((v as HyperlinkCell).text);
    if ("error" in v) return null;
  }
  return null;
}

export function cellText(v: RawCell): string | null {
  const value = cellValue(v);
  if (value === null || value instanceof Date || typeof value === "boolean") return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

export function cellNumber(v: RawCell): number | null {
  const value = cellValue(v);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value.trim());
    return value.trim() !== "" && Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Excel serial date → ISO date (1900 date system). */
function excelSerialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

/** ISO date (YYYY-MM-DD) or null. exceljs returns UTC-midnight Dates, so use UTC parts. */
export function cellDate(v: RawCell): string | null {
  const value = cellValue(v);
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && value > 20000 && value < 80000) return excelSerialToIso(value);
  if (typeof value === "string") {
    const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export function isoMinusMonths(iso: string, months: number): string {
  return formatISO(addMonths(parseISO(iso), -months), { representation: "date" });
}

/** Known spelling slips in the source workbooks. Keys are lower-case, already "Dr. "-normalized. */
const NAME_FIXES: Record<string, string> = {
  "dr. amnha": "Dr. Amnah",
  "dr. ramy": "Dr. Ramy",
};

const capitalize = (s: string) =>
  s
    .split(/(\s|-)/)
    .map((part) => (/^[\s-]$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join("");

/** "dr.ramez (once)" → "Dr. Ramez"; "sometimes lara" → "Lara"; "amal" → "Amal". */
export function normalizeClinicianName(raw: string): string | null {
  let s = raw
    .replace(/\([^)]*\)/g, " ") // parentheticals: "(once)"
    .replace(/\b(sometimes|occasionally|maybe|only)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;
  s = s.replace(/^dr\.?\s*/i, "Dr. ");
  const isDoctor = s.startsWith("Dr. ");
  const name = capitalize(isDoctor ? s.slice(4) : s).trim();
  if (!name) return null;
  const full = isDoctor ? `Dr. ${name}` : name;
  return NAME_FIXES[full.toLowerCase()] ?? full;
}

export function splitNames(raw: string | null): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const token of raw.split(/[,;/&]|\band\b|\+/i)) {
    const name = normalizeClinicianName(token);
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/** Al Falah "Specialists involved": anyone with "Dr." is a psychiatrist, the rest are psychologists. */
export function splitSpecialists(raw: string | null): { psychiatrist: string[]; psychologist: string[] } {
  const names = splitNames(raw);
  return {
    psychiatrist: names.filter((n) => n.startsWith("Dr. ")),
    psychologist: names.filter((n) => !n.startsWith("Dr. ")),
  };
}

export const joinNames = (names: string[]): string | null => (names.length ? names.join(", ") : null);

export function mapPriority(raw: string | null): "routine" | "low" | "mid" | "high" {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("high")) return "high";
  if (s.includes("mid") || s.includes("medium")) return "mid";
  if (s.includes("low")) return "low";
  return "routine";
}

export function mapYesNo(raw: string | null): "yes" | "no" | "unknown" {
  const s = (raw ?? "").toLowerCase().trim();
  if (s === "yes" || s === "y" || s === "true") return "yes";
  if (s === "no" || s === "n" || s === "false") return "no";
  return "unknown";
}

export function mapGender(raw: string | null): "male" | "female" | "unknown" {
  const s = (raw ?? "").toLowerCase().trim();
  if (s.startsWith("m")) return "male";
  if (s.startsWith("f")) return "female";
  return "unknown";
}

export function scoreOrNull(
  v: RawCell,
  max: number,
): { value: number | null; error: string | null } {
  const n = cellNumber(v);
  if (n === null) return { value: null, error: null };
  if (!Number.isInteger(n) || n < 0 || n > max) {
    return { value: null, error: `score ${n} outside 0–${max}` };
  }
  return { value: n, error: null };
}

/** Build a `header → column index` map from a header row, matching case- and space-insensitively. */
export function headerIndex(headerCells: RawCell[]): Map<string, number> {
  const map = new Map<string, number>();
  headerCells.forEach((cell, i) => {
    const text = cellText(cell);
    if (text) map.set(text.toLowerCase(), i);
  });
  return map;
}

export function pick(row: RawCell[], headers: Map<string, number>, name: string): RawCell {
  const idx = headers.get(name.toLowerCase());
  return idx === undefined ? null : row[idx];
}
