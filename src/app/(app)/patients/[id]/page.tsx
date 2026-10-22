import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AssessmentChart } from "@/components/AssessmentChart";
import { AssessmentList } from "@/components/AssessmentList";
import { Badge, priorityTone, severityTone, trendTone } from "@/components/Badge";
import { FlagChips } from "@/components/FlagChips";
import { EnrolmentPanel } from "@/components/EnrolmentPanel";
import { GoalsPanel } from "@/components/GoalsPanel";
import { NotesLog } from "@/components/NotesLog";
import { QuickAddScoreForm } from "@/components/QuickAddScoreForm";
import { getCatalog, getPatientDetail, toPoint } from "@/db/queries";
import type { ScaleSummary } from "@/lib/metrics";
import { CENTER_LABELS } from "@/lib/scope";
import { cn } from "@/lib/cn";

export default async function PatientDetailPage({ params }: PageProps<"/patients/[id]">) {
  const { id } = await params;
  const detail = await getPatientDetail(id);
  if (!detail) notFound();
  const { patient, derived, assessments, notes, goals } = detail;
  const [goalCategories, unenrollReasons] = await Promise.all([
    getCatalog("goal_category").then((c) => c.filter((x) => x.active).map((x) => x.label)),
    getCatalog("unenroll_reason").then((c) => c.filter((x) => x.active).map((x) => x.label)),
  ]);

  const t = await getTranslations("detail");
  const tEnum = await getTranslations("enums");
  const tForm = await getTranslations("form");
  const tc = await getTranslations("common");
  const fmt = await getFormatter();
  const date = (iso: string | null) => (iso ? fmt.dateTime(new Date(`${iso}T00:00:00`), { day: "2-digit", month: "short", year: "numeric" }) : "—");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Link href="/" className="text-sm font-medium text-steel hover:underline">
          ← {t("backToList")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-bluegray">
              {CENTER_LABELS[patient.center]}
              <Badge tone={patient.status === "active" ? "ok" : "warn"}>{tEnum(`status.${patient.status === "active" ? "active" : "inactive"}`)}</Badge>
            </p>
            <h1 className="mt-1 flex flex-wrap items-baseline gap-3 text-3xl font-medium text-indigo">
              <span className="ltr-data">{patient.mrn}</span>
              {patient.displayName ? <span className="text-xl text-bluegray">{patient.displayName}</span> : null}
            </h1>
            <p className="mt-1 text-sm text-bluegray">
              {[patient.age ? `${patient.age} y` : null, tEnum(`gender.${patient.gender}`), patient.diagnosis].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-3">
              <FlagChips flags={derived.flags} max={8} />
            </div>
          </div>
          <Link href={`/patients/${patient.id}/edit`} className="rounded-control border border-indigo px-4 py-2.5 text-sm font-medium text-indigo hover:bg-indigo hover:text-white">
            {t("editPatient")}
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label={t("summary.severity")} tone={derived.severeRange ? "danger" : undefined}>
          <span className="flex flex-wrap gap-1">
            {derived.phq.severity ? <Badge tone={severityTone(derived.phq.severity)}>PHQ · {tEnum(`severity.${derived.phq.severity}`)}</Badge> : null}
            {derived.gad.severity ? <Badge tone={severityTone(derived.gad.severity)}>GAD · {tEnum(`severity.${derived.gad.severity}`)}</Badge> : null}
            {!derived.phq.severity && !derived.gad.severity ? "—" : null}
          </span>
        </Stat>
        <Stat label={t("summary.trend")}>
          {derived.trend ? <Badge tone={trendTone(derived.trend)}>{tEnum(`trend.${derived.trend}`)}</Badge> : "—"}
        </Stat>
        <Stat label={t("summary.nextDue")} tone={derived.assessmentStatus === "overdue" ? "danger" : undefined}>
          <span className="ltr-data">{date(derived.nextDueDate)}</span>
          <span className="block text-xs font-normal text-bluegray">{tEnum(`assessmentStatus.${derived.assessmentStatus}`)}</span>
        </Stat>
        <Stat label={t("summary.lastSession")} tone={derived.attendanceStatus === "concern" ? "danger" : undefined}>
          <span className="ltr-data">{date(patient.lastSessionDate)}</span>
          <span className="block text-xs font-normal text-bluegray">{tEnum(`attendanceStatus.${derived.attendanceStatus}`)}</span>
        </Stat>
        <Stat label={t("summary.priorityScore")}>
          <span className="ltr-data">{derived.priorityScore > 0 ? Math.round(derived.priorityScore) : "—"}</span>
          <Badge tone={priorityTone(patient.followUpPriority)} className="ms-2">
            {tEnum(`priority.${patient.followUpPriority}`)}
          </Badge>
        </Stat>
      </section>

      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-medium text-indigo">{t("scores.title")}</h2>
            <p className="text-sm text-bluegray">{t("scores.subtitle")}</p>
          </div>
          <span className="text-sm text-bluegray">{t("scores.history", { count: assessments.length })}</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ScaleCard summary={derived.phq} label={tEnum("scale.phq9")} t={t} tEnum={tEnum} />
          <ScaleCard summary={derived.gad} label={tEnum("scale.gad7")} t={t} tEnum={tEnum} />
        </div>

        {assessments.length > 0 ? (
          <div className="mt-6">
            <AssessmentChart points={assessments.map(toPoint)} />
            <p className="mt-2 text-xs text-bluegray">
              <span className="me-3 inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo" /> {tEnum("scale.phq9")}</span>
              <span className="me-3 inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-turquoise-dark" /> {tEnum("scale.gad7")}</span>
              {t("scores.legendEstimated")}
            </p>
          </div>
        ) : (
          <p className="mt-6 rounded-card border border-dashed border-border px-6 py-8 text-center text-sm text-bluegray">{t("scores.empty")}</p>
        )}

        <div className="mt-8 border-t border-border pt-6">
          <h3 className="mb-4 text-base font-semibold text-indigo">{t("addScore.title")}</h3>
          <QuickAddScoreForm patientId={patient.id} />
        </div>

        {assessments.length > 0 ? (
          <div className="mt-8">
            <h3 className="mb-3 text-base font-semibold text-indigo">{t("assessments.title")}</h3>
            <AssessmentList items={assessments} patientId={patient.id} />
          </div>
        ) : null}
      </section>

      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-medium text-indigo">{t("goals.title")}</h2>
            <p className="text-sm text-bluegray">{t("goals.subtitle")}</p>
          </div>
          <span className="text-sm text-bluegray">{t("goals.openCount", { count: goals.filter((g) => g.status === "open").length })}</span>
        </div>
        <GoalsPanel items={goals} patientId={patient.id} categories={goalCategories} />
      </section>

      <div className="grid gap-8 xl:grid-cols-5">
        <section className="rounded-card border border-border bg-surface p-6 shadow-card xl:col-span-3">
          <h2 className="mb-5 text-xl font-medium text-indigo">{t("notes.title")}</h2>
          <NotesLog items={notes} patientId={patient.id} />
        </section>

        <section className="flex flex-col gap-6 xl:col-span-2">
          <InfoCard title={t("info.care")}>
            <Info label={tForm("carePlan")} value={patient.carePlan} />
            <Info label={tForm("psychiatrist")} value={patient.psychiatrist} />
            <Info label={tForm("psychologist")} value={patient.psychologist} />
            <Info label={tForm("medication")} value={tEnum(`medication.${patient.medication}`)} />
            <Info label={tForm("medicationAdherence")} value={patient.medicationAdherence} />
            <Info label={tForm("therapyProgress")} value={patient.therapyProgress} />
            <Info label={tForm("isHorizonPatient")} value={patient.isHorizonPatient === null ? null : patient.isHorizonPatient ? tc("yes") : tc("no")} />
          </InfoCard>
          <EnrolmentPanel patient={patient} reasons={unenrollReasons} />
          <InfoCard title={t("info.attendance")}>
            <div className="sm:col-span-2 flex flex-wrap items-end gap-6 rounded-card bg-surface-soft/60 px-4 py-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-bluegray">{tForm("sessionsTotal")}</div>
                <div className="ltr-data mt-0.5 text-2xl font-medium text-indigo">{patient.sessionsCount ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-bluegray">{tForm("psychologySessions")}</div>
                <div className="ltr-data mt-0.5 text-lg font-medium text-turquoise-dark">{patient.psychologySessions ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-bluegray">{tForm("psychiatrySessions")}</div>
                <div className="ltr-data mt-0.5 text-lg font-medium text-steel">{patient.psychiatrySessions ?? "—"}</div>
              </div>
            </div>
            <Info label={tForm("attendancePct")} value={patient.attendancePct ? `${Number(patient.attendancePct)}%` : null} />
            <Info label={tForm("attendancePattern")} value={patient.attendancePattern ? tEnum(`attendancePattern.${patient.attendancePattern}`) : null} />
            <Info label={tForm("reasonNotAttending")} value={patient.reasonNotAttending} />
          </InfoCard>
          <InfoCard title={t("info.followUp")}>
            <Info label={tForm("ccAction")} value={patient.ccAction} />
            <Info label={tForm("outcome")} value={patient.outcome} />
            <Info label="Initial severity (import)" value={patient.initialSeverityLabel} />
          </InfoCard>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, tone, children }: { label: string; tone?: "danger" | "warn"; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-card border border-border bg-surface p-4 shadow-card", tone === "danger" && "border-danger/40 bg-danger-soft/20", tone === "warn" && "border-amber/50 bg-amber/10")}>
      <div className="text-xs font-semibold uppercase tracking-wide text-bluegray">{label}</div>
      <div className="mt-2 text-base font-semibold text-indigo">{children}</div>
    </div>
  );
}

function ScaleCard({
  summary,
  label,
  t,
  tEnum,
}: {
  summary: ScaleSummary;
  label: string;
  t: Awaited<ReturnType<typeof getTranslations<"detail">>>;
  tEnum: Awaited<ReturnType<typeof getTranslations<"enums">>>;
}) {
  const delta = summary.delta;
  return (
    <div className="rounded-card bg-surface-soft/60 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-indigo">{label}</span>
        {summary.severity ? <Badge tone={severityTone(summary.severity)}>{tEnum(`severity.${summary.severity}`)}</Badge> : null}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-bluegray">{t("scores.baseline")}</div>
          <div className="ltr-data mt-1 text-2xl font-medium text-indigo">{summary.baseline?.score ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-bluegray">{t("scores.latest")}</div>
          <div className="ltr-data mt-1 text-2xl font-medium text-indigo">{summary.latest?.score ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-bluegray">{t("scores.delta")}</div>
          <div className={cn("ltr-data mt-1 text-2xl font-medium", delta === null ? "text-bluegray" : delta < 0 ? "text-turquoise-dark" : delta > 0 ? "text-danger" : "text-indigo")}>
            {delta === null ? "—" : delta > 0 ? `+${delta}` : delta}
          </div>
          {summary.trend ? <div className="text-xs text-bluegray">{tEnum(`trend.${summary.trend}`)}</div> : null}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface p-6 shadow-card">
      <h2 className="mb-4 text-base font-semibold text-indigo">{title}</h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-bluegray">{label}</dt>
      <dd className="mt-0.5 text-sm text-indigo">{value || "—"}</dd>
    </div>
  );
}
