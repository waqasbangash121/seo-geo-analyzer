import { invokeLLM } from "./_core/llm";
import { CrawlPage } from "./crawl";

export interface Keyword {
  keyword: string;
  type: "primary" | "long-tail" | "commercial" | "geo" | "semantic";
  intent: "informational" | "commercial" | "transactional" | "navigational";
  difficulty: number; // 0-100
  estimatedVolume: string;
  opportunityScore: number; // 0-100
}

export interface Competitor {
  name: string;
  domain: string;
  strengthSummary: string;
  contentDepth: "high" | "medium" | "low";
  estimatedAuthority: number; // 0-100
  keyAdvantages: string[];
}

export interface ContentGap {
  topic: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

export interface FaqSuggestion {
  question: string;
  suggestedAnswer: string;
}

export interface SnippetOpportunity {
  query: string;
  format: "paragraph" | "list" | "table";
  recommendation: string;
}

export interface ResearchAnalysis {
  keywords: Keyword[];
  competitors: Competitor[];
  contentGaps: ContentGap[];
  faqSuggestions: FaqSuggestion[];
  snippetOpportunities: SnippetOpportunity[];
  detectedNiche: string;
  /** Copy-paste-ready JSON-LD FAQPage schema generated from faqSuggestions. */
  faqSchema: string;
  /** True when keyword/competitor metrics are AI-estimated rather than from a live data source. */
  metricsAreEstimates: boolean;
}

export class ResearchEngine {
  async analyze(url: string, pages: CrawlPage[]): Promise<ResearchAnalysis> {
    const homepage = pages[0];
    const context = pages
      .slice(0, 4)
      .map((p) => `Title: ${p.title}\nDescription: ${p.description}\nContent: ${p.bodyText?.slice(0, 3000) || ""}`)
      .join("\n\n---\n\n");

    let core: ResearchAnalysis;
    try {
      core = await this.runLlmResearch(url, context);
    } catch (error) {
      console.error("[Research] LLM analysis failed, using fallback:", error);
      core = this.buildFallback(homepage);
    }

    // Dedicated second call to reliably produce 20+ FAQ items without truncation.
    try {
      const faqs = await this.runFaqGeneration(url, context, core.detectedNiche);
      if (faqs.length >= core.faqSuggestions.length) {
        core.faqSuggestions = faqs;
      }
    } catch (error) {
      console.error("[Research] FAQ expansion failed, keeping core FAQs:", error);
    }

    core.faqSchema = buildFaqSchema(core.faqSuggestions);
    core.metricsAreEstimates = true;
    return core;
  }

