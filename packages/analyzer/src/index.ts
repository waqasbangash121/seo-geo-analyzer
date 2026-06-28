import * as cheerio from "cheerio";

export type AuditStatus = "pass" | "warning" | "fail";
export type AuditImpact = "critical" | "high" | "medium" | "low";

export interface AnalyzerOptions {
  /** Maximum number of same-origin pages to crawl. Defaults to 25. */
  maxPages?: number;
  /** Fetch timeout in milliseconds. Defaults to 15000. */
  timeoutMs?: number;
  /** User agent used by the crawler. */
  userAgent?: string;
}

export interface AnalyzeWebsiteOptions extends AnalyzerOptions {
  url: string;
}

export interface CrawlPage {
  url: string;
  statusCode: number;
  title: string;
  description: string;
  h1: string[];
  h2: string[];
  canonical: string | null;
  robots: string | null;
  links: string[];
  internalLinks: string[];
  externalLinks: string[];
  images: number;
  imagesWithoutAlt: number;
  structuredData: string[];
  wordCount: number;
  bodyText: string;
  loadTimeMs: number;
  contentType: string;
}

export interface CrawlAnalysis {
  totalPages: number;
  avgLoadTime: number;
  crawlDepth: number;
  brokenLinks: string[];
  canonicalIssues: string[];
  noindexPages: string[];
  performance: {
    avgPageSizeKb: number;
    estLCP: number;
    estCLS: number;
    estINP: number;
    rating: "good" | "needs-improvement" | "poor";
    totalImagesWithoutAlt: number;
    pagesMissingViewport: number;
    pagesWithBlockingScripts: number;
  };
  robots: {
    found: boolean;
    disallowsAll: boolean;
    hasSitemapDirective: boolean;
  };
  sitemap: {
    found: boolean;
    urlCount: number;
  };
}

export interface TechnicalAuditItem {
  id: string;
  category: "technical" | "content" | "performance" | "accessibility" | "schema";
  title: string;
  description: string;
  status: AuditStatus;
  impact: AuditImpact;
  recommendation: string;
  value?: string;
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
  priority: AuditImpact;
  effort: "low" | "medium" | "high";
  expectedImpact: string;
  details: string;
}

export interface EnhancedAuditResult {
  url: string;
  domain: string;
  crawlAnalysis: CrawlAnalysis;
  technicalAudit: TechnicalAuditItem[];
  schema: SchemaAuditResult;
  actionPlan: ActionItem[];
  overallScore: number;
  seoScore: number;
  technicalScore: number;
  performanceScore: number;
  accessibilityScore: number;
  summary: {
    totalPages: number;
    avgLoadTime: number;
    issuesFound: number;
    criticalIssues: number;
  };
}

const DEFAULT_USER_AGENT =
  "SEOGeoAnalyzer/0.1 (+https://github.com/waqasbangash121/seo-geo-analyzer)";

function normalizeUrl(input: string): URL {
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  return new URL(withProtocol);
}

