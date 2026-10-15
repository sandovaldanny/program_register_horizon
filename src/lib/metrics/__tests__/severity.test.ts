import { describe, expect, it } from "vitest";
import { gadSeverity, isSevereRange, maxSeverity, phqSeverity, severityFor } from "../severity";

describe("phqSeverity", () => {
  it.each([
    [0, "minimal"],
    [4, "minimal"],
    [5, "mild"],
    [9, "mild"],
    [10, "moderate"],
    [14, "moderate"],
    [15, "moderately_severe"],
    [19, "moderately_severe"],
    [20, "severe"],
    [27, "severe"],
  ])("score %i → %s", (score, expected) => {
    expect(phqSeverity(score)).toBe(expected);
  });
});

describe("gadSeverity", () => {
  it.each([
    [0, "minimal"],
    [4, "minimal"],
    [5, "mild"],
    [9, "mild"],
    [10, "moderate"],
    [14, "moderate"],
    [15, "severe"],
    [21, "severe"],
  ])("score %i → %s", (score, expected) => {
    expect(gadSeverity(score)).toBe(expected);
  });
});

describe("severityFor", () => {
  it("dispatches by scale", () => {
    expect(severityFor("phq9", 17)).toBe("moderately_severe");
    expect(severityFor("gad7", 17)).toBe("severe");
  });
});

describe("maxSeverity", () => {
  it("returns null when nothing present", () => {
    expect(maxSeverity(null, null)).toBeNull();
  });
  it("picks the worst band", () => {
    expect(maxSeverity("mild", "severe")).toBe("severe");
    expect(maxSeverity("moderately_severe", "moderate")).toBe("moderately_severe");
    expect(maxSeverity(null, "minimal")).toBe("minimal");
  });
});

describe("isSevereRange", () => {
  it("PHQ ≥15 or GAD ≥15 counts as severe range", () => {
    expect(isSevereRange(15, 3)).toBe(true);
    expect(isSevereRange(14, 3)).toBe(false);
    expect(isSevereRange(2, 15)).toBe(true);
    expect(isSevereRange(2, 14)).toBe(false);
    expect(isSevereRange(null, null)).toBe(false);
    expect(isSevereRange(null, 16)).toBe(true);
  });
});
