import { SiteCrawler, type CrawlAnalysis, type CrawlPage } from "@waqashanifkhan/crawler";

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
}

export class EnhancedAuditEngine {
  public lastCrawledPages: CrawlPage[] = [];

  async performAudit(url: string): Promise<EnhancedAuditResult> {
    const crawler = new SiteCrawler(url, {
      maxPages: 50,
      concurrency: 4,
      timeoutMs: 8_000,
      retries: 1,
    });

    await crawler.fetchSiteFiles();
    this.lastCrawledPages = await crawler.crawl();

    if (this.lastCrawledPages.length === 0) {
      throw new Error("Crawler did not return any pages");
    }

    const crawlAnalysis = crawler.analyze();
    const homepage = this.findHomepage(this.lastCrawledPages, url) ?? this.lastCrawledPages[0];
    const auditItems = this.generateTechnicalAudit(this.lastCrawledPages, crawlAnalysis, url);
    const scores = this.calculateScores(auditItems);

    return {
      url,
      domain: new URL(url).hostname,
      title: homepage?.title ?? "",
      description: homepage?.description ?? "",
      crawlAnalysis,
      technicalAudit: auditItems,
      auditItems,
      overallScore: scores.overall,
      seoScore: scores.seo,
      technicalScore: scores.technical,
      performanceScore: scores.performance,
      accessibilityScore: scores.accessibility,
      coreWebVitals: {
        estLCP: crawlAnalysis.performance.estLCP,
        estCLS: crawlAnalysis.performance.estCLS,
        estINP: crawlAnalysis.performance.estINP,
        rating: crawlAnalysis.performance.rating,
        avgPageSizeKb: crawlAnalysis.performance.avgPageSizeKb,
        note: "Estimated from crawl signals. Not a Lighthouse or field-data measurement.",
      },
      summary: {
        totalPages: crawlAnalysis.totalPages,
        avgLoadTime: Number.isFinite(crawlAnalysis.avgLoadTime)
          ? Math.round(crawlAnalysis.avgLoadTime)
          : 0,
        issuesFound: auditItems.filter((item) => item.status !== "pass").length,
        criticalIssues: auditItems.filter(
          (item) => item.status !== "pass" && item.impact === "critical"
        ).length,
      },
    };
  }

  private findHomepage(pages: CrawlPage[], inputUrl: string): CrawlPage | undefined {
    const origin = new URL(inputUrl).origin;
    return pages.find((page) => {
      const current = new URL(page.url);
      return current.origin === origin && current.pathname === "/";
    });
  }

