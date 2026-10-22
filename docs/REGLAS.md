# Horizon Care Tracker — Reglas de negocio y código

Programa Horizon (Ansiedad y Depresión) · Alkalma · Centros Al Falah y Al Bateen.
Documento de referencia para Care Coordination / Case Management y para desarrollo.
Todas las reglas viven en `src/lib/metrics/` como funciones puras (sin base de datos) y están cubiertas por tests (`npm test`, 92 pruebas). El código completo de cada regla está al final de cada sección. English version: [RULES.md](./RULES.md).

---

## 1. Principios

1. **Se guardan todos los screenings.** Cada PHQ-9 y GAD-7 se registra como una fila independiente con fecha. Nunca se sobreescribe.
2. **El delta siempre es baseline → último.** No se comparan dos consecutivos; se compara el primer score registrado con el más reciente.
3. **Todo lo derivado se calcula al leer.** Severidad, tendencia, alertas y prioridad nunca se almacenan; se recalculan con la fecha de hoy y los parámetros vigentes en Configuración.
4. **Solo pacientes Enrolados generan trabajo.** Un paciente Desenrolado no dispara ninguna regla y tiene prioridad 0.
5. **Exactamente cuatro reglas de alerta.** Severidad, "Mejorando" y "Candidato a alta" son información, no alertas.
6. **La app es la fuente de verdad.** La importación desde Excel fue única; cualquier corrección se hace en la app.

---

## 2. Escalas y validación

| Escala | Rango válido | Fecha |
|---|---|---|
| PHQ-9 | 0 – 27 | No puede ser futura |
| GAD-7 | 0 – 21 | No puede ser futura |

Un score fuera de rango se rechaza (en la app y en la importación). Cada score tiene `dateSource`: `recorded` (fecha real) o `estimated` (fecha asumida; se puede corregir en la ficha del paciente).

```ts
// src/lib/metrics/severity.ts
export const SCALE_MAX: Record<Scale, number> = { phq9: 27, gad7: 21 };

// src/lib/validation.ts
export const assessmentSchema = z
  .object({
    patientId: z.string().uuid(),
    scale: z.enum(["phq9", "gad7"]),
    score: z.coerce.number().int(),
    assessedAt: notFuture,
    dateSource: z.enum(["recorded", "estimated"]).default("recorded"),
    note: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.score < 0 || v.score > SCALE_MAX[v.scale]) {
      ctx.addIssue({ code: "custom", path: ["score"], message: "scoreRange" });
    }
  });
```

---

## 3. Baseline y último score

- Los scores de cada escala se ordenan por **fecha de evaluación** y, en empate, por **fecha de creación** (desempate para los importados el mismo día).
- **Baseline** = primero del orden. **Último** = último del orden.
- Con un solo score: baseline = último, delta `null`, tendencia `first_score`.
- Editar la fecha de un score reordena la línea de tiempo y puede cambiar cuál es el baseline.

```ts
// src/lib/metrics/trend.ts
export function sortChronologically(points: AssessmentPoint[]): AssessmentPoint[] {
  return [...points].sort((a, b) => {
    if (a.assessedAt !== b.assessedAt) return a.assessedAt < b.assessedAt ? -1 : 1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return 0;
  });
}

export function pickBaselineAndLatest(points: AssessmentPoint[]) {
  if (points.length === 0) return { baseline: null, latest: null };
  const sorted = sortChronologically(points);
  return { baseline: sorted[0], latest: sorted[sorted.length - 1] };
}
```

---

## 4. Severidad

Se calcula sobre el **último** score de cada escala. No existen "tiers".

| PHQ-9 | Severidad | GAD-7 | Severidad |
|---|---|---|---|
| 0 – 4 | Mínima | 0 – 4 | Mínima |
| 5 – 9 | Leve | 5 – 9 | Leve |
| 10 – 14 | Moderada | 10 – 14 | Moderada |
| 15 – 19 | Moderadamente severa | 15+ | Severa |
| 20 – 27 | Severa | | |

- **Severidad máxima** del paciente = la peor de las dos escalas (orden: mínima < leve < moderada < moderadamente severa < severa).
- **Rango severo** = PHQ-9 ≥ 15 **o** GAD-7 ≥ 15. Se muestra como badge e informa al clínico, pero **no es alerta**.

