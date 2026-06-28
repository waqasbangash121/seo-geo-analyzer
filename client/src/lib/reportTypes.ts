// Shared frontend types mirroring the server report shape.

export interface TechnicalAuditItem {
  id: string;
  category: "technical" | "content" | "performance" | "accessibility" | "geo";
  title: string;
  description: string;
  status: "pass" | "warning" | "fail";
  impact: "critical" | "high" | "medium" | "low";
  recommendation?: string;
  value?: string | number;
}

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
  type: string;
  importance: "primary" | "supporting" | "missing";
  mentions: number;
}

export interface GeoAnalysis {
  overallGeoScore: number;
  aiVisibilityScore: number;
  citationPotential: number;
  semanticRichness: number;
  directAnswerReadiness: number;
  scores: GeoScore[];
  entities: {
    primary: Entity[];
    supporting: Entity[];
    missing: Entity[];
  };
  entityDensity: number;
  knowledgeGraphSignals: string[];
  recommendations: {
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
  }[];
}

export interface Keyword {
  keyword: string;
  type: "primary" | "long-tail" | "commercial" | "geo" | "semantic";
  intent: "informational" | "commercial" | "transactional" | "navigational";
  difficulty: number;
  estimatedVolume: string;
  opportunityScore: number;
}

export interface Competitor {
  name: string;
  domain: string;
  strengthSummary: string;
  contentDepth: "high" | "medium" | "low";
  estimatedAuthority: number;
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
  faqSchema?: string;
  metricsAreEstimates?: boolean;
}

export interface SchemaRecommendation {
  type: string;
  reason: string;
  priority: "high" | "medium" | "low";
  jsonLd: string;
}

export interface SchemaAuditResult {
  detectedTypes: string[];
  missingTypes: string[];
  pagesWithSchema: number;
  totalPages: number;
  coveragePercent: number;
  recommendations: SchemaRecommendation[];
}

export interface ActionItem {
  title: string;
  category: "Technical SEO" | "GEO / AI Visibility" | "Content" | "Schema" | "Performance";
  priority: "critical" | "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  expectedImpact: string;
  details: string;
}

export interface CoreWebVitals {
  estLCP: number;
  estCLS: number;
  estINP: number;
  rating: "good" | "needs-improvement" | "poor";
}

export interface CrawlAnalysis {
  totalPages: number;
  crawlDepth: number;
  avgLoadTime: number;
  orphanPages: string[];
  brokenLinks: string[];
  redirectChains: any[];
  canonicalIssues: { page: string; issue: string }[];
  noindexPages: string[];
  duplicateContentRisks?: any[];
  pageTypes?: Record<string, any[]>;
  performance?: {
    avgPageSizeKb: number;
    estLCP: number;
    estCLS: number;
    estINP: number;
    rating: "good" | "needs-improvement" | "poor";
    totalImagesWithoutAlt: number;
    pagesWithBlockingScripts: number;
    pagesMissingViewport: number;
    pagesWithCacheControl: number;
    pagesCompressed: number;
    pagesWithETag: number;
    pagesWithHsts: number;
    cachingNote: string;
  };
}

export interface AuditReport {
  url: string;
  domain: string;
  title?: string;
  description?: string;
  overallScore: number;
  seoScore: number;
  geoScore: number;
  technicalScore?: number;
  performanceScore?: number;
  accessibilityScore?: number;
  technicalAudit?: TechnicalAuditItem[];
  auditItems?: TechnicalAuditItem[];
  crawlAnalysis?: CrawlAnalysis;
  geo?: GeoAnalysis | null;
  research?: ResearchAnalysis | null;
  schema?: SchemaAuditResult | null;
  actionPlan?: ActionItem[];
  coreWebVitals?: CoreWebVitals;
  summary?: {
    totalPages: number;
    avgLoadTime: number;
    issuesFound: number;
    criticalIssues: number;
  };
}
