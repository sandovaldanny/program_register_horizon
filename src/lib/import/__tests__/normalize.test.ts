import { describe, expect, it } from "vitest";
import {
  cellDate,
  cellNumber,
  cellText,
  headerIndex,
  isoMinusMonths,
  mapGender,
  mapPriority,
  mapYesNo,
  normalizeClinicianName,
  pick,
  scoreOrNull,
  splitNames,
  splitSpecialists,
} from "../normalize";

describe("cell helpers", () => {
  it("unwraps formula results and rich text", () => {
    expect(cellText({ formula: "A1", result: "Severe Anxiety" })).toBe("Severe Anxiety");
    expect(cellText({ richText: [{ text: "Hello " }, { text: "world" }] })).toBe("Hello world");
    expect(cellText("  Psychotherapy  ")).toBe("Psychotherapy");
    expect(cellText("")).toBeNull();
    expect(cellText(null)).toBeNull();
  });
  it("reads numbers from numbers and numeric strings", () => {
    expect(cellNumber(18)).toBe(18);
    expect(cellNumber("12")).toBe(12);
    expect(cellNumber({ result: 7 })).toBe(7);
    expect(cellNumber("abc")).toBeNull();
    expect(cellNumber(null)).toBeNull();
  });
  it("reads dates from Date objects, serials and strings", () => {
    expect(cellDate(new Date("2026-09-23T00:00:00.000Z"))).toBe("2026-09-23");
    expect(cellDate(46285)).toBe("2026-09-20");
    expect(cellDate("2026-10-01")).toBe("2026-10-01");
    expect(cellDate("not a date")).toBeNull();
    expect(cellDate(null)).toBeNull();
  });
  it("isoMinusMonths clamps at month end", () => {
    expect(isoMinusMonths("2026-10-31", 1)).toBe("2026-09-30");
    expect(isoMinusMonths("2026-03-15", 1)).toBe("2026-02-15");
  });
});

describe("clinician names", () => {
  it.each([
    ["Dr.Ramez", "Dr. Ramez"],
    ["Dr. Ramez", "Dr. Ramez"],
    ["dr ramez", "Dr. Ramez"],
    ["Dr. Divya (once)", "Dr. Divya"],
    ["sometimes Lara", "Lara"],
    ["amal", "Amal"],
    ["Dr. Amnha", "Dr. Amnah"],
    ["  ", null],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeClinicianName(raw)).toBe(expected);
  });
  it("splits lists on commas and dedupes", () => {
    expect(splitNames("Fedaa, Duree")).toEqual(["Fedaa", "Duree"]);
    expect(splitNames("Lara, lara")).toEqual(["Lara"]);
    expect(splitNames(null)).toEqual([]);
  });
  it("splits Al Falah specialists into psychiatrists and psychologists", () => {
    expect(splitSpecialists("Dr. Ramy, amal")).toEqual({ psychiatrist: ["Dr. Ramy"], psychologist: ["Amal"] });
    expect(splitSpecialists("Dr. Amnha, Ghada")).toEqual({ psychiatrist: ["Dr. Amnah"], psychologist: ["Ghada"] });
    expect(splitSpecialists("Dr. Ramy")).toEqual({ psychiatrist: ["Dr. Ramy"], psychologist: [] });
  });
});

describe("enum mappers", () => {
  it("priority", () => {
    expect(mapPriority("High Priority")).toBe("high");
    expect(mapPriority("Mid Priority")).toBe("mid");
    expect(mapPriority("Low Priority")).toBe("low");
    expect(mapPriority("Routine")).toBe("routine");
    expect(mapPriority(null)).toBe("routine");
  });
  it("yes/no", () => {
    expect(mapYesNo("Yes")).toBe("yes");
    expect(mapYesNo("no")).toBe("no");
    expect(mapYesNo(null)).toBe("unknown");
  });
  it("gender", () => {
    expect(mapGender("Female")).toBe("female");
    expect(mapGender("Male")).toBe("male");
    expect(mapGender(null)).toBe("unknown");
  });
});

describe("scoreOrNull", () => {
  it("accepts in-range integers", () => {
    expect(scoreOrNull(21, 21)).toEqual({ value: 21, error: null });
    expect(scoreOrNull(0, 27)).toEqual({ value: 0, error: null });
  });
  it("rejects out-of-range values with a message", () => {
    expect(scoreOrNull(29, 21)).toEqual({ value: null, error: "score 29 outside 0–21" });
    expect(scoreOrNull(-1, 27).error).toMatch(/outside/);
  });
  it("treats blanks as absent", () => {
    expect(scoreOrNull(null, 27)).toEqual({ value: null, error: null });
    expect(scoreOrNull("", 27)).toEqual({ value: null, error: null });
  });
});

describe("headerIndex / pick", () => {
  it("matches headers ignoring case and trailing spaces", () => {
    const headers = headerIndex([null, "MRN", "Care Plan ", { result: "Last test" }]);
    const row = [null, "Patient 1", "meds", new Date("2026-01-02T00:00:00Z")];
    expect(cellText(pick(row, headers, "mrn"))).toBe("Patient 1");
    expect(cellText(pick(row, headers, "care plan"))).toBe("meds");
    expect(cellDate(pick(row, headers, "LAST TEST"))).toBe("2026-01-02");
    expect(pick(row, headers, "missing")).toBeNull();
  });
});
