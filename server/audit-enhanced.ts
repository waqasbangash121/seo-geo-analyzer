import { SiteCrawler } from "@waqashanifkhan/crawler";
import type { CrawlAnalysis, CrawlPage } from "@waqashanifkhan/crawler";

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
    const crawler = new SiteCrawler(url, 50);
    await crawler.fetchSiteFiles();

    const pages = await crawler.crawl();
    this.lastCrawledPages = Array.isArray(pages) ? pages : [];

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
        note: "Estimated from HTML payload, server response time, and render-blocking resources. Not a Lighthouse/field-data measurement.",
      },
      summary: {
        totalPages: crawlAnalysis.totalPages,
        avgLoadTime: Number.isFinite(crawlAnalysis.avgLoadTime)
          ? Math.round(crawlAnalysis.avgLoadTime)
          : 0,
        issuesFound: auditItems.filter((i) => i.status !== "pass").length,
        criticalIssues: auditItems.filter(
          (i) => i.status !== "pass" && i.impact === "critical"
        ).length,
      },
    };
  }

  private findHomepage(pages: CrawlPage[], inputUrl: string): CrawlPage | undefined {
    const origin = new URL(inputUrl).origin;
    return pages.find((p) => {
      try {
        const current = new URL(p.url);
        return current.origin === origin && (current.pathname === "/" || current.href === origin);
      } catch {
        return false;
      }
    });
  }

  private generateTechnicalAudit(
    pages: CrawlPage[],
    analysis: CrawlAnalysis,
    inputUrl: string
  ): TechnicalAuditItem[] {
    const items: TechnicalAuditItem[] = [];

    if (pages.length === 0) {
      return [
        {
          id: "crawl-empty",
          category: "technical",
          title: "No Pages Crawled",
          description: "The crawler could not retrieve any pages from the submitted URL",
          status: "fail",
          impact: "critical",
          recommendation: "Check that the site is online, accessible, and not blocking audit crawlers",
        },
      ];
    }

    const homepage = this.findHomepage(pages, inputUrl) ?? pages[0];

    if (!homepage.title || homepage.title.length < 30) {
      items.push({
        id: "title-length",
        category: "content",
        title: "Page Title Too Short",
        description: "Homepage title should be 30-60 characters for optimal SEO",
        status: "warning",
        impact: "high",
        recommendation: "Expand the page title to include keywords and be more descriptive",
        value: `Current: ${homepage.title?.length ?? 0} characters`,
      });
    }

    if (!homepage.description || homepage.description.length < 120) {
      items.push({
        id: "meta-description",
        category: "content",
        title: "Meta Description Missing or Short",
        description: "Meta description should be 120-160 characters",
        status: "warning",
        impact: "high",
        recommendation: "Add or expand meta description with relevant keywords",
        value: `Current: ${homepage.description?.length ?? 0} characters`,
      });
    }

    if (homepage.h1.length === 0) {
      items.push({
        id: "missing-h1",
        category: "content",
        title: "Missing H1 Tag",
        description: "Every page should have exactly one H1 tag",
        status: "fail",
        impact: "critical",
        recommendation: "Add a descriptive H1 tag to the page",
      });
    } else if (homepage.h1.length > 1) {
      items.push({
        id: "multiple-h1",
        category: "content",
        title: "Multiple H1 Tags",
        description: "Page has multiple H1 tags which confuses search engines",
        status: "warning",
        impact: "high",
        recommendation: "Ensure only one H1 tag per page",
        value: `Found: ${homepage.h1.length} H1 tags`,
      });
    }

    if (analysis.crawlDepth > 4) {
      items.push({
        id: "crawl-depth",
        category: "technical",
        title: "Deep Site Structure",
        description: "Pages are nested more than 4 levels deep",
        status: "warning",
        impact: "medium",
        recommendation: "Flatten site structure so important pages are reachable within fewer clicks",
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
        recommendation: "Link orphan pages from navigation, hub pages, or contextual internal links",
        value: `Found: ${analysis.orphanPages.length} orphan pages`,
      });
    }

    if (analysis.brokenLinks.length > 0) {
      items.push({
        id: "broken-links",
        category: "technical",
        title: "Broken Links Found",
        description: "Some crawled URLs return 400 or 500 level status codes",
        status: "fail",
        impact: "critical",
        recommendation: "Fix, redirect, or remove broken links",
        value: `Found: ${analysis.brokenLinks.length} broken links`,
      });
    }

    if (analysis.canonicalIssues.length > 0) {
      items.push({
        id: "canonical-issues",
        category: "technical",
        title: "Canonical Tag Issues",
        description: "Some pages have missing or incorrect canonical tags",
        status: "warning",
        impact: "high",
        recommendation: "Ensure all indexable pages have correct self-referencing canonicals",
        value: `Issues found: ${analysis.canonicalIssues.length}`,
      });
    }

    if (analysis.noindexPages.length > 0) {
      items.push({
        id: "noindex-pages",
        category: "technical",
        title: "Noindex Tags Found",
        description: "Some crawled pages are marked as noindex",
        status: "warning",
        impact: "high",
        recommendation: "Review and remove noindex from pages that should appear in search results",
        value: `Pages: ${analysis.noindexPages.length}`,
      });
    }

    const avgLoadTime = Number.isFinite(analysis.avgLoadTime) ? analysis.avgLoadTime : 0;
    if (avgLoadTime > 3000) {
      items.push({
        id: "slow-load-time",
        category: "performance",
        title: "Slow Page Load Time",
        description: "Average page load time exceeds 3 seconds",
        status: "warning",
        impact: "high",
        recommendation: "Optimize images, enable caching, minimize JavaScript, and improve server response time",
        value: `Average: ${Math.round(avgLoadTime)}ms`,
      });
    }

    const avgImages = pages.reduce((sum, p) => sum + p.images, 0) / pages.length;
    if (avgImages > 20) {
      items.push({
        id: "image-optimization",
        category: "performance",
        title: "High Number of Images",
        description: "Pages have many images which may impact load time",
        status: "warning",
        impact: "medium",
        recommendation: "Compress, resize, lazy-load, and serve images in modern formats",
        value: `Average per page: ${Math.round(avgImages)} images`,
      });
    }

    const performance = analysis.performance;

    if (performance.pagesMissingViewport > 0) {
      items.push({
        id: "viewport-meta",
        category: "technical",
        title: "Missing Viewport Meta Tag",
        description: "Viewport meta tag is missing for mobile optimization on some pages",
        status: "fail",
        impact: "critical",
        recommendation: "Add <meta name='viewport' content='width=device-width, initial-scale=1'> to every page",
        value: `${performance.pagesMissingViewport} of ${pages.length} pages missing viewport`,
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
        recommendation: "Add a robots.txt file to guide crawlers and declare sitemap locations",
      });
    } else {
      if (analysis.robots.disallowsAll) {
        items.push({
          id: "robots-disallow-all",
          category: "technical",
          title: "robots.txt Blocks All Crawlers",
          description: "robots.txt contains a global Disallow rule for all crawlers",
          status: "fail",
          impact: "critical",
          recommendation: "Remove blanket Disallow rules so search engines can crawl the site",
        });
      }

      if (!analysis.robots.hasSitemapDirective) {
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
    }

    if (!analysis.sitemap.found) {
      items.push({
        id: "sitemap-xml",
        category: "technical",
        title: "sitemap.xml Not Found",
        description: "No XML sitemap was found",
        status: "warning",
        impact: "high",
        recommendation: "Generate and submit an XML sitemap to help search engines discover pages",
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

    if (performance.totalImagesWithoutAlt > 0) {
      items.push({
        id: "image-alt-text",
        category: "accessibility",
        title: "Images Missing Alt Text",
        description: "Some images lack descriptive alt attributes",
        status: "warning",
        impact: "medium",
        recommendation: "Add descriptive alt text to meaningful images for accessibility and image SEO",
        value: `${performance.totalImagesWithoutAlt} images without alt`,
      });
    }

    if (performance.pagesWithBlockingScripts > 0) {
      items.push({
        id: "render-blocking-scripts",
        category: "performance",
        title: "Render-Blocking Scripts",
        description: "Some pages load scripts in <head> without async/defer",
        status: "warning",
        impact: "high",
        recommendation: "Add async/defer to non-critical scripts or move them before </body>",
        value: `${performance.pagesWithBlockingScripts} pages affected`,
      });
    }

    const totalImages = pages.reduce((sum, p) => sum + p.images, 0);
    const totalLazy = pages.reduce((sum, p) => sum + p.imagesLazyLoaded, 0);
    if (totalImages > 10 && totalLazy === 0) {
      items.push({
        id: "lazy-loading",
        category: "performance",
        title: "No Image Lazy Loading",
        description: "Images are not lazy-loaded, which can slow initial rendering",
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
        description: "Open Graph and/or Twitter Card meta tags are missing",
        status: "warning",
        impact: "low",
        recommendation: "Add Open Graph and Twitter Card tags for better social previews",
        value: `OG: ${homepage.hasOpenGraph ? "yes" : "no"}, Twitter: ${homepage.hasTwitterCard ? "yes" : "no"}`,
      });
    }

    if (performance.rating !== "good") {
      items.push({
        id: "core-web-vitals",
        category: "performance",
        title: `Estimated Core Web Vitals: ${performance.rating === "poor" ? "Poor" : "Needs Improvement"}`,
        description: "Estimated LCP/CLS/INP indicate room for improvement",
        status: performance.rating === "poor" ? "fail" : "warning",
        impact: performance.rating === "poor" ? "high" : "medium",
        recommendation: "Reduce payload size, defer non-critical JavaScript, set image dimensions, and optimize the largest element",
        value: `LCP ~${performance.estLCP}s, CLS ~${performance.estCLS}, INP ~${performance.estINP}ms`,
      });
    }

    if (performance.pagesWithCacheControl < analysis.totalPages) {
      items.push({
        id: "browser-caching",
        category: "performance",
        title: "Missing Browser Caching Headers",
        description: "Some pages do not send effective Cache-Control or Expires headers",
        status: performance.pagesWithCacheControl === 0 ? "fail" : "warning",
        impact: "medium",
        recommendation: "Set long-lived Cache-Control for static assets and use ETag/Last-Modified for revalidation",
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
        recommendation: "Enable gzip or brotli compression at the server/CDN",
        value: `${performance.pagesCompressed}/${analysis.totalPages} pages compressed`,
      });
    }

    if (performance.pagesWithHsts === 0 && analysis.totalPages > 0) {
      items.push({
        id: "hsts-header",
        category: "technical",
        title: "Missing HSTS Header",
        description: "Strict-Transport-Security header was not detected",
        status: "warning",
        impact: "low",
        recommendation: "Add a Strict-Transport-Security header to enforce HTTPS",
        value: "No HSTS header found",
      });
    }

    const avgWordCount = pages.reduce((sum, p) => sum + p.wordCount, 0) / pages.length;
    if (avgWordCount < 300) {
      items.push({
        id: "thin-content",
        category: "content",
        title: "Thin Content Detected",
        description: "Average page content is less than 300 words",
        status: "warning",
        impact: "high",
        recommendation: "Expand thin pages with helpful, specific, expert content",
        value: `Average: ${Math.round(avgWordCount)} words`,
      });
    }

    const pagesWithStructuredData = pages.filter((p) => p.structuredData.length > 0).length;
    if (pagesWithStructuredData === 0) {
      items.push({
        id: "missing-schema",
        category: "technical",
        title: "No Structured Data Found",
        description: "Pages lack JSON-LD structured data markup",
        status: "warning",
        impact: "medium",
        recommendation: "Add schema.org JSON-LD such as Organization, WebSite, BreadcrumbList, Product, FAQPage, or Article as appropriate",
      });
    }

    const hasProperHeadingHierarchy = pages.every((p) => {
      const headingLevels = p.headings.map((h) => Number.parseInt(h.level.replace("h", ""), 10));
      if (headingLevels.length === 0) return true;
      return headingLevels[0] === 1;
    });

    if (!hasProperHeadingHierarchy) {
      items.push({
        id: "heading-hierarchy",
        category: "content",
        title: "Improper Heading Hierarchy",
        description: "Heading hierarchy is not properly structured",
        status: "warning",
        impact: "medium",
        recommendation: "Use one H1 and then organize sections with H2/H3 headings in logical order",
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

    auditItems.forEach((item) => {
      if (item.status === "pass") return;

      const deduction =
        item.impact === "critical"
          ? 15
          : item.impact === "high"
            ? 10
            : item.impact === "medium"
              ? 5
              : 2;

      categoryScores[item.category] = Math.max(0, categoryScores[item.category] - deduction);
    });

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
