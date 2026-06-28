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
  type GeoAnalysis,
  type GeoCompetitor,
  type GeoEntity,
  type GeoRecommendation,
} from "../../../server/geo";

export {
  ResearchEngine,
  type CompetitorInsight,
  type KeywordOpportunity,
  type ResearchReport,
} from "../../../server/research";

export {
  SchemaAuditEngine,
  type SchemaAuditResult,
} from "../../../server/schema-audit";

export {
  buildActionPlan,
  type ActionPlanItem,
} from "../../../server/action-plan";

import { EnhancedAuditEngine } from "../../../server/audit-enhanced";

export type AnalyzeWebsiteOptions = {
  url: string;
};

export async function analyzeWebsite({ url }: AnalyzeWebsiteOptions) {
  const engine = new EnhancedAuditEngine();
  return engine.performAudit(url);
}