  private generateTechnicalAudit(
    pages: CrawlPage[],
    analysis: CrawlAnalysis,
    inputUrl: string
  ): TechnicalAuditItem[] {
    const items: TechnicalAuditItem[] = [];
    const homepage = this.findHomepage(pages, inputUrl) ?? pages[0];

    if (!homepage.title || homepage.title.length < 30) {
      items.push({
        id: "title-length",
        category: "content",
        title: "Page Title Too Short",
        description: "Homepage title should usually be 30-60 characters for SEO clarity",
        status: "warning",
        impact: "high",
        recommendation: "Expand the page title with the main entity, product, service, or target query",
        value: `Current: ${homepage.title?.length ?? 0} characters`,
      });
    }

    if (!homepage.description || homepage.description.length < 120) {
      items.push({
        id: "meta-description",
        category: "content",
        title: "Meta Description Missing or Short",
        description: "Meta description should summarize the page clearly for search snippets and AI systems",
        status: "warning",
        impact: "high",
        recommendation: "Write a 120-160 character description with the main offer and differentiator",
        value: `Current: ${homepage.description?.length ?? 0} characters`,
      });
    }

    if (homepage.h1.length === 0) {
      items.push({
        id: "missing-h1",
        category: "content",
        title: "Missing H1 Tag",
        description: "Every important page should have one clear H1 heading",
        status: "fail",
        impact: "critical",
        recommendation: "Add one descriptive H1 that matches the page intent",
      });
    } else if (homepage.h1.length > 1) {
      items.push({
        id: "multiple-h1",
        category: "content",
        title: "Multiple H1 Tags",
        description: "Multiple H1 headings can weaken the page topic hierarchy",
        status: "warning",
        impact: "high",
        recommendation: "Keep one primary H1 and demote supporting headings to H2/H3",
        value: `Found: ${homepage.h1.length} H1 tags`,
      });
    }

    if (analysis.crawlDepth > 4) {
      items.push({
        id: "crawl-depth",
        category: "technical",
        title: "Deep Site Structure",
        description: "Some pages are nested more than 4 levels deep",
        status: "warning",
        impact: "medium",
        recommendation: "Improve internal navigation so important pages are reachable within fewer clicks",
        value: `Current depth: ${analysis.crawlDepth}`,
      });
    }

    if (analysis.orphanPages.length > 0) {
      items.push({
        id: "orphan-pages",
        category: "technical",
        title: "Orphan Pages Detected",
        description: "Some crawled pages are not linked from other crawled pages",
        status: "warning",
        impact: "medium",
        recommendation: "Add navigation, hub-page, or contextual internal links to orphan pages",
        value: `Found: ${analysis.orphanPages.length} orphan pages`,
      });
    }

    if (analysis.brokenLinks.length > 0) {
      items.push({
        id: "broken-links",
        category: "technical",
        title: "Broken Links Found",
        description: "Some crawled URLs failed or returned error status codes",
        status: "fail",
        impact: "critical",
        recommendation: "Fix, redirect, or remove broken URLs",
        value: `Found: ${analysis.brokenLinks.length} broken links`,
      });
    }

    if (analysis.canonicalIssues.length > 0) {
      items.push({
        id: "canonical-issues",
        category: "technical",
        title: "Canonical Tag Issues",
        description: "Some pages have missing or suspicious canonical tags",
        status: "warning",
        impact: "high",
        recommendation: "Add correct self-referencing canonicals to indexable pages",
        value: `Issues found: ${analysis.canonicalIssues.length}`,
      });
    }

    if (analysis.noindexPages.length > 0) {
      items.push({
        id: "noindex-pages",
        category: "technical",
        title: "Noindex Tags Found",
        description: "Some crawled pages are marked noindex",
        status: "warning",
        impact: "high",
        recommendation: "Review noindex tags and remove them from pages that should rank",
        value: `Pages: ${analysis.noindexPages.length}`,
      });
    }

    if (!analysis.robots.found) {
      items.push({
        id: "robots-txt",
        category: "technical",
        title: "robots.txt Not Found",
        description: "No robots.txt file was found at the site root",
        status: "warning",
        impact: "medium",
        recommendation: "Add robots.txt and include sitemap directives",
      });
    } else if (analysis.robots.disallowsAll) {
      items.push({
        id: "robots-disallow-all",
        category: "technical",
        title: "robots.txt Blocks All Crawlers",
        description: "robots.txt appears to include a global Disallow rule",
        status: "fail",
        impact: "critical",
        recommendation: "Remove blanket Disallow rules for pages that should be discoverable",
      });
    }

    if (analysis.robots.found && !analysis.robots.hasSitemapDirective) {
      items.push({
        id: "robots-no-sitemap",
        category: "technical",
        title: "No Sitemap Declared in robots.txt",
        description: "robots.txt does not reference a sitemap",
        status: "warning",
        impact: "low",
        recommendation: "Add a Sitemap directive to robots.txt",
      });
    }

    if (!analysis.sitemap.found) {
      items.push({
        id: "sitemap-xml",
        category: "technical",
        title: "sitemap.xml Not Found",
        description: "No XML sitemap was discovered",
        status: "warning",
        impact: "high",
        recommendation: "Generate and submit an XML sitemap",
      });
    } else {
      items.push({
        id: "sitemap-found",
        category: "technical",
        title: "XML Sitemap Found",
        description: "An XML sitemap is present and accessible",
        status: "pass",
        impact: "low",
        recommendation: "Keep the sitemap updated and submitted in Google Search Console",
        value: `${analysis.sitemap.urlCount} URLs listed`,
      });
    }

    const performance = analysis.performance;

    if (analysis.avgLoadTime > 3000) {
      items.push({
        id: "slow-load-time",
        category: "performance",
        title: "Slow Page Load Time",
        description: "Average page load time exceeds 3 seconds",
        status: "warning",
        impact: "high",
        recommendation: "Optimize server response time, images, caching, and JavaScript delivery",
        value: `Average: ${Math.round(analysis.avgLoadTime)}ms`,
      });
    }

    if (performance.rating !== "good") {
      items.push({
        id: "core-web-vitals",
        category: "performance",
        title: `Estimated Core Web Vitals: ${performance.rating === "poor" ? "Poor" : "Needs Improvement"}`,
        description: "Estimated LCP, CLS, and INP indicate room for improvement",
        status: performance.rating === "poor" ? "fail" : "warning",
        impact: performance.rating === "poor" ? "high" : "medium",
        recommendation: "Reduce HTML payload, defer non-critical JavaScript, and optimize image/layout stability",
        value: `LCP ~${performance.estLCP}s, CLS ~${performance.estCLS}, INP ~${performance.estINP}ms`,
      });
    }

    if (performance.pagesMissingViewport > 0) {
      items.push({
        id: "viewport-meta",
        category: "technical",
        title: "Missing Viewport Meta Tag",
        description: "Viewport meta is missing on some pages",
        status: "fail",
        impact: "critical",
        recommendation: "Add <meta name='viewport' content='width=device-width, initial-scale=1'> to every page",
        value: `${performance.pagesMissingViewport} pages affected`,
      });
    }

    if (performance.totalImagesWithoutAlt > 0) {
      items.push({
        id: "image-alt-text",
        category: "accessibility",
        title: "Images Missing Alt Text",
        description: "Some images do not include useful alt attributes",
        status: "warning",
        impact: "medium",
        recommendation: "Add descriptive alt text to meaningful images",
        value: `${performance.totalImagesWithoutAlt} images without alt`,
      });
    }

    if (performance.pagesWithBlockingScripts > 0) {
      items.push({
        id: "render-blocking-scripts",
        category: "performance",
        title: "Render-Blocking Scripts",
        description: "Some pages load blocking scripts in the head",
        status: "warning",
        impact: "high",
        recommendation: "Add async/defer to non-critical scripts or move them later in the document",
        value: `${performance.pagesWithBlockingScripts} pages affected`,
      });
    }

    if (performance.pagesWithCacheControl < analysis.totalPages) {
      items.push({
        id: "browser-caching",
        category: "performance",
        title: "Missing Browser Caching Headers",
        description: "Some pages do not send effective caching headers",
        status: performance.pagesWithCacheControl === 0 ? "fail" : "warning",
        impact: "medium",
        recommendation: "Use Cache-Control, ETag, or Last-Modified headers appropriately",
        value: `${performance.pagesWithCacheControl}/${analysis.totalPages} pages cacheable`,
      });
    }

    if (performance.pagesCompressed < analysis.totalPages) {
      items.push({
        id: "text-compression",
        category: "performance",
        title: "Text Compression Not Enabled",
        description: "Some pages are served without gzip/brotli compression",
        status: performance.pagesCompressed === 0 ? "fail" : "warning",
        impact: "medium",
        recommendation: "Enable gzip or brotli compression at the server or CDN",
        value: `${performance.pagesCompressed}/${analysis.totalPages} pages compressed`,
      });
    }

    const totalImages = pages.reduce((sum, page) => sum + page.images, 0);
    const lazyImages = pages.reduce((sum, page) => sum + page.imagesLazyLoaded, 0);
    if (totalImages > 10 && lazyImages === 0) {
      items.push({
        id: "lazy-loading",
        category: "performance",
        title: "No Image Lazy Loading",
        description: "Images are not lazy-loaded across crawled pages",
        status: "warning",
        impact: "medium",
        recommendation: "Add loading=\"lazy\" to below-the-fold images",
        value: `${totalImages} images, 0 lazy-loaded`,
      });
    }

    if (!homepage.hasOpenGraph || !homepage.hasTwitterCard) {
      items.push({
        id: "social-meta",
        category: "technical",
        title: "Incomplete Social Sharing Meta",
        description: "Open Graph and/or Twitter Card tags are missing",
        status: "warning",
        impact: "low",
        recommendation: "Add Open Graph and Twitter metadata for better social previews and entity clarity",
        value: `OG: ${homepage.hasOpenGraph ? "yes" : "no"}, Twitter: ${homepage.hasTwitterCard ? "yes" : "no"}`,
      });
    }

    const avgWordCount = pages.reduce((sum, page) => sum + page.wordCount, 0) / pages.length;
    if (avgWordCount < 300) {
      items.push({
        id: "thin-content",
        category: "content",
        title: "Thin Content Detected",
        description: "Average page content is under 300 words",
        status: "warning",
        impact: "high",
        recommendation: "Expand thin pages with helpful, specific, expert content",
        value: `Average: ${Math.round(avgWordCount)} words`,
      });
    }

    const pagesWithStructuredData = pages.filter((page) => page.structuredData.length > 0).length;
    if (pagesWithStructuredData === 0) {
      items.push({
        id: "missing-schema",
        category: "technical",
        title: "No Structured Data Found",
        description: "Pages lack JSON-LD structured data markup",
        status: "warning",
        impact: "medium",
        recommendation: "Add relevant schema.org JSON-LD such as Organization, WebSite, Product, Article, FAQPage, or BreadcrumbList",
      });
    }

    const headingHierarchyLooksValid = pages.every((page) => {
      const levels = page.headings.map((heading) => Number.parseInt(heading.level.replace("h", ""), 10));
      if (levels.length === 0) return true;
      return levels[0] === 1;
    });

    if (!headingHierarchyLooksValid) {
      items.push({
        id: "heading-hierarchy",
        category: "content",
        title: "Improper Heading Hierarchy",
        description: "Some pages do not start their heading structure with H1",
        status: "warning",
        impact: "medium",
        recommendation: "Use one H1 per page and organize supporting sections with H2/H3 headings",
      });
    }

    return items;
  }

  private calculateScores(auditItems: TechnicalAuditItem[]): {
    overall: number;
    seo: number;
    technical: number;
    performance: number;
    accessibility: number;
  } {
    const categoryScores = {
      content: 100,
      technical: 100,
      performance: 100,
      accessibility: 100,
    };

    for (const item of auditItems) {
      if (item.status === "pass") continue;

      const deduction =
        item.impact === "critical"
          ? 15
          : item.impact === "high"
            ? 10
            : item.impact === "medium"
              ? 5
              : 2;

      categoryScores[item.category] = Math.max(0, categoryScores[item.category] - deduction);
    }

    const seoScore = Math.round((categoryScores.content + categoryScores.technical) / 2);
    const overall = Math.round(
      seoScore * 0.5 + categoryScores.performance * 0.3 + categoryScores.accessibility * 0.2
    );

    return {
      overall,
      seo: seoScore,
      technical: categoryScores.technical,
      performance: categoryScores.performance,
      accessibility: categoryScores.accessibility,
    };
  }
}
