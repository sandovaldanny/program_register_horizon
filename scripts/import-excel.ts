/**
 * One-time Excel → Neon import.
 *
 *   npm run import:excel -- --file "data/PHM review - al falah.xlsx" --center al_falah [--dry-run] [--reset] [--skip-notes]
 *   npm run import:excel -- --file "data/Care_Coordinator_Tracker - al batten.xlsx" --center al_bateen
 *
 * Only the agreed sheet of each workbook is read. Existing (center, mrn) rows are
 * skipped unless --reset, which deletes that center's patients first.
 * Note bodies are never printed.
 */
import ExcelJS from "exceljs";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assessments, notes, patients } from "@/db/schema";
import { ensureSettings } from "@/db/settings";
import { AL_BATEEN_HEADER_ROW, AL_BATEEN_SHEET, mapAlBateenRow } from "@/lib/import/alBateen";
import { AL_FALAH_HEADER_ROW, AL_FALAH_SHEET, mapAlFalahRow } from "@/lib/import/alFalah";
import { headerIndex } from "@/lib/import/normalize";
import type { ImportedPatient, RowMapper } from "@/lib/import/types";

type Center = "al_falah" | "al_bateen";

const CENTERS: Record<Center, { sheet: string; headerRow: number; mapper: RowMapper }> = {
  al_falah: { sheet: AL_FALAH_SHEET, headerRow: AL_FALAH_HEADER_ROW, mapper: mapAlFalahRow },
  al_bateen: { sheet: AL_BATEEN_SHEET, headerRow: AL_BATEEN_HEADER_ROW, mapper: mapAlBateenRow },
};

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const file = get("--file");
  const center = get("--center") as Center | undefined;
  if (!file || !center || !(center in CENTERS)) {
    console.error("Usage: --file <xlsx> --center al_falah|al_bateen [--dry-run] [--reset] [--skip-notes]");
    process.exit(2);
  }
  return {
    file,
    center,
    dryRun: argv.includes("--dry-run"),
    reset: argv.includes("--reset"),
    skipNotes: argv.includes("--skip-notes"),
  };
}

async function readRows(file: string, sheet: string, headerRow: number) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet(sheet);
  if (!ws) throw new Error(`Sheet "${sheet}" not found in ${file}`);
  // exceljs row.values is 1-based (index 0 unused); keep it that way for both header and data rows.
  const headers = headerIndex(ws.getRow(headerRow).values as unknown[]);
  const rows: unknown[][] = [];
  ws.eachRow((row, n) => {
    if (n > headerRow) rows.push(row.values as unknown[]);
  });
  return { headers, rows };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = CENTERS[args.center];
  const db = getDb();
  const settingsRow = await ensureSettings(db);

  const { headers, rows } = await readRows(args.file, cfg.sheet, cfg.headerRow);
  const mapped: ImportedPatient[] = [];
  for (const row of rows) {
    const m = cfg.mapper(row, headers, {
      checkIntervalMonths: settingsRow.checkIntervalMonths,
      skipNotes: args.skipNotes,
    });
    if (m) mapped.push(m);
  }

  const report = {
    center: args.center,
    sheet: cfg.sheet,
    rowsRead: rows.length,
    patientsMapped: mapped.length,
    assessmentsMapped: mapped.reduce((n, m) => n + m.assessments.length, 0),
    notesMapped: mapped.reduce((n, m) => n + m.notes.length, 0),
    withoutScores: mapped.filter((m) => m.assessments.length === 0).length,
    anomalies: mapped.filter((m) => m.anomalies.length).map((m) => `${m.patient.mrn}: ${m.anomalies.join("; ")}`),
    duplicateMrns: findDuplicates(mapped.map((m) => m.patient.mrn)),
    inserted: 0,
    skippedExisting: 0,
  };

  if (report.duplicateMrns.length) {
    console.error("Duplicate MRNs inside the sheet:", report.duplicateMrns);
    process.exit(1);
  }

  if (args.dryRun) {
    console.log(JSON.stringify({ ...report, dryRun: true }, null, 2));
    return;
  }

  if (args.reset) {
    await db.delete(patients).where(eq(patients.center, args.center));
    console.log(`Deleted existing ${args.center} patients (cascade).`);
  }

  const importStart = Date.now();
  let seq = 0;
  for (const m of mapped) {
    const existing = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.center, args.center), eq(patients.mrn, m.patient.mrn)))
      .limit(1);
    if (existing[0]) {
      report.skippedExisting++;
      continue;
    }
    const [inserted] = await db.insert(patients).values(m.patient).returning({ id: patients.id });
    if (m.assessments.length) {
      await db.insert(assessments).values(
        m.assessments.map((a) => ({
          ...a,
          patientId: inserted.id,
          source: `import_${args.center}`,
          // explicit, strictly increasing created_at so same-day baseline/latest keep their order
          createdAt: new Date(importStart + ++seq),
        })),
      );
    }
    if (m.notes.length) {
      await db.insert(notes).values(
        m.notes.map((n) => ({ ...n, patientId: inserted.id, author: "import" })),
      );
    }
    report.inserted++;
  }

  console.log(JSON.stringify(report, null, 2));
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const v of values) {
    const k = v.toLowerCase();
    if (seen.has(k)) dups.add(v);
    seen.add(k);
  }
  return [...dups];
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
