import { describe, expect, it } from "vitest";
import { patientSchema, unenrollSchema } from "../validation";

const base = { center: "al_falah", mrn: "P-1", enrolledAt: "2026-01-10" };

describe("patientSchema — enrolment", () => {
  it("enrolled patient: unenrolment fields are cleared", () => {
    const r = patientSchema.parse({ ...base, status: "active", unenrolledAt: "2026-02-01", unenrollReason: "No insurance" });
    expect(r.unenrolledAt).toBeNull();
    expect(r.unenrollReason).toBeNull();
  });

  it("unenrolling requires date and reason", () => {
    const r = patientSchema.safeParse({ ...base, status: "inactive" });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("unenrolledAt");
    expect(paths).toContain("unenrollReason");
  });

  it("unenrolment date cannot precede enrolment", () => {
    const r = patientSchema.safeParse({ ...base, status: "inactive", unenrolledAt: "2026-01-01", unenrollReason: "No insurance" });
    expect(r.success).toBe(false);
    expect(r.success ? "" : r.error.issues[0].message).toBe("unenrolledBeforeEnrolled");
  });

  it("valid unenrolment keeps its fields", () => {
    const r = patientSchema.parse({ ...base, status: "inactive", unenrolledAt: "2026-03-01", unenrollReason: "No insurance" });
    expect(r.unenrolledAt).toBe("2026-03-01");
    expect(r.unenrollReason).toBe("No insurance");
  });
});

describe("patientSchema — sessions", () => {
  it("total = psychology + psychiatry", () => {
    const r = patientSchema.parse({ ...base, psychologySessions: "7", psychiatrySessions: "3" });
    expect(r.sessionsCount).toBe(10);
  });

  it("one side missing counts as zero", () => {
    expect(patientSchema.parse({ ...base, psychologySessions: "4", psychiatrySessions: "" }).sessionsCount).toBe(4);
  });

  it("both blank → total unknown", () => {
    expect(patientSchema.parse({ ...base, psychologySessions: "", psychiatrySessions: "" }).sessionsCount).toBeNull();
  });
});

describe("unenrollSchema", () => {
  it("rejects a future date and an empty reason", () => {
    expect(unenrollSchema.safeParse({ unenrolledAt: "2999-01-01", unenrollReason: "x" }).success).toBe(false);
    expect(unenrollSchema.safeParse({ unenrolledAt: "2026-01-01", unenrollReason: "" }).success).toBe(false);
  });
});
