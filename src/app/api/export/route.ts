import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { getCaseload, type CaseloadRow } from "@/db/queries";
import { getSession } from "@/lib/auth/require-session";
import { applyFilters, parseFilters } from "@/lib/filters";
import { getCenterScope } from "@/lib/scope-server";
import { CENTER_LABELS, scopeToCenter } from "@/lib/scope";

export const dynamic = "force-dynamic";

const COLUMNS: Array<{ key: string; header: string; value: (r: CaseloadRow) => string | number | null }> = [
  { key: "center", header: "Center", value: (r) => CENTER_LABELS[r.patient.center] },
  { key: "mrn", header: "MRN", value: (r) => r.patient.mrn },
  { key: "name", header: "Name", value: (r) => r.patient.displayName },
  { key: "age", header: "Age", value: (r) => r.patient.age },
  { key: "gender", header: "Gender", value: (r) => r.patient.gender },
  { key: "status", header: "Status", value: (r) => r.patient.status },
  { key: "tier", header: "Tier", value: (r) => r.derived.tier },
  { key: "trend", header: "Trend", value: (r) => r.derived.trend },
  { key: "phq_baseline", header: "PHQ-9 baseline", value: (r) => r.derived.phq.baseline?.score ?? null },
  { key: "phq_latest", header: "PHQ-9 latest", value: (r) => r.derived.phq.latest?.score ?? null },
  { key: "phq_delta", header: "PHQ-9 delta", value: (r) => r.derived.phq.delta },
  { key: "phq_severity", header: "PHQ-9 severity", value: (r) => r.derived.phq.severity },
  { key: "gad_baseline", header: "GAD-7 baseline", value: (r) => r.derived.gad.baseline?.score ?? null },
  { key: "gad_latest", header: "GAD-7 latest", value: (r) => r.derived.gad.latest?.score ?? null },
  { key: "gad_delta", header: "GAD-7 delta", value: (r) => r.derived.gad.delta },
  { key: "gad_severity", header: "GAD-7 severity", value: (r) => r.derived.gad.severity },
  { key: "assessments", header: "Assessments logged", value: (r) => r.derived.phq.history.length + r.derived.gad.history.length },
  { key: "last_score", header: "Last score date", value: (r) => r.derived.lastScoreDate },
  { key: "next_due", header: "Next check due", value: (r) => r.derived.nextDueDate },
  { key: "assessment_status", header: "Assessment status", value: (r) => r.derived.assessmentStatus },
  { key: "last_session", header: "Last session", value: (r) => r.patient.lastSessionDate },
  { key: "attendance_status", header: "Attendance status", value: (r) => r.derived.attendanceStatus },
  { key: "flags", header: "Flags", value: (r) => r.derived.flags.join("; ") },
  { key: "priority_score", header: "Priority score", value: (r) => r.derived.priorityScore },
  { key: "follow_up_priority", header: "Follow-up priority", value: (r) => r.patient.followUpPriority },
  { key: "cc_action", header: "CC action", value: (r) => r.patient.ccAction },
  { key: "diagnosis", header: "Diagnosis", value: (r) => r.patient.diagnosis },
  { key: "care_plan", header: "Care plan", value: (r) => r.patient.carePlan },
  { key: "psychiatrist", header: "Psychiatrist", value: (r) => r.patient.psychiatrist },
  { key: "psychologist", header: "Psychologist", value: (r) => r.patient.psychologist },
  { key: "medication", header: "Medication", value: (r) => r.patient.medication },
  { key: "sessions", header: "Sessions", value: (r) => r.patient.sessionsCount },
  { key: "attendance_pct", header: "Attendance %", value: (r) => r.patient.attendancePct },
  { key: "horizon", header: "Horizon patient", value: (r) => (r.patient.isHorizonPatient === null ? null : r.patient.isHorizonPatient ? "yes" : "no") },
];

const csvEscape = (v: string | number | null) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = request.nextUrl;
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const scope = await getCenterScope();
  const { caseload } = await getCaseload(scopeToCenter(scope));
  const rows = applyFilters(caseload, parseFilters(Object.fromEntries(url.searchParams.entries())));
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `horizon-caseload-${scope}-${stamp}`;

  if (format === "csv") {
    const lines = [COLUMNS.map((c) => csvEscape(c.header)).join(",")];
    for (const r of rows) lines.push(COLUMNS.map((c) => csvEscape(c.value(r))).join(","));
    return new NextResponse(`﻿${lines.join("\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.csv"`,
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Caseload");
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: Math.max(12, c.header.length + 2) }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16455C" } };
  for (const r of rows) ws.addRow(Object.fromEntries(COLUMNS.map((c) => [c.key, c.value(r)])));
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: { row: 1, column: COLUMNS.length } };
  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
    },
  });
}