```ts
// src/lib/metrics/severity.ts
export function phqSeverity(score: number): Severity {
  if (score <= 4) return "minimal";
  if (score <= 9) return "mild";
  if (score <= 14) return "moderate";
  if (score <= 19) return "moderately_severe";
  return "severe";
}

export function gadSeverity(score: number): Severity {
  if (score <= 4) return "minimal";
  if (score <= 9) return "mild";
  if (score <= 14) return "moderate";
  return "severe";
}

export const SEVERITY_ORDER: Severity[] = ["minimal", "mild", "moderate", "moderately_severe", "severe"];
export const severityRank = (s: Severity): number => SEVERITY_ORDER.indexOf(s);

export function maxSeverity(...values: Array<Severity | null>): Severity | null {
  const present = values.filter((v): v is Severity => v !== null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => (severityRank(b) > severityRank(a) ? b : a));
}

export function isSevereRange(latestPhq: number | null, latestGad: number | null): boolean {
  const phq = latestPhq !== null ? phqSeverity(latestPhq) : null;
  const gad = latestGad !== null ? gadSeverity(latestGad) : null;
  return phq === "moderately_severe" || phq === "severe" || gad === "severe";
}
```

---

## 5. Delta y tendencia

- **Delta** = último − baseline (por escala). Negativo = mejora.
- **Umbral de cambio** configurable: PHQ-9 por defecto **5**, GAD-7 por defecto **4**.
- Por escala: `delta ≤ −umbral` → Mejorando · `delta ≥ +umbral` → Empeorando · si no → Estable.
- **Tendencia combinada** del paciente:
  - Alguna escala empeora y otra mejora → `mixed` (se trata como empeorando para la alerta).
  - Alguna empeora → `worsening`.
  - Alguna mejora (y ninguna empeora) → `improving`.
  - Ambas estables → `stable`.
  - Un solo score (sin delta) → `first_score`.

```ts
// src/lib/metrics/trend.ts
export function scaleTrend(delta: number | null, threshold: number): ScaleTrend | null {
  if (delta === null) return null;
  if (delta <= -threshold) return "improving";
  if (delta >= threshold) return "worsening";
  return "stable";
}

export function combinedTrend(phq: ScaleTrend | null, gad: ScaleTrend | null, hasAnyScore: boolean): Trend | null {
  const trends = [phq, gad].filter((t): t is ScaleTrend => t !== null);
  if (trends.length === 0) return hasAnyScore ? "first_score" : null;
  const hasWorsening = trends.includes("worsening");
  const hasImproving = trends.includes("improving");
  if (hasWorsening && hasImproving) return "mixed";
  if (hasWorsening) return "worsening";
  if (hasImproving) return "improving";
  return "stable";
}

export function summarizeScale(scale: Scale, points: AssessmentPoint[], settings: MetricSettings): ScaleSummary {
  const history = sortChronologically(points.filter((p) => p.scale === scale));
  const { baseline, latest } = pickBaselineAndLatest(history);
  const delta = baseline && latest && history.length > 1 ? latest.score - baseline.score : null;
  return {
    scale, history, baseline, latest, delta,
    trend: scaleTrend(delta, thresholdFor(scale, settings)),
    severity: latest ? severityFor(scale, latest.score) : null,
  };
}
```

---

## 6. Cadencia de screening (próximo vencimiento)

- **Última fecha de score** = la más reciente entre el último PHQ-9 y el último GAD-7.
- **Próximo vencimiento** = última fecha de score + `checkIntervalMonths` (por defecto **1 mes**).
- **Días vencidos** = hoy − próximo vencimiento. Positivo = vencido.
- Estado: `no_scores` (sin ningún score) · `ok` (dentro del intervalo) · `overdue` (días vencidos > 0).
- **Es recurrente**: cada vez que se registra un nuevo score el reloj se reinicia. Un paciente sin score nuevo vuelve a quedar vencido un intervalo después de cada screening.

```ts
// src/lib/metrics/alerts.ts
export function assessmentStatus(lastScoreDate: string | null, settings: MetricSettings, today: Date) {
  if (!lastScoreDate) return { status: "no_scores", nextDue: null, daysPastDue: null };
  const nextDue = addMonths(parseISO(lastScoreDate), settings.checkIntervalMonths);
  const daysPastDue = differenceInCalendarDays(today, nextDue);
  return { status: daysPastDue > 0 ? "overdue" : "ok", nextDue: toIsoDate(nextDue), daysPastDue };
}
```

