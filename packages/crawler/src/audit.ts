import {
  SiteCrawler,
  type CrawlAnalysis,
  type CrawlPage,
  type SiteCrawlerOptions,
} from "./crawler.js";

export type AuditCategory =
  | "technical"
  | "seo"
  | "content"
  | "structured-data"
  | "performance"
  | "accessibility"
  | "security";

export type AuditSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AuditStatus = "fail" | "warning" | "pass";
export type AuditEffort = "low" | "medium" | "high";

export interface AuditFix {
  summary: string;
  steps: string[];
}

export interface AuditIssue {
  id: string;
  category: AuditCategory;
  severity: AuditSeverity;
  status: AuditStatus;
  title: string;
  summary: string;
  whyItMatters: string;
  affectedUrls: string[];
  evidence: string[];
  fix: AuditFix;
  effort: AuditEffort;
}

export interface AuditRecommendation {
  priority: number;
  issueId: string;
  title: string;
  severity: AuditSeverity;
  impact: "high" | "medium" | "low";
  effort: AuditEffort;
  whatToFix: string;
  howToFix: string[];
  affectedUrls: string[];
}

export interface SerializableCrawlAnalysis
  extends Omit<CrawlAnalysis, "internalLinkingGraph"> {
  internalLinkingGraph: Record<string, string[]>;
}

export interface AuditScores {
  overall: number;
  technical: number;
  seo: number;
  content: number;
  performance: number;
  accessibility: number;
  security: number;
}

export interface PageAuditResult {
  url: string;
  title: string;
  statusCode: number;
  issues: AuditIssue[];
}

export interface SiteAuditReport {
  auditedUrl: string;
  domain: string;
  generatedAt: string;
  scores: AuditScores;
  summary: {
    totalPagesCrawled: number;
    averageLoadTimeMs: number;
    totalIssues: number;
    criticalIssues: number;
    highPriorityIssues: number;
    issueCounts: Record<AuditSeverity, number>;
    topPriorities: AuditRecommendation[];
  };
  crawlAnalysis: SerializableCrawlAnalysis;
  pages: CrawlPage[];
  pageAudits: PageAuditResult[];
  issues: AuditIssue[];
  recommendations: AuditRecommendation[];
  notes: string[];
}

export interface SiteAuditOptions extends SiteCrawlerOptions {
  /** Limits individual URLs returned for each grouped issue. Defaults to 20. */
  maxAffectedUrls?: number;
}

const severityWeight: Record<AuditSeverity, number> = {
  critical: 20,
  high: 12,
  medium: 7,
  low: 3,
  info: 0,
};

const severityRank: Record<AuditSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const scoreKeyByCategory: Record<AuditCategory, keyof Omit<AuditScores, "overall">> = {
  technical: "technical",
  seo: "seo",
  content: "content",
  "structured-data": "seo",
  performance: "performance",
  accessibility: "accessibility",
  security: "security",
};

