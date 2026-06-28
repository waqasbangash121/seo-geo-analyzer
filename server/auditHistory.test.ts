import { describe, it, expect } from "vitest";
import { safeParse, buildHistoryRow } from "./auditHistory";

describe("safeParse", () => {
  it("parses valid JSON", () => {
    expect(safeParse('{"a":1}', {})).toEqual({ a: 1 });
    expect(safeParse("[1,2,3]", [])).toEqual([1, 2, 3]);
  });

  it("returns the fallback for invalid or empty input", () => {
    expect(safeParse("not json", [])).toEqual([]);
    expect(safeParse(null, null)).toBeNull();
    expect(safeParse(undefined, "fallback")).toBe("fallback");
  });
});

describe("buildHistoryRow", () => {
  it("rounds scores to integers and stringifies JSON fields", () => {
    const row = buildHistoryRow({
      url: "https://example.com",
      domain: "example.com",
      overallScore: 87.6,
      seoScore: 90.2,
      geoScore: 84.9,
      technicalAudit: [{ id: "x", status: "pass" }],
      title: "Example",
      description: "desc",
    });

    expect(row.overallScore).toBe(88);
    expect(row.seoScore).toBe(90);
    expect(row.geoScore).toBe(85);
    expect(JSON.parse(row.auditItems)).toEqual([{ id: "x", status: "pass" }]);
    expect(row.pageTitle).toBe("Example");
    expect(row.pageDescription).toBe("desc");
  });

  it("defaults missing scores to 0 and falls back to auditItems field", () => {
    const row = buildHistoryRow({
      url: "https://example.com",
      domain: "example.com",
      auditItems: [{ id: "y" }],
    });

    expect(row.overallScore).toBe(0);
    expect(row.seoScore).toBe(0);
    expect(row.geoScore).toBe(0);
    expect(JSON.parse(row.auditItems)).toEqual([{ id: "y" }]);
  });

  it("produces a fullReport snapshot that round-trips through safeParse", () => {
    const input = {
      url: "https://example.com",
      domain: "example.com",
      overallScore: 50,
      technicalAudit: [{ id: "z" }],
    };
    const row = buildHistoryRow(input);
    const restored = safeParse(row.fullReport, null) as typeof input | null;
    expect(restored?.url).toBe("https://example.com");
    expect(restored?.overallScore).toBe(50);
  });
});