---

## 7. Asistencia (última cita)

- **Días desde la última cita** = hoy − `lastSessionDate`.
- Estado: `unknown` (sin fecha de cita) · `ok` · `concern` si los días superan `attendanceConcernDays` (por defecto **30**; en producción está en 40).
- Sin fecha de cita no se genera la alerta de cita (no hay dato para evaluar).

```ts
// src/lib/metrics/alerts.ts
export function attendanceStatus(lastSessionDate: string | null, settings: MetricSettings, today: Date) {
  if (!lastSessionDate) return { status: "unknown", daysSince: null };
  const daysSince = differenceInCalendarDays(today, parseISO(lastSessionDate));
  return { status: daysSince > settings.attendanceConcernDays ? "concern" : "ok", daysSince };
}
```

---

## 8. Las cuatro reglas de alerta

Solo aplican a pacientes **Enrolados**. Un paciente puede tener varias a la vez.

| # | Regla (ES) | Clave | Condición | Peso |
|---|---|---|---|---|
| 1 | **Empeorando** | `worsening` | Tendencia combinada `worsening` o `mixed` (baseline → último subió ≥ umbral en alguna escala) | 40 |
| 2 | **Sin score > 1 mes** | `no_score` | Estado de screening `overdue` (pasó más de un intervalo desde el último score) | 30 |
| 3 | **Sin cita > 1 mes** | `no_session` | Estado de asistencia `concern` (más de N días sin cita) | 30 |
| 4 | **Sin baseline** | `no_baseline` | Paciente inscrito sin ningún PHQ-9 / GAD-7 | 20 |

- **Necesita atención** = tiene al menos una regla activa.
- Orden de visualización de los chips: Empeorando · Sin score · Sin cita · Sin baseline.
- Reglas 2 y 4 son excluyentes (sin scores no puede estar vencido). Reglas 1 y 4 también (sin scores no hay tendencia).

```ts
// src/lib/metrics/flags.ts
export const FLAG_ORDER: Flag[] = ["worsening", "no_score", "no_session", "no_baseline"];

export function computeFlags(input: FlagInput): Flag[] {
  // Only patients still in the programme generate work for the coordinator.
  if (input.patient.status !== "active") return [];

  const set = new Set<Flag>();
  if (input.trend === "worsening" || input.trend === "mixed") set.add("worsening");
  if (input.assessmentStatus === "overdue") set.add("no_score");
  if (input.attendanceStatus === "concern") set.add("no_session");
  if (input.assessmentStatus === "no_scores") set.add("no_baseline");

  return FLAG_ORDER.filter((f) => set.has(f));
}
```

---

## 9. Prioridad

**Prioridad = suma de pesos de las reglas activas + bono manual + desempate por días vencidos.**

- Pesos: Empeorando 40 · Sin score 30 · Sin cita 30 · Sin baseline 20.
- **Bono manual**: si el coordinador marcó `Prioridad de seguimiento = Alta`, +20. Solo aplica si hay al menos una regla activa (no es una alerta por sí sola).
- **Desempate**: `min(díasVencidos, 90) / 100` → entre 0.01 y 0.90. Entre dos pacientes con las mismas reglas, sube el que lleva más tiempo vencido.
- Sin reglas activas → prioridad **0** (se muestra "—"). Paciente Desenrolado → 0.
- Máximo posible: Empeorando + Sin score + Sin cita + bono Alta + desempate = 40 + 30 + 30 + 20 + 0.90 = **120.90** (Sin baseline no puede coexistir con Empeorando ni con Sin score).

**Ejemplos (hoy 2026-10-22):**

| Paciente | Reglas | Manual Alta | Días vencidos | Prioridad |
|---|---|---|---|---|
| A | Empeorando + Sin score | Sí | 45 | 40 + 30 + 20 + 0.45 = **90.45** |
| B | Sin score + Sin cita | No | 12 | 30 + 30 + 0.12 = **60.12** |
| C | Sin baseline + Sin cita | No | — | 20 + 30 = **50** |
| D | Sin score | No | 200 | 30 + 0.90 = **30.90** |
| E | Ninguna (en rango severo pero al día) | Sí | — | **0** |

