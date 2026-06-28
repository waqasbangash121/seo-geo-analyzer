import { invokeLLM } from "./_core/llm";
import { CrawlPage } from "./crawl";

export interface GeoScore {
  category: string;
  score: number;
  maxScore: number;
  status: "pass" | "warning" | "fail";
  findings: string[];
  recommendations: string[];
}

export interface Entity {
  name: string;
  type:
    | "brand"
    | "product"
    | "service"
    | "location"
    | "person"
    | "organization"
    | "technology"
    | "concept";
  importance: "primary" | "supporting" | "missing";
  mentions: number;
}

export interface GeoAnalysis {
  overallGeoScore: number;
  aiVisibilityScore: number;
  citationPotential: number;
  semanticRichness: number;
  scores: GeoScore[];
  entities: {
    primary: Entity[];
    supporting: Entity[];
    missing: Entity[];
  };
  entityDensity: number;
  directAnswerReadiness: number;
  knowledgeGraphSignals: string[];
  recommendations: {
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
  }[];
}

interface LlmGeoResult {
  aiVisibilityScore: number;
  citationPotential: number;
  semanticRichness: number;
  directAnswerReadiness: number;
  entities: {
    name: string;
    type: Entity["type"];
    importance: Entity["importance"];
    mentions: number;
  }[];
  knowledgeGraphSignals: string[];
  findings: { category: string; finding: string; status: "pass" | "warning" | "fail" }[];
  recommendations: { priority: "high" | "medium" | "low"; title: string; description: string }[];
}

export class GeoAnalyzer {
  async analyze(url: string, pages: CrawlPage[]): Promise<GeoAnalysis> {
    const homepage = pages[0];
    const combinedText = pages
      .slice(0, 5)
      .map((p) => `URL: ${p.url}\nTitle: ${p.title}\nText: ${p.bodyText?.slice(0, 4000) || ""}`)
      .join("\n\n---\n\n");

    const hasStructuredData = pages.some((p) => p.structuredData.length > 0);
    const structuredDataTypes = this.extractSchemaTypes(pages);

    let llmResult: LlmGeoResult | null = null;
    try {
      llmResult = await this.runLlmAnalysis(url, combinedText, structuredDataTypes);
    } catch (error) {
      console.error("[GEO] LLM analysis failed, using heuristic fallback:", error);
    }

    if (llmResult) {
      return this.buildFromLlm(llmResult, pages, hasStructuredData);
    }

    return this.buildHeuristic(pages, hasStructuredData, structuredDataTypes);
  }

  private extractSchemaTypes(pages: CrawlPage[]): string[] {
    const types = new Set<string>();
    pages.forEach((p) => {
      p.structuredData.forEach((sd) => {
        try {
          const parsed = JSON.parse(sd);
          const t = parsed["@type"];
          if (typeof t === "string") types.add(t);
          else if (Array.isArray(t)) t.forEach((x) => types.add(String(x)));
        } catch {
          // ignore malformed JSON-LD
        }
      });
    });
    return Array.from(types);
  }