function normalizeInputUrl(input: string): string {
  const value = input.trim();
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function uniqueUrls(urls: string[], limit: number): string[] {
  return Array.from(new Set(urls)).slice(0, limit);
}

/**
 * Produces a JSON-safe report with raw crawl data, issue evidence, priority scores,
 * and concrete remediation steps for SEO, GEO, technical SEO, performance, and accessibility.
 */
export class SiteAuditEngine {
  private readonly maxAffectedUrls: number;

  constructor(options: Pick<SiteAuditOptions, "maxAffectedUrls"> = {}) {
    this.maxAffectedUrls = Math.max(1, options.maxAffectedUrls ?? 20);
  }

  async audit(inputUrl: string, options: SiteAuditOptions = {}): Promise<SiteAuditReport> {
    const auditedUrl = normalizeInputUrl(inputUrl);
    const crawler = new SiteCrawler(auditedUrl, options);
    const pages = await crawler.crawl();

    if (pages.length === 0) {
      throw new Error("No crawlable HTML pages were returned for this URL.");
    }

    const analysis = crawler.analyze();
    const issues = this.createIssues(pages, analysis);
    const scores = this.calculateScores(issues);
    const recommendations = this.createRecommendations(issues);
    const issueCounts: Record<AuditSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const issue of issues) issueCounts[issue.severity]++;

    return {
      auditedUrl,
      domain: new URL(auditedUrl).hostname,
      generatedAt: new Date().toISOString(),
      scores,
      summary: {
        totalPagesCrawled: pages.length,
        averageLoadTimeMs: Math.round(analysis.avgLoadTime),
        totalIssues: issues.length,
        criticalIssues: issueCounts.critical,
        highPriorityIssues: issueCounts.critical + issueCounts.high,
        issueCounts,
        topPriorities: recommendations.slice(0, 5),
      },
      crawlAnalysis: {
        ...analysis,
        internalLinkingGraph: Object.fromEntries(analysis.internalLinkingGraph.entries()),
      },
      pages,
      pageAudits: pages.map((page) => ({
        url: page.url,
        title: page.title,
        statusCode: page.statusCode,
        issues: issues.filter((issue) => issue.affectedUrls.includes(page.url)),
      })),
      issues,
      recommendations,
      notes: [
        "Performance values are crawl-based estimates, not Lighthouse or field Core Web Vitals.",
        "The report only assesses HTML available to the crawler. Client-rendered, private, or blocked content may need browser-based checks.",
      ],
    };
  }

  private createIssues(pages: CrawlPage[], analysis: CrawlAnalysis): AuditIssue[] {
    const issues: AuditIssue[] = [];
    const indexable = pages.filter((page) => page.statusCode < 400 && !page.hasNoindex);
    const homepage = pages.find((page) => new URL(page.url).pathname === "/") ?? pages[0];

    const add = (
      issue: Omit<AuditIssue, "affectedUrls"> & { affectedUrls?: string[] }
    ): void => {
      issues.push({
        ...issue,
        affectedUrls: uniqueUrls(issue.affectedUrls ?? [], this.maxAffectedUrls),
      });
    };

    const addPageIssue = (
      id: string,
      category: AuditCategory,
      severity: AuditSeverity,
      title: string,
      summary: string,
      whyItMatters: string,
      affectedPages: CrawlPage[],
      evidence: string,
      fix: AuditFix,
      effort: AuditEffort
    ): void => {
      if (!affectedPages.length) return;
      add({
        id,
        category,
        severity,
        status: severity === "critical" ? "fail" : "warning",
        title,
        summary,
        whyItMatters,
        affectedUrls: affectedPages.map((page) => page.url),
        evidence: [evidence],
        fix,
        effort,
      });
    };

    addPageIssue(
      "missing-title",
      "seo",
      "critical",
      "Pages are missing title tags",
      "Some indexable pages have no title tag in the returned HTML.",
      "Titles are a core relevance signal and commonly form the search result headline.",
      indexable.filter((page) => !page.title.trim()),
      `${indexable.filter((page) => !page.title.trim()).length} indexable pages have no title.`,
      {
        summary: "Add one unique, descriptive title tag to every indexable page.",
        steps: [
          "Lead with the page's main entity, product, service, category, or answer.",
          "Keep it unique and generally around 30–60 characters.",
          "Avoid repeating generic template titles across pages.",
        ],
      },
      "low"
    );

    addPageIssue(
      "short-title",
      "seo",
      "high",
      "Page titles are too short",
      "Very short titles often do not explain the page topic or value proposition.",
      "Clear, specific titles improve topic understanding for users, search engines, and AI answer systems.",
      indexable.filter((page) => page.title.length > 0 && page.title.length < 30),
      `${indexable.filter((page) => page.title.length > 0 && page.title.length < 30).length} pages have titles under 30 characters.`,
      {
        summary: "Rewrite short titles to state the main intent and differentiator.",
        steps: [
          "Name the primary topic first.",
          "Add a concise benefit, audience, location, or brand qualifier when useful.",
          "Check that no two important pages use the same title.",
        ],
      },
      "low"
    );

    addPageIssue(
      "missing-meta-description",
      "seo",
      "high",
      "Pages are missing meta descriptions",
      "The crawler could not find a useful meta description on these indexable pages.",
      "Descriptions help search systems summarize a page's purpose and improve snippet clarity.",
      indexable.filter((page) => !page.description.trim()),
      `${indexable.filter((page) => !page.description.trim()).length} indexable pages have no meta description.`,
      {
        summary: "Write a unique 120–160 character description for each priority page.",
        steps: [
          "State the page's offer, answer, or outcome in plain language.",
          "Mention the primary entity naturally once.",
          "Do not copy the title tag word-for-word.",
        ],
      },
      "low"
    );

    addPageIssue(
      "missing-h1",
      "content",
      "high",
      "Pages are missing an H1 heading",
      "The returned page HTML does not contain a primary visible topic heading.",
      "A clear H1 improves page hierarchy for visitors, assistive technology, and search crawlers.",
      indexable.filter((page) => page.h1.length === 0),
      `${indexable.filter((page) => page.h1.length === 0).length} indexable pages have no H1.`,
      {
        summary: "Add one visible H1 that clearly describes the page's main purpose.",
        steps: [
          "Use one primary H1 per page.",
          "Use H2 and H3 for supporting sections rather than more H1s.",
          "Make the H1 specific, not only a generic brand slogan.",
        ],
      },
      "low"
    );

    addPageIssue(
      "multiple-h1",
      "content",
      "medium",
      "Pages have multiple H1 headings",
      "More than one H1 can make the main page topic unclear.",
      "A single dominant topic makes content hierarchy easier to understand.",
      indexable.filter((page) => page.h1.length > 1),
      `${indexable.filter((page) => page.h1.length > 1).length} pages have more than one H1.`,
      {
        summary: "Keep one primary H1 and demote supporting headings to H2 or H3.",
        steps: [
          "Identify the heading that best represents the whole page.",
          "Change the semantic tag of other primary-looking headings while preserving their visual style with CSS.",
        ],
      },
      "low"
    );

    addPageIssue(
      "thin-content",
      "content",
      "medium",
      "Pages may have thin content",
      "Some pages expose fewer than 250 detected words of body content.",
      "Pages need enough useful, specific information to meet the searcher's intent and demonstrate expertise.",
      indexable.filter((page) => page.wordCount > 0 && page.wordCount < 250),
      `${indexable.filter((page) => page.wordCount > 0 && page.wordCount < 250).length} pages have fewer than 250 detected words.`,
      {
        summary: "Add original information that fully answers the page's specific question or need.",
        steps: [
          "Answer the main user question near the top of the page.",
          "Add specifications, examples, comparisons, proof, FAQs, or process details where relevant.",
          "Avoid filler written only to increase word count.",
        ],
      },
      "medium"
    );

    addPageIssue(
      "missing-canonical",
      "technical",
      "high",
      "Pages are missing canonical tags",
      "These pages do not declare a preferred URL version.",
      "Canonical tags help consolidate duplicate URL variants and signal the preferred indexable page.",
      indexable.filter((page) => !page.hasCanonical),
      `${indexable.filter((page) => !page.hasCanonical).length} indexable pages have no canonical tag.`,
      {
        summary: "Add a self-referencing canonical URL to every indexable page.",
        steps: [
          "Use the clean HTTPS URL without tracking parameters.",
          "Ensure the canonical page resolves successfully and remains indexable.",
          "Do not canonicalize unrelated pages to the homepage.",
        ],
      },
      "low"
    );

    if (analysis.canonicalIssues.length) {
      add({
        id: "invalid-canonical",
        category: "technical",
        severity: "high",
        status: "warning",
        title: "Canonical tags point outside the site",
        summary: "At least one canonical URL points to an external domain.",
        whyItMatters: "Incorrect canonicals can cause an important page to be excluded or attributed to another domain.",
        affectedUrls: analysis.canonicalIssues.map((item) => item.page),
        evidence: analysis.canonicalIssues.map((item) => `${item.page}: ${item.issue}`),
        fix: {
          summary: "Correct the canonical URL in the affected page or CMS template.",
          steps: [
            "Use a self-referencing canonical unless a genuine duplicate has a clear master page.",
            "Check CMS settings and hard-coded domain values after migrations or redesigns.",
          ],
        },
        effort: "low",
      });
    }

    if (analysis.brokenLinks.length) {
      add({
        id: "broken-pages-or-links",
        category: "technical",
        severity: "critical",
        status: "fail",
        title: "Broken pages or crawl failures detected",
        summary: "Some discovered URLs returned an error status or could not be fetched.",
        whyItMatters: "Broken URLs waste crawl resources, interrupt user journeys, and may lose backlinks or conversion paths.",
        affectedUrls: analysis.brokenLinks,
        evidence: [`${analysis.brokenLinks.length} URLs were identified as broken or failed during crawling.`],
        fix: {
          summary: "Repair the destination, permanently redirect obsolete pages, or remove the link.",
          steps: [
            "Use a 301 redirect when an old URL has a relevant replacement.",
            "For intentionally removed content without a replacement, return 404 or 410 and remove internal links.",
            "Update navigation and the XML sitemap after changes.",
          ],
        },
        effort: "medium",
      });
    }

    if (!analysis.robots.found) {
      add({
        id: "missing-robots-txt",
        category: "technical",
        severity: "medium",
        status: "warning",
        title: "robots.txt was not found",
        summary: "The crawler could not retrieve robots.txt from the site root.",
        whyItMatters: "robots.txt is the standard place to give crawl instructions and reference the sitemap.",
        evidence: ["No successful response was received from /robots.txt."],
        fix: {
          summary: "Publish a valid robots.txt file at the domain root.",
          steps: [
            "Allow crawling of public, indexable content.",
            "Disallow only pages that are private, duplicate, or non-search.",
            "Add a Sitemap directive using the canonical sitemap URL.",
          ],
        },
        effort: "low",
      });
    } else if (analysis.robots.disallowsAll) {
      add({
        id: "robots-blocks-all",
        category: "technical",
        severity: "critical",
        status: "fail",
        title: "robots.txt appears to block all crawlers",
        summary: "A global Disallow rule can prevent search engines from crawling public pages.",
        whyItMatters: "Pages that cannot be crawled cannot be reliably discovered or indexed.",
        evidence: ["A global Disallow: / rule was detected for a broad user agent."],
        fix: {
          summary: "Remove the blanket block for pages that should be publicly discoverable.",
          steps: [
            "Keep only targeted rules for private, duplicate, or utility paths.",
            "Validate the updated file using Google Search Console's robots.txt report.",
          ],
        },
        effort: "low",
      });
    }

    if (!analysis.sitemap.found) {
      add({
        id: "missing-sitemap",
        category: "technical",
        severity: "high",
        status: "warning",
        title: "XML sitemap was not found",
        summary: "No sitemap was discovered through robots.txt or common sitemap locations.",
        whyItMatters: "Sitemaps help search engines discover important canonical URLs, especially on large or new sites.",
        evidence: ["No crawlable sitemap.xml or sitemap index was detected."],
        fix: {
          summary: "Generate an XML sitemap that includes only canonical, indexable URLs.",
          steps: [
            "Publish it at a stable HTTPS URL such as /sitemap.xml.",
            "Reference it from robots.txt.",
            "Submit it through Google Search Console and keep it updated when pages change.",
          ],
        },
        effort: "low",
      });
    }

    if (analysis.orphanPages.length) {
      add({
        id: "orphan-pages",
        category: "technical",
        severity: "medium",
        status: "warning",
        title: "Potential orphan pages detected",
        summary: "Some crawled pages received no internal links in the observed crawl graph.",
        whyItMatters: "Important pages should have contextual or navigational links so people and crawlers can find them.",
        affectedUrls: analysis.orphanPages,
        evidence: [`${analysis.orphanPages.length} crawled pages had no observed inbound internal link.`],
        fix: {
          summary: "Add relevant internal links from hub, category, service, or related-content pages.",
          steps: [
            "Use descriptive anchor text that explains the destination topic.",
            "Prioritize pages with commercial or strategic value.",
            "Ensure important pages remain in the XML sitemap.",
          ],
        },
        effort: "medium",
      });
    }

    if (analysis.duplicateContentRisks.length) {
      add({
        id: "duplicate-metadata",
        category: "seo",
        severity: "medium",
        status: "warning",
        title: "Duplicate title or description risks detected",
        summary: "At least two pages share title or meta-description text.",
        whyItMatters: "Duplicate metadata makes it harder for search systems to understand which page should rank for a topic.",
        affectedUrls: analysis.duplicateContentRisks.flatMap((risk) => [risk.page1, risk.page2]),
        evidence: analysis.duplicateContentRisks.map(
          (risk) => `${risk.page1} and ${risk.page2} have ${risk.similarity}% metadata similarity.`
        ),
        fix: {
          summary: "Write unique metadata that reflects each page's distinct purpose.",
          steps: [
            "Prioritize product, category, service, location, and editorial pages.",
            "Use canonicalization only for genuine duplicate pages, not as a substitute for unique content.",
          ],
        },
        effort: "medium",
      });
    }

    addPageIssue(
      "missing-structured-data",
      "structured-data",
      "medium",
      "Pages are missing JSON-LD structured data",
      "No application/ld+json structured data was detected on these pages.",
      "Structured data can clarify page entities, types, and relationships for search engines and AI systems.",
      indexable.filter((page) => page.structuredData.length === 0),
      `${indexable.filter((page) => page.structuredData.length === 0).length} indexable pages have no detected JSON-LD.`,
      {
        summary: "Add schema that accurately represents the visible content and page type.",
        steps: [
          "Use Organization and WebSite where relevant on the homepage.",
          "Use Product, Article, Service, FAQPage, BreadcrumbList, or LocalBusiness only when the page content supports it.",
          "Validate the markup and ensure it matches visible content.",
        ],
      },
      "medium"
    );

    addPageIssue(
      "missing-open-graph",
      "seo",
      "low",
      "Open Graph metadata is missing",
      "Some pages have no detected Open Graph sharing metadata.",
      "Good social previews improve click-through and reinforce page context when links are shared.",
      indexable.filter((page) => !page.hasOpenGraph),
      `${indexable.filter((page) => !page.hasOpenGraph).length} pages have no Open Graph tags.`,
      {
        summary: "Add og:title, og:description, og:url, og:type, and og:image tags.",
        steps: [
          "Use the canonical URL for og:url.",
          "Provide an appropriate landscape sharing image.",
          "Render these tags in the initial server HTML.",
        ],
      },
      "low"
    );

    addPageIssue(
      "missing-viewport",
      "accessibility",
      "critical",
      "Pages are missing the viewport meta tag",
      "Mobile browsers may not render these pages at the intended responsive scale.",
      "Responsive behavior is essential for mobile usability and accessibility.",
      pages.filter((page) => !page.hasViewportMeta),
      `${pages.filter((page) => !page.hasViewportMeta).length} pages have no meta[name=viewport].`,
      {
        summary: "Add the standard viewport declaration in the document head.",
        steps: [
          "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
          "Do not disable browser zoom for users who need it.",
        ],
      },
      "low"
    );

    const missingAltPages = pages.filter((page) => page.imagesWithoutAlt > 0);
    addPageIssue(
      "missing-image-alt",
      "accessibility",
      "medium",
      "Meaningful images are missing alt text",
      "Some images have an empty or absent alt attribute.",
      "Alt text supports screen-reader users and gives crawlers contextual image information.",
      missingAltPages,
      `${missingAltPages.reduce((total, page) => total + page.imagesWithoutAlt, 0)} images without alt text across ${missingAltPages.length} pages.`,
      {
        summary: "Add concise alt text to informative images and keep decorative images empty.",
        steps: [
          "Describe the image's purpose in the page context.",
          "Use alt=\"\" only for decorative visuals.",
          "Do not stuff keywords into alt attributes.",
        ],
      },
      "medium"
    );

    addPageIssue(
      "render-blocking-scripts",
      "performance",
      "high",
      "Render-blocking scripts were found in the document head",
      "Some scripts load before the page can render and may delay interactivity.",
      "Blocking JavaScript can increase initial rendering time and hurt responsiveness.",
      pages.filter((page) => page.blockingScriptCount > 0),
      `${pages.filter((page) => page.blockingScriptCount > 0).length} pages include non-deferred head scripts.`,
      {
        summary: "Defer or asynchronously load JavaScript that is not needed for first paint.",
        steps: [
          "Keep only truly critical scripts in the head.",
          "Use defer for ordered scripts and async for independent third-party scripts where safe.",
          "Audit analytics, chat, heatmap, and advertising tags for necessity.",
        ],
      },
      "medium"
    );

    if (analysis.avgLoadTime > 3000) {
      add({
        id: "slow-response",
        category: "performance",
        severity: "high",
        status: "warning",
        title: "Average crawl response time is slow",
        summary: "The observed average response time exceeded three seconds.",
        whyItMatters: "Slow responses delay delivery, lower engagement, and reduce crawl efficiency.",
        evidence: [`Average crawl load time: ${Math.round(analysis.avgLoadTime)}ms.`],
        fix: {
          summary: "Investigate backend response time, CDN caching, image weight, and JavaScript delivery.",
          steps: [
            "Measure priority URLs with Lighthouse and real-user monitoring.",
            "Cache public HTML and static assets at the CDN where suitable.",
            "Optimize images and reduce unused JavaScript.",
          ],
        },
        effort: "high",
      });
    }

    if (analysis.performance.rating !== "good") {
      add({
        id: "estimated-core-web-vitals",
        category: "performance",
        severity: analysis.performance.rating === "poor" ? "high" : "medium",
        status: "warning",
        title: `Estimated performance needs improvement (${analysis.performance.rating})`,
        summary: "Crawl-derived signals indicate likely performance opportunities.",
        whyItMatters: "Speed and responsiveness affect user experience and can influence search visibility over time.",
        evidence: [
          `Estimated LCP: ${analysis.performance.estLCP}s.`,
          `Estimated CLS: ${analysis.performance.estCLS}.`,
          `Estimated INP: ${analysis.performance.estINP}ms.`,
        ],
        fix: {
          summary: "Use this as a prioritization signal, then verify it with Lighthouse and field data.",
          steps: [
            "Optimize the largest above-the-fold image and preload only critical assets.",
            "Set image dimensions or aspect-ratio to reduce layout shifts.",
            "Split or delay non-critical JavaScript and third-party tags.",
          ],
        },
        effort: "high",
      });
    }

    addPageIssue(
      "ineffective-cache-headers",
      "performance",
      "medium",
      "Some pages lack effective cache headers",
      "The crawler did not observe a usable Cache-Control policy on these responses.",
      "Caching can reduce repeat-visit latency and reduce server work.",
      pages.filter((page) => !page.hasCacheControl),
      `${analysis.performance.pagesWithCacheControl}/${pages.length} pages showed effective Cache-Control headers.`,
      {
        summary: "Configure suitable Cache-Control policies for public HTML and fingerprinted assets.",
        steps: [
          "Use long immutable caching for hashed CSS, JavaScript, and images.",
          "Use CDN caching for public HTML where your publishing process supports it.",
          "Do not publicly cache personalized or sensitive responses.",
        ],
      },
      "medium"
    );

    addPageIssue(
      "missing-compression",
      "performance",
      "medium",
      "Some responses were not compressed",
      "The crawler did not observe gzip, Brotli, deflate, or zstd encoding for these pages.",
      "Text compression can reduce HTML, CSS, and JavaScript transfer size.",
      pages.filter((page) => !page.isCompressed),
      `${analysis.performance.pagesCompressed}/${pages.length} pages were served with observed compression.`,
      {
        summary: "Enable Brotli or gzip for compressible text responses at the server or CDN.",
        steps: [
          "Confirm text/html, text/css, and JavaScript are compressed.",
          "Do not recompress already compressed binary formats such as modern images or video.",
        ],
      },
      "low"
    );

    if (!homepage.hasHsts) {
      add({
        id: "missing-hsts",
        category: "security",
        severity: "low",
        status: "warning",
        title: "HSTS header was not observed on the homepage",
        summary: "The homepage response did not include Strict-Transport-Security.",
        whyItMatters: "HSTS helps browsers consistently use HTTPS after a secure first visit.",
        affectedUrls: [homepage.url],
        evidence: ["Strict-Transport-Security was absent from the observed response."],
        fix: {
          summary: "Enable HSTS only after confirming HTTPS works across all intended subdomains.",
          steps: [
            "Redirect all HTTP URLs to HTTPS first.",
            "Start with a conservative max-age and test thoroughly.",
            "Use includeSubDomains only when every included subdomain is HTTPS-ready.",
          ],
        },
        effort: "low",
      });
    }

    const noindexPages = pages.filter((page) => page.hasNoindex);
    if (noindexPages.length) {
      add({
        id: "noindex-pages",
        category: "technical",
        severity: "medium",
        status: "warning",
        title: "Noindex directives were found",
        summary: "Some crawled pages request that search engines do not index them.",
        whyItMatters: "Noindex is appropriate for private or duplicate pages, but it removes eligible pages from search results.",
        affectedUrls: noindexPages.map((page) => page.url),
        evidence: [`${noindexPages.length} crawled pages include a noindex directive.`],
        fix: {
          summary: "Review each noindex page and keep it only when exclusion is intentional.",
          steps: [
            "Remove noindex from pages that should rank.",
            "Do not use robots.txt as the only mechanism for deindexing pages.",
          ],
        },
        effort: "low",
      });
    }

    return issues;
  }

  private calculateScores(issues: AuditIssue[]): AuditScores {
    const scores: AuditScores = {
      overall: 100,
      technical: 100,
      seo: 100,
      content: 100,
      performance: 100,
      accessibility: 100,
      security: 100,
    };

    for (const issue of issues) {
      const key = scoreKeyByCategory[issue.category];
      scores[key] = Math.max(0, scores[key] - severityWeight[issue.severity]);
    }

    scores.overall = Math.round(
      scores.technical * 0.25 +
        scores.seo * 0.2 +
        scores.content * 0.2 +
        scores.performance * 0.2 +
        scores.accessibility * 0.1 +
        scores.security * 0.05
    );

    return scores;
  }

  private createRecommendations(issues: AuditIssue[]): AuditRecommendation[] {
    return [...issues]
      .sort((first, second) => {
        const severityDifference = severityRank[first.severity] - severityRank[second.severity];
        return severityDifference || first.effort.localeCompare(second.effort);
      })
      .map((issue, index) => ({
        priority: index + 1,
        issueId: issue.id,
        title: issue.title,
        severity: issue.severity,
        impact:
          issue.severity === "critical" || issue.severity === "high"
            ? "high"
            : issue.severity === "medium"
              ? "medium"
              : "low",
        effort: issue.effort,
        whatToFix: issue.fix.summary,
        howToFix: issue.fix.steps,
        affectedUrls: issue.affectedUrls,
      }));
  }
}

/** Convenience function for one-off audits. */
export async function auditWebsite(
  url: string,
  options: SiteAuditOptions = {}
): Promise<SiteAuditReport> {
  return new SiteAuditEngine(options).audit(url, options);
}