```ts
// src/lib/metrics/flags.ts
export const PRIORITY_WEIGHTS: Record<Flag, number> = {
  worsening: 40,
  no_score: 30,
  no_session: 30,
  no_baseline: 20,
};

/** Manual "High" follow-up priority set by the coordinator adds this on top. */
export const HIGH_PRIORITY_BONUS = 20;

export function priorityScore(
  flags: Flag[],
  daysPastDue: number | null,
  followUpPriority: PatientInput["followUpPriority"] = "routine",
): number {
  const base = flags.reduce((sum, f) => sum + PRIORITY_WEIGHTS[f], 0);
  if (base === 0) return 0;
  const manual = followUpPriority === "high" ? HIGH_PRIORITY_BONUS : 0;
  const overdueBonus = daysPastDue && daysPastDue > 0 ? Math.min(daysPastDue, 90) / 100 : 0;
  return Math.round((base + manual + overdueBonus) * 100) / 100;
}
```

Tooltip en la tabla (ES): *"Suma de las reglas activas: Empeorando 40 · Sin score > 1 mes 30 · Sin cita > 1 mes 30 · Sin baseline 20. Prioridad manual 'Alta' suma 20. En empate, gana el más vencido."*

---

## 10. Información que NO es alerta

| Indicador | Definición | Dónde se ve |
|---|---|---|
| **Severidad** | Banda del último score (sección 4) | Badge en celda PHQ-9 / GAD-7, filtros |
| **Rango severo** | PHQ-9 ≥ 15 o GAD-7 ≥ 15 | Badge, columna de export |
| **Mejorando** | Tendencia combinada `improving` | KPI "Mejorando" (clic filtra la tabla) |
| **Candidato a alta** | Paciente Activo con **todos** sus últimos scores < 5 (si solo tiene una escala, basta esa) | KPI "Candidatos a alta" (clic filtra) |
| **Prioridad manual** | Rutina / Baja / Media / Alta, la fija el coordinador | Filtro; "Alta" suma +20 a la prioridad |

```ts
// src/lib/metrics/derive.ts (fragmento)
graduationCandidate: patient.status === "active" && latest.length > 0 && latest.every((v) => v < 5),
```

---

## 11. Punto de entrada único: `derivePatient`

Dashboard, ficha de paciente y export usan la misma función; no hay cálculos duplicados.

```ts
// src/lib/metrics/derive.ts
export function derivePatient(patient: PatientInput, assessments: AssessmentPoint[], settings: MetricSettings, today: Date): PatientDerived {
  const phq = summarizeScale("phq9", assessments, settings);
  const gad = summarizeScale("gad7", assessments, settings);

  const latestPhq = phq.latest?.score ?? null;
  const latestGad = gad.latest?.score ?? null;
  const trend = combinedTrend(phq.trend, gad.trend, assessments.length > 0);

  const lastScoreDate =
    [phq.latest?.assessedAt, gad.latest?.assessedAt].filter((d): d is string => !!d).sort().at(-1) ?? null;

  const assessment = assessmentStatus(lastScoreDate, settings, today);
  const attendance = attendanceStatus(patient.lastSessionDate, settings, today);

  const flags = computeFlags({ patient, trend, assessmentStatus: assessment.status, attendanceStatus: attendance.status });

  const latest = [latestPhq, latestGad].filter((v): v is number => v !== null);

  return {
    phq, gad,
    maxSeverity: maxSeverity(phq.severity, gad.severity),
    severeRange: isSevereRange(latestPhq, latestGad),
    graduationCandidate: patient.status === "active" && latest.length > 0 && latest.every((v) => v < 5),
    trend,
    lastScoreDate,
    nextDueDate: assessment.nextDue,
    assessmentStatus: assessment.status,
    daysPastDue: assessment.daysPastDue,
    attendanceStatus: attendance.status,
    daysSinceSession: attendance.daysSince,
    flags,
    needsAttention: flags.length > 0,
    priorityScore: priorityScore(flags, assessment.daysPastDue, patient.followUpPriority),
  };
}
```

---

## 12. KPIs del panel

Todos cuentan **solo pacientes Enrolados** del centro seleccionado (o ambos).

