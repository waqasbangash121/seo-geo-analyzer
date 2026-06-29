import {
  SiteAuditEngine,
  type AuditIssue,
  type AuditSeverity,
  type SiteAuditReport,
} from "@waqashanifkhan/crawler";
import type { CrawlAnalysis, CrawlPage } from "./crawl";

export interface TechnicalAuditItem {
  id: string;
  category: "technical" | "content" | "performance" | "accessibility";
  title: string;
  description: string;
  status: "pass" | "warning" | "fail";
  impact: "critical" | "high" | "medium" | "low";
  recommendation: string;
  value?: string;
}

export interface EnhancedAuditResult {
  url: string;
  domain: string;
  title: string;
  description: string;
  crawlAnalysis: CrawlAnalysis;
  technicalAudit: TechnicalAuditItem[];
  auditItems: TechnicalAuditItem[];
  overallScore: number;
  seoScore: number;
  technicalScore: number;
  performanceScore: number;
  accessibilityScore: number;
  coreWebVitals: {
    estLCP: number;
    estCLS: number;
    estINP: number;
    rating: "good" | "needs-improvement" | "poor";
    avgPageSizeKb: number;
    note: string;
  };
  summary: {
    totalPages: number;
    avgLoadTime: number;
    issuesFound: number;
    criticalIssues: number;
  };
  /** Full JSON-safe output from @waqashanifkhan/crawler. */
  crawlerAudit: SiteAuditReport;
}

function toImpact(severity: AuditSeverity): TechnicalAuditItem["impact"] {
  return severity === "info" ? "low" : severity;
}

function toCategory(issue: AuditIssue): TechnicalAuditItem["category"] {
  if (issue.category === "performance") return "performance";
  if (issue.category === "accessibility") return "accessibility";
  if (issue.category === "content" || issue.category === "seo") return "content";
  return "technical";
}

function toTechnicalItem(issue: AuditIssue): TechnicalAuditItem {
  return {
    id: issue.id,
    category: toCategory(issue),
    title: issue.title,
    description: issue.summary,
    status: issue.status,
    impact: toImpact(issue.severity),
    recommendation: [issue.fix.summary, ...issue.fix.steps].join(" "),
    value: issue.evidence.join(" "),
  };
}

function toCrawlAnalysis(report: SiteAuditReport): CrawlAnalysis {
  return {
    ...report.crawlAnalysis,
    internalLinkingGraph: new Map(
      Object.entries(report.crawlAnalysis.internalLinkingGraph)
    ),
  };
}

/**
 * Adapter between the crawler package's audit report and the dashboard's existing
 * GEO, research, schema, history, export, and action-plan pipeline.
 */
export class EnhancedAuditEngine {
  public lastCrawledPages: CrawlPage[] = [];

  async performAudit(url: string): Promise<EnhancedAuditResult> {
    const auditEngine = new SiteAuditEngine({ maxAffectedUrls: 25 });

    const crawlerAudit = await auditEngine.audit(url, {
      maxPages: 50,
      concurrency: 4,
      timeoutMs: 8_000,
      retries: 1,
      respectRobotsTxt: true,
      maxAffectedUrls: 25,
    });

    this.lastCrawledPages = crawlerAudit.pages;

    const crawlAnalysis = toCrawlAnalysis(crawlerAudit);
    const homepage =
      this.lastCrawledPages.find((page) => {
        const parsed = new URL(page.url);
        return parsed.pathname === "/";
      }) ?? this.lastCrawledPages[0];

    const technicalAudit = crawlerAudit.issues.map(toTechnicalItem);

    return {
      url: crawlerAudit.auditedUrl,
      domain: crawlerAudit.domain,
      title: homepage?.title ?? "",
      description: homepage?.description ?? "",
      crawlAnalysis,
      technicalAudit,
      auditItems: technicalAudit,
      overallScore: crawlerAudit.scores.overall,
      seoScore: crawlerAudit.scores.seo,
      technicalScore: crawlerAudit.scores.technical,
      performanceScore: crawlerAudit.scores.performance,
      accessibilityScore: crawlerAudit.scores.accessibility,
      coreWebVitals: {
        estLCP: crawlAnalysis.performance.estLCP,
        estCLS: crawlAnalysis.performance.estCLS,
        estINP: crawlAnalysis.performance.estINP,
        rating: crawlAnalysis.performance.rating,
        avgPageSizeKb: crawlAnalysis.performance.avgPageSizeKb,
        note: "Estimated from crawler signals. Verify with Lighthouse and real-user Core Web Vitals.",
      },
      summary: {
        totalPages: crawlerAudit.summary.totalPagesCrawled,
        avgLoadTime: crawlerAudit.summary.averageLoadTimeMs,
        issuesFound: crawlerAudit.summary.totalIssues,
        criticalIssues: crawlerAudit.summary.criticalIssues,
      },
      crawlerAudit,
    };
  }
}