  private async runFaqGeneration(
    url: string,
    context: string,
    niche: string
  ): Promise<FaqSuggestion[]> {
    const response = await invokeLLM({
      max_tokens: 6000,
      messages: [
        {
          role: "system",
          content:
            "You are an SEO FAQ specialist. Generate a comprehensive FAQ set that real users in the given niche would search for. Output strict JSON only. Keep each answer to 1-2 concise sentences so the JSON stays valid and complete.",
        },
        {
          role: "user",
          content: `Website: ${url}\nNiche: ${niche}\n\nContent:\n${context.slice(0, 6000)}\n\nGenerate at least 20 distinct, useful FAQ questions with concise answers relevant to this site and niche.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "faq_set",
          strict: true,
          schema: {
            type: "object",
            properties: {
              faqSuggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    suggestedAnswer: { type: "string" },
                  },
                  required: ["question", "suggestedAnswer"],
                  additionalProperties: false,
                },
              },
            },
            required: ["faqSuggestions"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices[0].message.content;
    const parsed = typeof content === "string" ? safeJsonParse(content) : content;
    return (parsed?.faqSuggestions ?? []) as FaqSuggestion[];
  }

  private async runLlmResearch(url: string, context: string): Promise<ResearchAnalysis> {
    const response = await invokeLLM({
      max_tokens: 12000,
      messages: [
        {
          role: "system",
          content:
            "You are an SEO and competitive intelligence expert. You analyze a website to identify its niche, generate keyword research, identify likely ranking competitors, find content gaps, and identify featured snippet opportunities. You output strict JSON only. Keep each text field very concise (1 sentence max) to ensure a complete, valid JSON response. Base competitor names on well-known real companies in the detected niche.",
        },
        {
          role: "user",
          content: `Analyze this website (${url}) and produce SEO research.\n\nWebsite content:\n${context.slice(0, 10000)}\n\nGenerate: 1) 12 keywords across types (primary, long-tail, commercial, geo, semantic) with intent, difficulty, estimated volume, opportunity score; 2) up to 6 likely ranking competitors (keyAdvantages max 2 short items each); 3) up to 6 content gaps; 4) at least 6 featured snippet opportunities and MUST include at least one with format 'table' (e.g. a comparison or pricing query); 5) the detected niche. Keep all text fields to one short sentence. All volume/difficulty/authority numbers are your best estimates. Do NOT include FAQs.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "seo_research",
          strict: true,
          schema: {
            type: "object",
            properties: {
              detectedNiche: { type: "string" },
              keywords: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    keyword: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["primary", "long-tail", "commercial", "geo", "semantic"],
                    },
                    intent: {
                      type: "string",
                      enum: ["informational", "commercial", "transactional", "navigational"],
                    },
                    difficulty: { type: "integer" },
                    estimatedVolume: { type: "string" },
                    opportunityScore: { type: "integer" },
                  },
                  required: [
                    "keyword",
                    "type",
                    "intent",
                    "difficulty",
                    "estimatedVolume",
                    "opportunityScore",
                  ],
                  additionalProperties: false,
                },
              },
              competitors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    domain: { type: "string" },
                    strengthSummary: { type: "string" },
                    contentDepth: { type: "string", enum: ["high", "medium", "low"] },
                    estimatedAuthority: { type: "integer" },
                    keyAdvantages: { type: "array", items: { type: "string" } },
                  },
                  required: [
                    "name",
                    "domain",
                    "strengthSummary",
                    "contentDepth",
                    "estimatedAuthority",
                    "keyAdvantages",
                  ],
                  additionalProperties: false,
                },
              },
              contentGaps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    topic: { type: "string" },
                    reason: { type: "string" },
                    priority: { type: "string", enum: ["high", "medium", "low"] },
                  },
                  required: ["topic", "reason", "priority"],
                  additionalProperties: false,
                },
              },
              snippetOpportunities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    format: { type: "string", enum: ["paragraph", "list", "table"] },
                    recommendation: { type: "string" },
                  },
                  required: ["query", "format", "recommendation"],
                  additionalProperties: false,
                },
              },
            },
            required: [
              "detectedNiche",
              "keywords",
              "competitors",
              "contentGaps",
              "snippetOpportunities",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const parsed = typeof content === "string" ? safeJsonParse(content) : content;
    // Ensure all required arrays exist even if the model omitted one.
    return {
      detectedNiche: parsed.detectedNiche ?? "General",
      keywords: parsed.keywords ?? [],
      competitors: parsed.competitors ?? [],
      contentGaps: parsed.contentGaps ?? [],
      faqSuggestions: parsed.faqSuggestions ?? [],
      snippetOpportunities: parsed.snippetOpportunities ?? [],
      faqSchema: "",
      metricsAreEstimates: true,
    } as ResearchAnalysis;
  }

  private buildFallback(homepage: CrawlPage): ResearchAnalysis {
    const baseKeyword = homepage.title?.split(/[-|]/)[0]?.trim() || "your business";
    return {
      detectedNiche: "General",
      keywords: [
        {
          keyword: baseKeyword.toLowerCase(),
          type: "primary",
          intent: "commercial",
          difficulty: 50,
          estimatedVolume: "1K-10K",
          opportunityScore: 60,
        },
      ],
      competitors: [],
      contentGaps: [
        {
          topic: "Comprehensive guides",
          reason: "AI analysis unavailable; add in-depth topical content",
          priority: "high",
        },
      ],
      faqSuggestions: [],
      snippetOpportunities: [],
      faqSchema: buildFaqSchema([]),
      metricsAreEstimates: true,
    };
  }
}

/**
 * Parse JSON that may be truncated by the LLM token limit. Falls back to a
 * best-effort repair that closes unterminated strings/arrays/objects so we can
 * salvage the complete leading entries instead of failing the whole call.
 */
export function safeJsonParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    // attempt repair
  }

  let s = raw.trim();
  // Drop any trailing incomplete token after the last complete element.
  // Remove a dangling partial string (unmatched opening quote).
  const quoteCount = (s.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    // close the open string
    s += '"';
  }
  // Remove a trailing comma if present.
  s = s.replace(/,\s*$/, "");

  // Balance brackets/braces.
  const openCurly = (s.match(/{/g) || []).length;
  const closeCurly = (s.match(/}/g) || []).length;
  const openSquare = (s.match(/\[/g) || []).length;
  const closeSquare = (s.match(/]/g) || []).length;
  s += "]".repeat(Math.max(0, openSquare - closeSquare));
  s += "}".repeat(Math.max(0, openCurly - closeCurly));

  try {
    return JSON.parse(s);
  } catch {
    // Final fallback: return empty object so callers use their defaults.
    return {};
  }
}

/** Build a copy-paste-ready JSON-LD FAQPage schema from FAQ suggestions. */
export function buildFaqSchema(faqs: FaqSuggestion[]): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.suggestedAnswer,
      },
    })),
  };
  return JSON.stringify(schema, null, 2);
}