| KPI | Cuenta |
|---|---|
| Enrolados | status = active (enrolado) |
| Necesitan atención | ≥ 1 regla activa |
| Empeorando | regla `worsening` |
| Sin score > 1 mes | regla `no_score` |
| Sin cita > 1 mes | regla `no_session` |
| Sin baseline | regla `no_baseline` |
| Mejorando | tendencia `improving` |
| Candidatos a alta | `graduationCandidate` |

```ts
// src/lib/metrics/derive.ts
export function summarizeCaseload(rows: Array<{ status: PatientInput["status"]; derived: PatientDerived }>): CaseloadKpis {
  const active = rows.filter((r) => r.status === "active");
  const has = (flag: Flag) => active.filter((r) => r.derived.flags.includes(flag)).length;
  return {
    total: rows.length,
    active: active.length,
    needsAttention: active.filter((r) => r.derived.needsAttention).length,
    worsening: has("worsening"),
    noScore: has("no_score"),
    noSession: has("no_session"),
    noBaseline: has("no_baseline"),
    improving: active.filter((r) => r.derived.trend === "improving").length,
    graduationCandidates: active.filter((r) => r.derived.graduationCandidate).length,
  };
}
```

---

## 13. Filtros y orden de la tabla

- **Ámbito de centro**: cookie `horizon_center` = `all | al_falah | al_bateen`.
- **Filtros** (parámetros de URL, compartibles): búsqueda `q` (MRN, nombre, diagnóstico, psiquiatra, psicólogo) · alerta (`needs_attention | worsening | no_score | no_session | no_baseline`) · severidad PHQ · severidad GAD · clínico · prioridad manual · estado (`active` = Enrolado por defecto, `inactive` = Desenrolado, `all`). Ocultos pero alcanzables desde los KPIs: `trend=improving`, `graduation=1`.
- **Orden por cabecera**: prioridad (desc por defecto), MRN (asc), PHQ-9 último (desc), GAD-7 último (desc), último score (asc = el más antiguo primero), última cita (asc).
- **Desempate**: siempre prioridad descendente, luego MRN numérico.
- Scores ausentes se tratan como −∞ al ordenar (quedan al final en orden descendente).

```ts
// src/lib/filters.ts (fragmento)
export const DEFAULT_DIR: Record<SortKey, SortDir> = {
  priority: "desc", mrn: "asc", phq: "desc", gad: "desc", last_score: "asc", last_session: "asc",
};
// ...
if (c === 0) c = b.derived.priorityScore - a.derived.priorityScore || a.patient.mrn.localeCompare(b.patient.mrn, undefined, { numeric: true });
```

---

## 14. Parámetros configurables (Configuración → Reglas clínicas)

| Parámetro | Por defecto | Rango permitido | Afecta |
|---|---|---|---|
| Umbral de cambio PHQ-9 | 5 | 1 – 27 | Tendencia / regla Empeorando |
| Umbral de cambio GAD-7 | 4 | 1 – 21 | Tendencia / regla Empeorando |
| Intervalo de screening (meses) | 1 | 1 – 12 | Próximo vencimiento / regla Sin score |
| Días sin cita para alerta | 30 | 1 – 365 | Regla Sin cita |

Un cambio aplica de inmediato a todos los pacientes (nada se almacena precalculado).

```ts
// src/db/schema.ts
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  phqChangeThreshold: integer("phq_change_threshold").notNull().default(5),
  gadChangeThreshold: integer("gad_change_threshold").notNull().default(4),
  checkIntervalMonths: integer("check_interval_months").notNull().default(1),
  attendanceConcernDays: integer("attendance_concern_days").notNull().default(30),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// src/lib/validation.ts
export const settingsSchema = z.object({
  phqChangeThreshold: z.coerce.number().int().min(1).max(27),
  gadChangeThreshold: z.coerce.number().int().min(1).max(21),
  checkIntervalMonths: z.coerce.number().int().min(1).max(12),
  attendanceConcernDays: z.coerce.number().int().min(1).max(365),
});
```

---

## 15. Catálogos (Configuración)

Los formularios de paciente solo permiten valores del catálogo; **no hay opción "Otro"**. Si un paciente tiene un valor que ya no está en el catálogo, el formulario lo marca con ⚠ y lo descarta al guardar.

