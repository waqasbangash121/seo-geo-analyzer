import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CrawlPage } from "./crawl";

// Force LLM to fail so we test the deterministic heuristic fallback paths.
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => {
    throw new Error("LLM disabled in test");
  }),
}));

import { GeoAnalyzer } from "./geo";
import { ResearchEngine, buildFaqSchema } from "./research";

function makePage(overrides: Partial<CrawlPage> = {}): CrawlPage {
  return {
    url: "https://example.com",
    title: "Example Domain Services",
    description: "We provide example services for businesses worldwide.",
    h1: ["Example Services"],
    images: 3,
    internalLinks: ["https://example.com/about"],
    externalLinks: [],
    statusCode: 200,
    loadTime: 500,
    hasCanonical: true,
    canonical: "https://example.com",
    hasNoindex: false,
    hreflang: [],
    structuredData: ['{"@type":"Organization","name":"Example"}'],
    headings: [
      { level: "h1", text: "Example Services" },
      { level: "h2", text: "What we do" },
    ],
    wordCount: 850,
    readabilityScore: 65,
    bodyText:
      "Example provides cloud hosting and managed services. Our team helps companies scale. " +
      "We offer support, monitoring, and security. Contact us to learn more about pricing and plans.",
    pageSizeBytes: 45000,
    imagesWithoutAlt: 0,
    imagesLazyLoaded: 2,
    scriptCount: 4,
    blockingScriptCount: 1,
    stylesheetCount: 2,
    inlineStyleCount: 0,
    hasViewportMeta: true,
    hasOpenGraph: true,
    hasTwitterCard: false,
    schemaTypes: ["Organization"],
    hasCacheControl: true,
    cacheControl: "public, max-age=3600",
    hasExpires: false,
    hasETag: true,
    isCompressed: true,
    contentEncoding: "gzip",
    hasHsts: true,
    ...overrides,
  };
}

describe("GeoAnalyzer (heuristic fallback)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a complete GEO analysis structure with bounded scores", async () => {
    const analyzer = new GeoAnalyzer();
    const result = await analyzer.analyze("https://example.com", [makePage()]);

    expect(result.overallGeoScore).toBeGreaterThanOrEqual(0);
    expect(result.overallGeoScore).toBeLessThanOrEqual(100);
    expect(result.aiVisibilityScore).toBeGreaterThanOrEqual(0);
    expect(result.aiVisibilityScore).toBeLessThanOrEqual(100);

    expect(Array.isArray(result.scores)).toBe(true);
    expect(result.scores.length).toBeGreaterThan(0);
    for (const s of result.scores) {
      expect(s.score).toBeLessThanOrEqual(s.maxScore);
      expect(["pass", "warning", "fail"]).toContain(s.status);
    }

    expect(result.entities).toHaveProperty("primary");
    expect(result.entities).toHaveProperty("supporting");
    expect(result.entities).toHaveProperty("missing");
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it("rewards structured data presence over pages without it", async () => {
    const analyzer = new GeoAnalyzer();
    const withSchema = await analyzer.analyze("https://a.com", [makePage()]);
    const withoutSchema = await analyzer.analyze("https://b.com", [
      makePage({ structuredData: [] }),
    ]);

    expect(withSchema.overallGeoScore).toBeGreaterThanOrEqual(
      withoutSchema.overallGeoScore
    );
  });
});

describe("ResearchEngine (heuristic fallback)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a complete research structure even when the LLM fails", async () => {
    const engine = new ResearchEngine();
    const result = await engine.analyze("https://example.com", [makePage()]);

    expect(result).toHaveProperty("detectedNiche");
    expect(Array.isArray(result.keywords)).toBe(true);
    expect(Array.isArray(result.competitors)).toBe(true);
    expect(Array.isArray(result.contentGaps)).toBe(true);
    expect(Array.isArray(result.faqSuggestions)).toBe(true);
    expect(Array.isArray(result.snippetOpportunities)).toBe(true);
    expect(result.metricsAreEstimates).toBe(true);
    expect(typeof result.faqSchema).toBe("string");
    // faqSchema must always be valid JSON-LD
    const parsed = JSON.parse(result.faqSchema);
    expect(parsed["@type"]).toBe("FAQPage");
  });
});

describe("buildFaqSchema", () => {
  it("produces valid FAQPage JSON-LD with one entity per FAQ", () => {
    const schema = buildFaqSchema([
      { question: "What is X?", suggestedAnswer: "X is a thing." },
      { question: "How much is Y?", suggestedAnswer: "Y costs money." },
    ]);
    const parsed = JSON.parse(schema);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("FAQPage");
    expect(parsed.mainEntity).toHaveLength(2);
    expect(parsed.mainEntity[0]["@type"]).toBe("Question");
    expect(parsed.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
    expect(parsed.mainEntity[0].acceptedAnswer.text).toBe("X is a thing.");
  });

  it("handles an empty FAQ list", () => {
    const parsed = JSON.parse(buildFaqSchema([]));
    expect(parsed.mainEntity).toEqual([]);
  });
});
