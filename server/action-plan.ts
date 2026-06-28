import { TechnicalAuditItem } from "./audit-enhanced";
import { GeoAnalysis } from "./geo";
import { ResearchAnalysis } from "./research";
import { SchemaAuditResult } from "./schema-audit";

export interface ActionItem {
  title: string;
  category: "Technical SEO" | "GEO / AI Visibility" | "Content" | "Schema" | "Performance";
  priority: "critical" | "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  expectedImpact: string;
  details: string;
}

interface ActionPlanInput {
  technicalAudit: TechnicalAuditItem[];
  geo: GeoAnalysis | null;
  research: ResearchAnalysis | null;
  schema: SchemaAuditResult;
}

const priorityWeight: Record<ActionItem["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Aggregate findings from every engine into a single prioritized action plan.
 * Deterministic (no LLM) so the plan is stable and fast.
 */
export function buildActionPlan(input: ActionPlanInput): ActionItem[] {
  const items: ActionItem[] = [];

  // Technical SEO issues (skip passes)
  for (const t of input.technicalAudit) {
    if (t.status === "pass") continue;
    const category: ActionItem["category"] =
      t.category === "performance"
        ? "Performance"
        : t.category === "content"
          ? "Content"
          : "Technical SEO";
    items.push({
      title: t.title,
      category,
      priority: t.impact,
      effort: t.impact === "critical" ? "medium" : "low",
      expectedImpact:
        t.impact === "critical"
          ? "Removes a blocker to indexing/ranking"
          : t.impact === "high"
            ? "Meaningful ranking/CTR improvement"
            : "Incremental SEO gain",
      details: `${t.description}. ${t.recommendation}.`,
    });
  }

  // GEO / AI visibility recommendations
  if (input.geo) {
    if (input.geo.overallGeoScore < 70 && Array.isArray(input.geo.recommendations)) {
      for (const rec of input.geo.recommendations.slice(0, 5)) {
        items.push({
          title: typeof rec === "string" ? rec : (rec as any).title || "Improve GEO signal",
          category: "GEO / AI Visibility",
          priority: input.geo.overallGeoScore < 40 ? "high" : "medium",
          effort: "medium",
          expectedImpact: "Better visibility in AI answers (ChatGPT, Perplexity, AI Overviews)",
          details:
            typeof rec === "string"
              ? rec
              : (rec as any).description || "Strengthen entity coverage and direct-answer formatting.",
        });
      }
    }
  }

  // Schema recommendations
  for (const rec of input.schema.recommendations) {
    items.push({
      title: `Add ${rec.type} schema`,
      category: "Schema",
      priority: rec.priority,
      effort: "low",
      expectedImpact: "Eligibility for rich results and clearer entity signals",
      details: rec.reason,
    });
  }

  // Content gaps from research
  if (input.research?.contentGaps) {
    for (const gap of input.research.contentGaps.slice(0, 5)) {
      items.push({
        title: `Create content: ${gap.topic}`,
        category: "Content",
        priority: gap.priority,
        effort: "high",
        expectedImpact: "Captures untapped search demand and topical authority",
        details: gap.reason,
      });
    }
  }

  // Sort by priority then effort (low effort first within a priority)
  const effortWeight: Record<ActionItem["effort"], number> = {
    low: 0,
    medium: 1,
    high: 2,
  };
  items.sort((a, b) => {
    const p = priorityWeight[a.priority] - priorityWeight[b.priority];
    if (p !== 0) return p;
    return effortWeight[a.effort] - effortWeight[b.effort];
  });

  return items;
}
