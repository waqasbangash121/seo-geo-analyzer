export {
  EnhancedAuditEngine,
  type EnhancedAuditResult,
  type TechnicalAuditItem,
} from "../../../server/audit-enhanced";

export {
  SiteCrawler,
  type CrawlAnalysis,
  type CrawlPage,
} from "../../../server/crawl";

export {
  GeoAnalyzer,
  type Entity,
  type GeoAnalysis,
  type GeoScore,
} from "../../../server/geo";

export {
  ResearchEngine,
  type Competitor,
  type ContentGap,
  type FaqSuggestion,
  type Keyword,
  type ResearchAnalysis,
  type SnippetOpportunity,
} from "../../../server/research";

export {
  SchemaAuditEngine,
  cleanBrandName,
  type SchemaAuditResult,
  type SchemaRecommendation,
} from "../../../server/schema-audit";

export {
  buildActionPlan,
  type ActionItem,
} from "../../../server/action-plan";

import { EnhancedAuditEngine } from "../../../server/audit-enhanced";

export type AnalyzeWebsiteOptions = {
  url: string;
};

export async function analyzeWebsite({ url }: AnalyzeWebsiteOptions) {
  const engine = new EnhancedAuditEngine();
  return engine.performAudit(url);
}