  private async runLlmAnalysis(
    url: string,
    text: string,
    schemaTypes: string[]
  ): Promise<LlmGeoResult> {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a GEO (Generative Engine Optimization) expert. You analyze website content to determine how well it will be cited and surfaced by AI engines like ChatGPT, Perplexity, Google AI Overviews, Gemini, and Claude. You output strict JSON only.",
        },
        {
          role: "user",
          content: `Analyze the following website (${url}) for Generative Engine Optimization. Existing schema types: ${schemaTypes.join(", ") || "none"}.\n\nContent:\n${text.slice(0, 14000)}\n\nEvaluate AI visibility, citation potential, semantic richness, direct-answer readiness, extract named entities (brands, products, services, locations, people, organizations, technologies, concepts), identify knowledge graph signals, and provide prioritized GEO recommendations.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "geo_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              aiVisibilityScore: { type: "integer", description: "0-100" },
              citationPotential: { type: "integer", description: "0-100" },
              semanticRichness: { type: "integer", description: "0-100" },
              directAnswerReadiness: { type: "integer", description: "0-100" },
              entities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: {
                      type: "string",
                      enum: [
                        "brand",
                        "product",
                        "service",
                        "location",
                        "person",
                        "organization",
                        "technology",
                        "concept",
                      ],
                    },
                    importance: {
                      type: "string",
                      enum: ["primary", "supporting", "missing"],
                    },
                    mentions: { type: "integer" },
                  },
                  required: ["name", "type", "importance", "mentions"],
                  additionalProperties: false,
                },
              },
              knowledgeGraphSignals: { type: "array", items: { type: "string" } },
              findings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    category: { type: "string" },
                    finding: { type: "string" },
                    status: { type: "string", enum: ["pass", "warning", "fail"] },
                  },
                  required: ["category", "finding", "status"],
                  additionalProperties: false,
                },
              },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    priority: { type: "string", enum: ["high", "medium", "low"] },
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["priority", "title", "description"],
                  additionalProperties: false,
                },
              },
            },
            required: [
              "aiVisibilityScore",
              "citationPotential",
              "semanticRichness",
              "directAnswerReadiness",
              "entities",
              "knowledgeGraphSignals",
              "findings",
              "recommendations",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return parsed as LlmGeoResult;
  }

  private buildFromLlm(
    llm: LlmGeoResult,
    pages: CrawlPage[],
    hasStructuredData: boolean
  ): GeoAnalysis {
    const entities = {
      primary: llm.entities.filter((e) => e.importance === "primary"),
      supporting: llm.entities.filter((e) => e.importance === "supporting"),
      missing: llm.entities.filter((e) => e.importance === "missing"),
    };

    const totalWords = pages.reduce((sum, p) => sum + p.wordCount, 0) || 1;
    const totalMentions = llm.entities.reduce((sum, e) => sum + e.mentions, 0);
    const entityDensity = Math.round((totalMentions / totalWords) * 1000) / 10;

    const scores: GeoScore[] = [
      this.scoreFromValue("AI Visibility", llm.aiVisibilityScore, llm.findings, "visibility"),
      this.scoreFromValue("Citation Potential", llm.citationPotential, llm.findings, "citation"),
      this.scoreFromValue("Semantic Richness", llm.semanticRichness, llm.findings, "semantic"),
      this.scoreFromValue(
        "Direct Answer Readiness",
        llm.directAnswerReadiness,
        llm.findings,
        "answer"
      ),
      this.structuredDataScore(hasStructuredData, llm.knowledgeGraphSignals),
    ];

    const overallGeoScore = Math.round(
      (llm.aiVisibilityScore +
        llm.citationPotential +
        llm.semanticRichness +
        llm.directAnswerReadiness) /
        4
    );

    return {
      overallGeoScore,
      aiVisibilityScore: llm.aiVisibilityScore,
      citationPotential: llm.citationPotential,
      semanticRichness: llm.semanticRichness,
      scores,
      entities,
      entityDensity,
      directAnswerReadiness: llm.directAnswerReadiness,
      knowledgeGraphSignals: llm.knowledgeGraphSignals,
      recommendations: llm.recommendations,
    };
  }

  private scoreFromValue(
    category: string,
    value: number,
    findings: LlmGeoResult["findings"],
    keyword: string
  ): GeoScore {
    const relevant = findings.filter((f) =>
      f.category.toLowerCase().includes(keyword)
    );
    return {
      category,
      score: value,
      maxScore: 100,
      status: value >= 70 ? "pass" : value >= 40 ? "warning" : "fail",
      findings: relevant.map((f) => f.finding),
      recommendations: [],
    };
  }

  private structuredDataScore(
    hasStructuredData: boolean,
    signals: string[]
  ): GeoScore {
    const score = hasStructuredData ? Math.min(100, 50 + signals.length * 10) : 20;
    return {
      category: "Knowledge Graph Signals",
      score,
      maxScore: 100,
      status: score >= 70 ? "pass" : score >= 40 ? "warning" : "fail",
      findings: hasStructuredData
        ? [`Found ${signals.length} knowledge graph signals`]
        : ["No structured data detected for knowledge graph eligibility"],
      recommendations: [],
    };
  }

  private buildHeuristic(
    pages: CrawlPage[],
    hasStructuredData: boolean,
    schemaTypes: string[]
  ): GeoAnalysis {
    const avgWordCount =
      pages.reduce((sum, p) => sum + p.wordCount, 0) / (pages.length || 1);

    // Heuristic AI visibility: content depth + structured data + headings
    const contentDepthScore = Math.min(100, Math.round((avgWordCount / 800) * 100));
    const structuredScore = hasStructuredData ? 75 : 25;
    const headingScore = pages.some((p) => p.headings.length > 3) ? 70 : 40;

    const aiVisibilityScore = Math.round(
      (contentDepthScore + structuredScore + headingScore) / 3
    );
    const citationPotential = Math.round((contentDepthScore + structuredScore) / 2);
    const semanticRichness = Math.round((contentDepthScore + headingScore) / 2);
    const directAnswerReadiness = pages.some((p) =>
      p.headings.some((h) => /\?|how|what|why|when|where/i.test(h.text))
    )
      ? 65
      : 35;

    const overallGeoScore = Math.round(
      (aiVisibilityScore + citationPotential + semanticRichness + directAnswerReadiness) / 4
    );

    const scores: GeoScore[] = [
      {
        category: "AI Visibility",
        score: aiVisibilityScore,
        maxScore: 100,
        status: aiVisibilityScore >= 70 ? "pass" : aiVisibilityScore >= 40 ? "warning" : "fail",
        findings: [`Average content depth: ${Math.round(avgWordCount)} words per page`],
        recommendations: [],
      },
      {
        category: "Citation Potential",
        score: citationPotential,
        maxScore: 100,
        status: citationPotential >= 70 ? "pass" : citationPotential >= 40 ? "warning" : "fail",
        findings: [
          hasStructuredData
            ? "Structured data improves citation eligibility"
            : "No structured data found",
        ],
        recommendations: [],
      },
      {
        category: "Semantic Richness",
        score: semanticRichness,
        maxScore: 100,
        status: semanticRichness >= 70 ? "pass" : semanticRichness >= 40 ? "warning" : "fail",
        findings: [`Schema types: ${schemaTypes.join(", ") || "none"}`],
        recommendations: [],
      },
      {
        category: "Direct Answer Readiness",
        score: directAnswerReadiness,
        maxScore: 100,
        status:
          directAnswerReadiness >= 70 ? "pass" : directAnswerReadiness >= 40 ? "warning" : "fail",
        findings: [
          directAnswerReadiness >= 65
            ? "Question-style headings detected"
            : "Few question-based headings for AI direct answers",
        ],
        recommendations: [],
      },
    ];

    const recommendations: GeoAnalysis["recommendations"] = [];
    if (!hasStructuredData) {
      recommendations.push({
        priority: "high",
        title: "Add Structured Data (JSON-LD)",
        description:
          "Implement schema.org markup (Organization, FAQPage, Article) to become eligible for AI Overviews and knowledge graph citations.",
      });
    }
    if (avgWordCount < 500) {
      recommendations.push({
        priority: "high",
        title: "Expand Content Depth",
        description:
          "AI engines favor comprehensive content. Aim for 800+ words on key pages with clear, factual statements.",
      });
    }
    if (directAnswerReadiness < 65) {
      recommendations.push({
        priority: "medium",
        title: "Add Question-Based Headings",
        description:
          "Structure content around questions users ask AI engines, with concise direct answers immediately after each heading.",
      });
    }

    return {
      overallGeoScore,
      aiVisibilityScore,
      citationPotential,
      semanticRichness,
      scores,
      entities: { primary: [], supporting: [], missing: [] },
      entityDensity: 0,
      directAnswerReadiness,
      knowledgeGraphSignals: schemaTypes,
      recommendations,
    };
  }
}