| Catálogo | Campos | Uso |
|---|---|---|
| Clínicos | nombre (único), especialidad (psiquiatra / psicólogo / …), centro opcional, activo | Psiquiatra y Psicólogo del paciente, filtro por clínico |
| Diagnósticos | etiqueta, activo | Campo Diagnóstico (multiselección) |
| Opciones de plan de cuidado | etiqueta, activo | Campo Plan de cuidado médico (Medicación · Referido a psicología · Psicoterapia) |
| Categorías de meta | etiqueta, activo | Metas individuales |

| Causas de desenrolamiento | etiqueta, activo | Causa obligatoria cuando un paciente se retira del programa |

Datos del paciente: clave única por `(centro, MRN)`.

---

## 15b. Enrolamiento y desenrolamiento

- Todo paciente está **Enrolado** o **Desenrolado** (en BD `active` / `inactive`).
- Al crear un paciente se registra la **fecha de enrolamiento** (por defecto hoy, editable, nunca futura). Los importados recibieron la fecha de su primer score, o la de importación si no tenían.
- **Desenrolar** exige **fecha de desenrolamiento** (no anterior al enrolamiento, no futura) y **causa** del catálogo. La ficha del paciente tiene el formulario "Desenrolar paciente"; el formulario de edición aplica la misma regla al cambiar el estado.
- Un paciente desenrolado no genera alertas, tiene prioridad 0, queda fuera de todos los KPIs y sale de la tabla por defecto (filtro de estado: Enrolado por defecto · Desenrolado · Todos).
- **Re-enrolar** fija hoy como nueva fecha de enrolamiento y limpia fecha y causa de desenrolamiento.
- **Sesiones**: se registran sesiones de psicología y de psiquiatría; el total siempre es la suma. A los pacientes existentes se les repartió el total importado de forma aleatoria (datos demo).

```ts
// src/lib/validation.ts
export const patientSchema = patientBaseSchema
  .superRefine((v, ctx) => {
    if (v.status !== "inactive") return;
    if (!v.unenrolledAt) ctx.addIssue({ code: "custom", path: ["unenrolledAt"], message: "unenrolledAtRequired" });
    else if (v.unenrolledAt < v.enrolledAt) ctx.addIssue({ code: "custom", path: ["unenrolledAt"], message: "unenrolledBeforeEnrolled" });
    if (!v.unenrollReason) ctx.addIssue({ code: "custom", path: ["unenrollReason"], message: "unenrollReasonRequired" });
  })
  .transform((v) => {
    const sessionsCount = v.psychologySessions === null && v.psychiatrySessions === null ? null : (v.psychologySessions ?? 0) + (v.psychiatrySessions ?? 0);
    return v.status === "active" ? { ...v, sessionsCount, unenrolledAt: null, unenrollReason: null } : { ...v, sessionsCount };
  });
```

---

## 16. Metas individuales (separadas del plan médico)

- El **plan de cuidado** es el campo médico que venía en los Excel (catálogo).
- Las **metas** son objetivos individuales por paciente: título, categoría (catálogo), fecha objetivo, notas.
- Estados: `open` → `achieved` (guarda fecha de logro) o `dropped`. Se pueden reabrir y eliminar.
- Una meta abierta con fecha objetivo pasada se marca en ámbar. Sin límite de cantidad.

---

## 17. Reglas de importación desde Excel (única vez)

Solo se leen las hojas anonimizadas: Al Falah `September 26` y Al Bateen `Register`. Las demás hojas de Al Bateen contienen datos reales y nunca se leen. La carpeta `data/` está fuera del repositorio.

**Fechas de los scores (acordado: baseline y último comparten fecha hasta que se corrija en la app):**

| Caso | Fecha asignada | `dateSource` |
|---|---|---|
| Al Falah, baseline + último | Ambos en `Last test` | baseline `estimated`, último `recorded` |
| Al Falah, solo baseline | `Last test` (o `Last session` si falta) | `recorded` / `estimated` |
| Al Bateen, con `Last score date` | Ambos en esa fecha | primero `estimated`, último `recorded` |
| Al Bateen, sin fecha pero con `Next check due` | `Next check due − intervalo` | todos `estimated` |
| Al Bateen, sin scores | Nada → el paciente cae en **Sin baseline** | — |
| Score fuera de rango (ej. GAD 29) | Se omite y queda una nota de importación con la anomalía | — |