function sameOrigin(a: string, origin: string): boolean {
  try {
    return new URL(a).origin === origin;
  } catch {
    return false;
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function scoreFromIssues(items: TechnicalAuditItem[], categories: TechnicalAuditItem["category"][]): number {
  const relevant = items.filter((item) => categories.includes(item.category));
  let score = 100;

  for (const item of relevant) {
    if (item.status === "pass") continue;
    if (item.impact === "critical") score -= 18;
    else if (item.impact === "high") score -= 12;
    else if (item.impact === "medium") score -= 7;
    else score -= 3;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

async function fetchText(url: string, options: Required<AnalyzerOptions>): Promise<{
  ok: boolean;
  status: number;
  text: string;
  contentType: string;
  loadTimeMs: number;
}> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": options.userAgent,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      text,
      contentType,
      loadTimeMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractSchemaTypes(pages: CrawlPage[]): string[] {
  const types = new Set<string>();

  for (const page of pages) {
    for (const raw of page.structuredData) {
      try {
        const parsed = JSON.parse(raw);
        const type = parsed?.["@type"];
        if (typeof type === "string") types.add(type);
        if (Array.isArray(type)) type.forEach((value) => types.add(String(value)));
      } catch {
        // Ignore invalid JSON-LD.
      }
    }
  }

  return [...types].sort();
}

export class SiteCrawler {
  private readonly root: URL;
  private readonly options: Required<AnalyzerOptions>;
  public readonly pages: CrawlPage[] = [];
  public robotsText = "";
  public sitemapXml = "";

  constructor(url: string, options: AnalyzerOptions = {}) {
    this.root = normalizeUrl(url);
    this.options = {
      maxPages: options.maxPages ?? 25,
      timeoutMs: options.timeoutMs ?? 15_000,
      userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
    };
  }

  async fetchSiteFiles(): Promise<void> {
    const robotsUrl = new URL("/robots.txt", this.root.origin).toString();
    const sitemapUrl = new URL("/sitemap.xml", this.root.origin).toString();

    const [robots, sitemap] = await Promise.allSettled([
      fetchText(robotsUrl, this.options),
      fetchText(sitemapUrl, this.options),
    ]);

    if (robots.status === "fulfilled" && robots.value.ok) this.robotsText = robots.value.text;
    if (sitemap.status === "fulfilled" && sitemap.value.ok) this.sitemapXml = sitemap.value.text;
  }

  async crawl(): Promise<CrawlPage[]> {
    const queue = [this.root.toString()];
    const visited = new Set<string>();

    while (queue.length > 0 && this.pages.length < this.options.maxPages) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      try {
        const response = await fetchText(current, this.options);
        if (!response.contentType.includes("html")) continue;

        const page = this.parsePage(current, response);
        this.pages.push(page);

        for (const href of page.internalLinks) {
          if (!visited.has(href) && queue.length + this.pages.length < this.options.maxPages) {
            queue.push(href);
          }
        }
      } catch {
        this.pages.push({
          url: current,
          statusCode: 0,
          title: "",
          description: "",
          h1: [],
          h2: [],
          canonical: null,
          robots: null,
          links: [],
          internalLinks: [],
          externalLinks: [],
          images: 0,
          imagesWithoutAlt: 0,
          structuredData: [],
          wordCount: 0,
          bodyText: "",
          loadTimeMs: 0,
          contentType: "",
        });
      }
    }

    return this.pages;
  }

  analyze(): CrawlAnalysis {
    const totalPages = this.pages.length;
    const avgLoadTime = totalPages
      ? this.pages.reduce((sum, page) => sum + page.loadTimeMs, 0) / totalPages
      : 0;
    const totalImagesWithoutAlt = this.pages.reduce((sum, page) => sum + page.imagesWithoutAlt, 0);
    const pagesMissingViewport = this.pages.filter((page) => !page.bodyText && page.statusCode === 0).length;
    const brokenLinks = this.pages.filter((page) => page.statusCode >= 400 || page.statusCode === 0).map((page) => page.url);
    const canonicalIssues = this.pages
      .filter((page) => page.canonical && !sameOrigin(page.canonical, this.root.origin))
      .map((page) => page.url);
    const noindexPages = this.pages
      .filter((page) => page.robots?.toLowerCase().includes("noindex"))
      .map((page) => page.url);
    const avgPageSizeKb = Math.round(
      this.pages.reduce((sum, page) => sum + page.bodyText.length, 0) / Math.max(1, totalPages) / 1024
    );
    const estLCP = Math.max(1200, Math.round(avgLoadTime + avgPageSizeKb * 8));
    const rating = estLCP < 2500 ? "good" : estLCP < 4000 ? "needs-improvement" : "poor";

    return {
      totalPages,
      avgLoadTime,
      crawlDepth: Math.min(4, Math.max(1, ...this.pages.map((page) => new URL(page.url).pathname.split("/").filter(Boolean).length + 1))),
      brokenLinks,
      canonicalIssues,
      noindexPages,
      performance: {
        avgPageSizeKb,
        estLCP,
        estCLS: 0.1,
        estINP: Math.max(100, Math.round(avgLoadTime / 5)),
        rating,
        totalImagesWithoutAlt,
        pagesMissingViewport,
        pagesWithBlockingScripts: 0,
      },
      robots: {
        found: this.robotsText.length > 0,
        disallowsAll: /user-agent:\s*\*[^]*disallow:\s*\/\s*$/im.test(this.robotsText),
        hasSitemapDirective: /^sitemap:/im.test(this.robotsText),
      },
      sitemap: {
        found: this.sitemapXml.length > 0,
        urlCount: (this.sitemapXml.match(/<loc>/g) ?? []).length,
      },
    };
  }

  private parsePage(url: string, response: Awaited<ReturnType<typeof fetchText>>): CrawlPage {
    const $ = cheerio.load(response.text);
    const title = ($("title").first().text() || "").trim();
    const description = ($('meta[name="description"]').attr("content") || "").trim();
    const canonicalRaw = $('link[rel="canonical"]').attr("href") || null;
    const canonical = canonicalRaw ? new URL(canonicalRaw, url).toString() : null;
    const robots = $('meta[name="robots"]').attr("content") || null;
    const h1 = $("h1").map((_, el) => $(el).text().trim()).get().filter(Boolean);
    const h2 = $("h2").map((_, el) => $(el).text().trim()).get().filter(Boolean);
    const structuredData = $('script[type="application/ld+json"]')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);
    const rawLinks = $("a[href]")
      .map((_, el) => $(el).attr("href") || "")
      .get()
      .filter((href) => href && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:"));
    const links = unique(
      rawLinks
        .map((href) => {
          try {
            const normalized = new URL(href, url);
            normalized.hash = "";
            return normalized.toString();
          } catch {
            return "";
          }
        })
        .filter(Boolean)
    );
    const internalLinks = links.filter((href) => sameOrigin(href, this.root.origin));
    const externalLinks = links.filter((href) => !sameOrigin(href, this.root.origin));
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    const images = $("img").length;
    const imagesWithoutAlt = $("img").filter((_, el) => !($(el).attr("alt") || "").trim()).length;

    return {
      url,
      statusCode: response.status,
      title,
      description,
      h1,
      h2,
      canonical,
      robots,
      links,
      internalLinks,
      externalLinks,
      images,
      imagesWithoutAlt,
      structuredData,
      wordCount: bodyText ? bodyText.split(/\s+/).length : 0,
      bodyText,
      loadTimeMs: response.loadTimeMs,
      contentType: response.contentType,
    };
  }
}

export class SchemaAuditEngine {
  analyze(url: string, pages: CrawlPage[]): SchemaAuditResult {
    const detectedTypes = extractSchemaTypes(pages);
    const totalPages = pages.length;
    const pagesWithSchema = pages.filter((page) => page.structuredData.length > 0).length;
    const missingTypes = ["Organization", "WebSite", "WebPage", "FAQPage"].filter(
      (type) => !detectedTypes.includes(type)
    );
    const origin = normalizeUrl(url).origin;

    return {
      detectedTypes,
      missingTypes,
      pagesWithSchema,
      totalPages,
      coveragePercent: totalPages ? Math.round((pagesWithSchema / totalPages) * 100) : 0,
      recommendations: missingTypes.slice(0, 3).map((type) => ({
        type,
        priority: type === "Organization" || type === "WebSite" ? "high" : "medium",
        reason: `${type} schema can strengthen entity understanding for search engines and AI systems.`,
        jsonLd: JSON.stringify(
          {
            "@context": "https://schema.org",
            "@type": type,
            url: origin,
            name: normalizeUrl(url).hostname.replace(/^www\./, ""),
          },
          null,
          2
        ),
      })),
    };
  }
}

export function buildActionPlan(input: {
  technicalAudit: TechnicalAuditItem[];
  schema: SchemaAuditResult;
}): ActionItem[] {
  const items: ActionItem[] = [];

  for (const issue of input.technicalAudit.filter((item) => item.status !== "pass")) {
    items.push({
      title: issue.title,
      category:
        issue.category === "performance"
          ? "Performance"
          : issue.category === "schema"
            ? "Schema"
            : issue.category === "content"
              ? "Content"
              : "Technical SEO",
      priority: issue.impact,
      effort: issue.impact === "critical" ? "medium" : "low",
      expectedImpact: issue.impact === "critical" ? "Removes a major SEO blocker" : "Improves crawlability, relevance, or UX quality",
      details: `${issue.description} ${issue.recommendation}`,
    });
  }

  for (const schema of input.schema.recommendations) {
    items.push({
      title: `Add ${schema.type} structured data`,
      category: "Schema",
      priority: schema.priority,
      effort: "low",
      expectedImpact: "Improves machine-readable entity and page understanding",
      details: schema.reason,
    });
  }

  return items.sort((a, b) => {
    const weights: Record<AuditImpact, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return weights[a.priority] - weights[b.priority];
  });
}

export class EnhancedAuditEngine {
  constructor(private readonly options: AnalyzerOptions = {}) {}

  async performAudit(url: string): Promise<EnhancedAuditResult> {
    const normalized = normalizeUrl(url).toString();
    const crawler = new SiteCrawler(normalized, this.options);
    await crawler.fetchSiteFiles();
    const pages = await crawler.crawl();
    const crawlAnalysis = crawler.analyze();
    const technicalAudit = this.generateTechnicalAudit(pages, crawlAnalysis);
    const schema = new SchemaAuditEngine().analyze(normalized, pages);
    const actionPlan = buildActionPlan({ technicalAudit, schema });
    const scores = this.calculateScores(technicalAudit);

    return {
      url: normalized,
      domain: normalizeUrl(normalized).hostname,
      crawlAnalysis,
      technicalAudit,
      schema,
      actionPlan,
      overallScore: scores.overall,
      seoScore: scores.seo,
      technicalScore: scores.technical,
      performanceScore: scores.performance,
      accessibilityScore: scores.accessibility,
      summary: {
        totalPages: crawlAnalysis.totalPages,
        avgLoadTime: Math.round(crawlAnalysis.avgLoadTime),
        issuesFound: technicalAudit.length,
        criticalIssues: technicalAudit.filter((item) => item.impact === "critical" && item.status !== "pass").length,
      },
    };
  }

  private generateTechnicalAudit(pages: CrawlPage[], analysis: CrawlAnalysis): TechnicalAuditItem[] {
    const items: TechnicalAuditItem[] = [];
    const homepage = pages[0];

    if (!homepage) {
      return [
        {
          id: "crawl-failed",
          category: "technical",
          title: "Website could not be crawled",
          description: "The analyzer could not fetch any HTML pages from the supplied URL.",
          status: "fail",
          impact: "critical",
          recommendation: "Confirm the URL is reachable, public, and serving HTML.",
        },
      ];
    }

    if (!homepage.title || homepage.title.length < 30) {
      items.push({
        id: "title-length",
        category: "content",
        title: "Homepage title is missing or too short",
        description: "The homepage title should usually be descriptive and around 30-60 characters.",
        status: "warning",
        impact: "high",
        recommendation: "Write a clear title that includes the brand and primary search intent.",
        value: `${homepage.title.length} characters`,
      });
    }

    if (!homepage.description || homepage.description.length < 90) {
      items.push({
        id: "meta-description",
        category: "content",
        title: "Meta description is missing or too short",
        description: "The homepage meta description is important for search snippets and AI summaries.",
        status: "warning",
        impact: "high",
        recommendation: "Add a concise, benefit-driven meta description around 120-160 characters.",
        value: `${homepage.description.length} characters`,
      });
    }

    if (homepage.h1.length === 0) {
      items.push({
        id: "missing-h1",
        category: "content",
        title: "Missing H1 tag",
        description: "The homepage does not contain a clear H1 heading.",
        status: "fail",
        impact: "critical",
        recommendation: "Add one descriptive H1 that explains the page purpose.",
      });
    } else if (homepage.h1.length > 1) {
      items.push({
        id: "multiple-h1",
        category: "content",
        title: "Multiple H1 tags found",
        description: "Multiple H1 tags can dilute page focus.",
        status: "warning",
        impact: "medium",
        recommendation: "Keep one primary H1 and convert secondary headings to H2/H3.",
        value: `${homepage.h1.length} H1 tags`,
      });
    }

    if (analysis.brokenLinks.length > 0) {
      items.push({
        id: "broken-links",
        category: "technical",
        title: "Broken pages or failed fetches found",
        description: "Some crawled URLs returned errors or could not be fetched.",
        status: "fail",
        impact: "critical",
        recommendation: "Fix broken internal URLs, redirects, and server errors.",
        value: `${analysis.brokenLinks.length} URLs`,
      });
    }

    if (analysis.performance.totalImagesWithoutAlt > 0) {
      items.push({
        id: "image-alt-text",
        category: "accessibility",
        title: "Images missing alt text",
        description: "Some images do not have alt text.",
        status: "warning",
        impact: "medium",
        recommendation: "Add descriptive alt text to meaningful images.",
        value: `${analysis.performance.totalImagesWithoutAlt} images`,
      });
    }

    if (!analysis.robots.found) {
      items.push({
        id: "robots-txt",
        category: "technical",
        title: "robots.txt not found",
        description: "No robots.txt file was found at the site root.",
        status: "warning",
        impact: "medium",
        recommendation: "Add robots.txt and include the XML sitemap location.",
      });
    }

    if (!analysis.sitemap.found) {
      items.push({
        id: "sitemap-xml",
        category: "technical",
        title: "XML sitemap not found",
        description: "No sitemap.xml file was found at the site root.",
        status: "warning",
        impact: "high",
        recommendation: "Generate and submit an XML sitemap.",
      });
    }

    if (analysis.performance.rating === "poor") {
      items.push({
        id: "performance-rating",
        category: "performance",
        title: "Estimated performance needs improvement",
        description: "The estimated loading experience appears slow based on HTML response timing and content size.",
        status: "warning",
        impact: "high",
        recommendation: "Optimize server response time, images, CSS, and JavaScript delivery.",
        value: `Estimated LCP ${analysis.performance.estLCP}ms`,
      });
    }

    if (homepage.structuredData.length === 0) {
      items.push({
        id: "missing-schema",
        category: "schema",
        title: "Structured data not found on homepage",
        description: "JSON-LD structured data helps search engines and AI systems understand entities and page purpose.",
        status: "warning",
        impact: "high",
        recommendation: "Add Organization, WebSite, WebPage, and relevant FAQ/Product/Service schema.",
      });
    }

    return items;
  }

  private calculateScores(items: TechnicalAuditItem[]) {
    const technical = scoreFromIssues(items, ["technical", "schema"]);
    const seo = scoreFromIssues(items, ["content", "technical", "schema"]);
    const performance = scoreFromIssues(items, ["performance"]);
    const accessibility = scoreFromIssues(items, ["accessibility"]);
    const overall = Math.round((technical + seo + performance + accessibility) / 4);

    return { technical, seo, performance, accessibility, overall };
  }
}

export async function analyzeWebsite(options: AnalyzeWebsiteOptions): Promise<EnhancedAuditResult> {
  const engine = new EnhancedAuditEngine(options);
  return engine.performAudit(options.url);
}

export async function analyze(options: AnalyzeWebsiteOptions): Promise<EnhancedAuditResult> {
  return analyzeWebsite(options);
}
