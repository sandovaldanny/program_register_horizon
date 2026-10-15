import { describe, expect, it } from "vitest";
import { gadSeverity, phqSeverity, severityFor, tierFromScores } from "../severity";

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

describe("tierFromScores", () => {
  it("returns null when no scores", () => {
    expect(tierFromScores(null, null)).toBeNull();
  });
  it("uses the higher of the two scales", () => {
    expect(tierFromScores(3, 12)).toBe("tier2");
    expect(tierFromScores(16, 2)).toBe("tier3");
  });
  it("works with only one scale present", () => {
    expect(tierFromScores(null, 7)).toBe("tier1");
    expect(tierFromScores(4, null)).toBe("minimal");
  });
  it.each([
    [4, "minimal"],
    [5, "tier1"],
    [9, "tier1"],
    [10, "tier2"],
    [14, "tier2"],
    [15, "tier3"],
  ])("boundary %i → %s", (score, expected) => {
    expect(tierFromScores(score, null)).toBe(expected);
  });
});