- El baseline se inserta primero para garantizar el orden por `created_at` cuando la fecha coincide.
- Las columnas derivadas del Excel (tendencia, severidad, next due, razón de seguimiento) **no** se importan como datos; se guardan como una nota de procedencia por paciente.
- Clínicos: `"Dr. X, Nombre"` → psiquiatra `Dr. X`, psicólogo `Nombre`; normaliza `Dr.X` → `Dr. X` y corrige typos conocidos.
- Plan de cuidado: `meds*` → Medicación · `refer*` → Referido a psicología · `psychotherapy/cbt` → Psicoterapia.
- Reejecutar es idempotente por `(centro, MRN)`.

Código: `src/lib/import/alFalah.ts`, `src/lib/import/alBateen.ts`, `src/lib/import/normalize.ts`, `scripts/import-excel.ts`.

---

## 18. Export

`GET /api/export?format=csv|xlsx` devuelve la tabla filtrada actual con columnas derivadas: baseline / último / delta / severidad por escala, tendencia, último score, próximo vencimiento, días vencidos, última cita, alertas, prioridad, candidato a alta, peor severidad, rango severo, fechas y causa de enrolamiento / desenrolamiento, sesiones de psicología / psiquiatría / total.

---

## 19. Acceso y privacidad

- Login único de administrador (`ADMIN_USERNAME` / `ADMIN_PASSWORD` en variables de entorno). Sesión JWT HS256 en cookie `horizon_session` (12 h, httpOnly). Comparación de contraseña en tiempo constante.
- Todas las páginas y acciones exigen sesión (`proxy.ts` + `requireSession()`).
- Los cuerpos de notas nunca se escriben en logs.
- Idiomas: EN / ES / AR (RTL) vía cookie `horizon_locale`.

---

## 20. Tipos de referencia

```ts
// src/lib/metrics/types.ts
export type Severity = "minimal" | "mild" | "moderate" | "moderately_severe" | "severe";
export type ScaleTrend = "improving" | "stable" | "worsening";
export type Trend = ScaleTrend | "mixed" | "first_score";
export type AssessmentStatus = "no_scores" | "ok" | "overdue";
export type AttendanceStatus = "ok" | "concern" | "unknown";
export type Flag = "worsening" | "no_score" | "no_session" | "no_baseline";

export type MetricSettings = {
  phqChangeThreshold: number;
  gadChangeThreshold: number;
  checkIntervalMonths: number;
  attendanceConcernDays: number;
};

export const DEFAULT_METRIC_SETTINGS: MetricSettings = {
  phqChangeThreshold: 5,
  gadChangeThreshold: 4,
  checkIntervalMonths: 1,
  attendanceConcernDays: 30,
};

export type PatientDerived = {
  phq: ScaleSummary;
  gad: ScaleSummary;
  maxSeverity: Severity | null;
  severeRange: boolean;
  graduationCandidate: boolean;
  trend: Trend | null;
  lastScoreDate: string | null;
  nextDueDate: string | null;
  assessmentStatus: AssessmentStatus;
  daysPastDue: number | null;
  attendanceStatus: AttendanceStatus;
  daysSinceSession: number | null;
  flags: Flag[];
  needsAttention: boolean;
  priorityScore: number;
};
```

---

## Mapa de archivos

| Regla | Archivo |
|---|---|
| Severidad, rango severo, máximos de escala | `src/lib/metrics/severity.ts` |
| Orden cronológico, baseline/último, delta, tendencia | `src/lib/metrics/trend.ts` |
| Vencimiento de screening, asistencia | `src/lib/metrics/alerts.ts` |
| Cuatro reglas, pesos, prioridad | `src/lib/metrics/flags.ts` |
| Derivación por paciente, KPIs | `src/lib/metrics/derive.ts` |
| Tipos y defaults | `src/lib/metrics/types.ts` |
| Validación de formularios | `src/lib/validation.ts` |
| Filtros y orden de tabla | `src/lib/filters.ts` |
| Parámetros (tabla `settings`) | `src/db/schema.ts` |
| Importación Excel | `src/lib/import/*`, `scripts/import-excel.ts` |
| Tests | `src/lib/metrics/__tests__/`, `src/lib/import/__tests__/` |
