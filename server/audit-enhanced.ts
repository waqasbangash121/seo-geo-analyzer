import { SiteCrawler, CrawlPage, CrawlAnalysis } from "./crawl";

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
  crawlAnalysis: CrawlAnalysis;
  technicalAudit: TechnicalAuditItem[];
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
    // Perform site crawl + fetch robots.txt / sitemap.xml
    const crawler = new SiteCrawler(url, 50);
    await crawler.fetchSiteFiles();
    const pages = await crawler.crawl();
    this.lastCrawledPages = pages;
    const crawlAnalysis = crawler.analyze();

    // Generate technical audit items
    const auditItems = this.generateTechnicalAudit(pages, crawlAnalysis);

    // Calculate scores
    const scores = this.calculateScores(auditItems, crawlAnalysis);

    // Build result
    const result: EnhancedAuditResult = {
      url,
      domain: new URL(url).hostname,
      crawlAnalysis,
      technicalAudit: auditItems,
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
        avgLoadTime: Math.round(crawlAnalysis.avgLoadTime),
        issuesFound: auditItems.length,
        criticalIssues: auditItems.filter((i) => i.impact === "critical").length,
      },
    };

    return result;
  }

  private generateTechnicalAudit(
    pages: CrawlPage[],
    analysis: CrawlAnalysis
  ): TechnicalAuditItem[] {
    const items: TechnicalAuditItem[] = [];

    // Homepage checks
    const homepage = pages.find((p) => p.url === new URL(pages[0].url).origin);
    if (homepage) {
      if (!homepage.title || homepage.title.length < 30) {
        items.push({
          id: "title-length",
          category: "content",
          title: "Page Title Too Short",
          description: "Homepage title should be 30-60 characters for optimal SEO",
          status: "warning",
          impact: "high",
          recommendation: "Expand the page title to include keywords and be more descriptive",
          value: `Current: ${homepage.title.length} characters`,
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
          value: `Current: ${homepage.description.length} characters`,
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
    }

    // Crawl depth check
    if (analysis.crawlDepth > 4) {
      items.push({
        id: "crawl-depth",
        category: "technical",
        title: "Deep Site Structure",
        description: "Pages are nested more than 3 levels deep",
        status: "warning",
        impact: "medium",
        recommendation: "Flatten site structure to improve crawlability",
        value: `Current depth: ${analysis.crawlDepth}`,
      });
    }

    // Orphan pages check
    if (analysis.orphanPages.length > 0) {
      items.push({
        id: "orphan-pages",
        category: "technical",
        title: "Orphan Pages Detected",
        description: "Some pages are not linked from other pages",
        status: "warning",
        impact: "medium",
        recommendation: "Link orphan pages from navigation or other pages",
        value: `Found: ${analysis.orphanPages.length} orphan pages`,
      });
    }

    // Broken links check
    if (analysis.brokenLinks.length > 0) {
      items.push({
        id: "broken-links",
        category: "technical",
        title: "Broken Links Found",
        description: "Some links return 404 or other error status codes",
        status: "fail",
        impact: "critical",
        recommendation: "Fix or remove broken links",
        value: `Found: ${analysis.brokenLinks.length} broken links`,
      });
    }

    // Canonical issues check
    if (analysis.canonicalIssues.length > 0) {
      items.push({
        id: "canonical-issues",
        category: "technical",
        title: "Canonical Tag Issues",
        description: "Some pages have missing or incorrect canonical tags",
        status: "warning",
        impact: "high",
        recommendation: "Ensure all pages have correct canonical tags",
        value: `Issues found: ${analysis.canonicalIssues.length}`,
      });
    }

    // Noindex pages check
    if (analysis.noindexPages.length > 0) {
      items.push({
        id: "noindex-pages",
        category: "technical",
        title: "Noindex Tags Found",
        description: "Some pages are marked as noindex",
        status: "warning",
        impact: "high",
        recommendation: "Review and remove noindex tags from indexable pages",
        value: `Pages: ${analysis.noindexPages.length}`,
      });
    }

    // Performance checks
    const avgLoadTime = analysis.avgLoadTime;
    if (avgLoadTime > 3000) {
      items.push({
        id: "slow-load-time",
        category: "performance",
        title: "Slow Page Load Time",
        description: "Average page load time exceeds 3 seconds",
        status: "warning",
        impact: "high",
        recommendation: "Optimize images, enable caching, and minimize CSS/JS",
        value: `Average: ${Math.round(avgLoadTime)}ms`,
      });
    }

    // Image optimization check
    const avgImages = pages.reduce((sum, p) => sum + p.images, 0) / pages.length;
    if (avgImages > 20) {
      items.push({
        id: "image-optimization",
        category: "performance",
        title: "High Number of Images",
        description: "Pages have many images which may impact load time",
        status: "warning",
        impact: "medium",
        recommendation: "Optimize and lazy-load images",
        value: `Average per page: ${Math.round(avgImages)} images`,
      });
    }

    // Mobile-friendly check (viewport meta)
    const pagesMissingViewport = analysis.performance.pagesMissingViewport;
    if (pagesMissingViewport > 0) {
      items.push({
        id: "viewport-meta",
        category: "technical",
        title: "Missing Viewport Meta Tag",
        description: "Viewport meta tag is missing for mobile optimization on some pages",
        status: "fail",
        impact: "critical",
        recommendation: "Add <meta name='viewport' content='width=device-width, initial-scale=1'> to every page",
        value: `${pagesMissingViewport} of ${pages.length} pages missing viewport`,
      });
    }

    // robots.txt check
    if (!analysis.robots.found) {
      items.push({
        id: "robots-txt",
        category: "technical",
        title: "robots.txt Not Found",
        description: "No robots.txt file was found at the site root",
        status: "warning",
        impact: "medium",
        recommendation: "Add a robots.txt to guide crawlers and declare your sitemap location",
      });
    } else {
      if (analysis.robots.disallowsAll) {
        items.push({
          id: "robots-disallow-all",
          category: "technical",
          title: "robots.txt Blocks All Crawlers",
          description: "robots.txt contains a global 'Disallow: /' for all user-agents",
          status: "fail",
          impact: "critical",
          recommendation: "Remove the blanket Disallow rule so search engines can crawl the site",
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
          recommendation: "Add a 'Sitemap: https://example.com/sitemap.xml' directive to robots.txt",
        });
      }
    }

    // sitemap.xml check
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

    // Image alt-text (accessibility + SEO)
    if (analysis.performance.totalImagesWithoutAlt > 0) {
      items.push({
        id: "image-alt-text",
        category: "accessibility",
        title: "Images Missing Alt Text",
        description: "Some images lack descriptive alt attributes",
        status: "warning",
        impact: "medium",
        recommendation: "Add descriptive alt text to all meaningful images for accessibility and image SEO",
        value: `${analysis.performance.totalImagesWithoutAlt} images without alt`,
      });
    }

    // Render-blocking scripts
    if (analysis.performance.pagesWithBlockingScripts > 0) {
      items.push({
        id: "render-blocking-scripts",
        category: "performance",
        title: "Render-Blocking Scripts",
        description: "Some pages load scripts in <head> without async/defer",
        status: "warning",
        impact: "high",
        recommendation: "Add async/defer to non-critical scripts or move them before </body>",
        value: `${analysis.performance.pagesWithBlockingScripts} pages affected`,
      });
    }

    // Lazy loading
    const totalImages = pages.reduce((s, p) => s + p.images, 0);
    const totalLazy = pages.reduce((s, p) => s + p.imagesLazyLoaded, 0);
    if (totalImages > 10 && totalLazy === 0) {
      items.push({
        id: "lazy-loading",
        category: "performance",
        title: "No Image Lazy Loading",
        description: "Images are not lazy-loaded, which can slow initial render",
        status: "warning",
        impact: "medium",
        recommendation: "Add loading=\"lazy\" to below-the-fold images",
        value: `${totalImages} images, 0 lazy-loaded`,
      });
    }

    // Social meta (Open Graph / Twitter cards)
    const homepageSocial = pages[0];
    if (homepageSocial && (!homepageSocial.hasOpenGraph || !homepageSocial.hasTwitterCard)) {
      items.push({
        id: "social-meta",
        category: "technical",
        title: "Incomplete Social Sharing Meta",
        description: "Open Graph and/or Twitter Card meta tags are missing",
        status: "warning",
        impact: "low",
        recommendation: "Add Open Graph and Twitter Card tags for better social sharing previews",
        value: `OG: ${homepageSocial.hasOpenGraph ? "yes" : "no"}, Twitter: ${homepageSocial.hasTwitterCard ? "yes" : "no"}`,
      });
    }

    // Core Web Vitals (estimated)
    const cwv = analysis.performance;
    if (cwv.rating !== "good") {
      items.push({
        id: "core-web-vitals",
        category: "performance",
        title: `Estimated Core Web Vitals: ${cwv.rating === "poor" ? "Poor" : "Needs Improvement"}`,
        description: "Estimated LCP/CLS/INP indicate room for improvement (heuristic, not field data)",
        status: cwv.rating === "poor" ? "fail" : "warning",
        impact: cwv.rating === "poor" ? "high" : "medium",
        recommendation: "Reduce payload size, defer non-critical JS, set image dimensions, and optimize the largest element",
        value: `LCP ~${cwv.estLCP}s, CLS ~${cwv.estCLS}, INP ~${cwv.estINP}ms`,
      });
    }

    // Browser caching (Cache-Control / Expires headers)
    if (cwv.pagesWithCacheControl < analysis.totalPages) {
      items.push({
        id: "browser-caching",
        category: "performance",
        title: "Missing Browser Caching Headers",
        description: "Some pages do not send effective Cache-Control/Expires headers",
        status: cwv.pagesWithCacheControl === 0 ? "fail" : "warning",
        impact: "medium",
        recommendation: "Set long-lived Cache-Control max-age for static assets and use ETag/Last-Modified for revalidation",
        value: `${cwv.pagesWithCacheControl}/${analysis.totalPages} pages cacheable`,
      });
    }

    // Text compression (gzip / brotli)
    if (cwv.pagesCompressed < analysis.totalPages) {
      items.push({
        id: "text-compression",
        category: "performance",
        title: "Text Compression Not Enabled",
        description: "Some pages are served without gzip/brotli compression",
        status: cwv.pagesCompressed === 0 ? "fail" : "warning",
        impact: "medium",
        recommendation: "Enable gzip or brotli compression at the server/CDN to shrink HTML, CSS, and JS transfer size",
        value: `${cwv.pagesCompressed}/${analysis.totalPages} pages compressed`,
      });
    }

    // HSTS / secure transport header
    if (cwv.pagesWithHsts === 0 && analysis.totalPages > 0) {
      items.push({
        id: "hsts-header",
        category: "technical",
        title: "Missing HSTS Header",
        description: "Strict-Transport-Security header was not detected",
        status: "warning",
        impact: "low",
        recommendation: "Add a Strict-Transport-Security header to enforce HTTPS and improve security signals",
        value: "No HSTS header found",
      });
    }

    // Content quality checks
    const avgWordCount = pages.reduce((sum, p) => sum + p.wordCount, 0) / pages.length;
    if (avgWordCount < 300) {
      items.push({
        id: "thin-content",
        category: "content",
        title: "Thin Content Detected",
        description: "Average page content is less than 300 words",
        status: "warning",
        impact: "high",
        recommendation: "Expand content with more detailed information",
        value: `Average: ${Math.round(avgWordCount)} words`,
      });
    }

    // Structured data check
    const pagesWithStructuredData = pages.filter((p) => p.structuredData.length > 0)
      .length;
    if (pagesWithStructuredData === 0) {
      items.push({
        id: "missing-schema",
        category: "technical",
        title: "No Structured Data Found",
        description: "Pages lack JSON-LD structured data markup",
        status: "warning",
        impact: "medium",
        recommendation: "Add schema.org structured data (Organization, LocalBusiness, Product, etc)",
      });
    }

    // Heading hierarchy check
    const hasProperHeadingHierarchy = pages.every((p) => {
      const headingLevels = p.headings.map((h) => parseInt(h.level.replace("h", "")));
      if (headingLevels.length === 0) return true;
      headingLevels.sort((a, b) => a - b);
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
        recommendation: "Ensure H1 is the first heading, followed by H2, H3, etc",
      });
    }

    return items;
  }

  private calculateScores(
    auditItems: TechnicalAuditItem[],
    analysis: CrawlAnalysis
  ): {
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

    // Deduct points for issues
    auditItems.forEach((item) => {
      const deduction =
        item.impact === "critical"
          ? 15
          : item.impact === "high"
            ? 10
            : item.impact === "medium"
              ? 5
              : 2;

      if (item.category === "content") {
        categoryScores.content = Math.max(0, categoryScores.content - deduction);
      } else if (item.category === "technical") {
        categoryScores.technical = Math.max(0, categoryScores.technical - deduction);
      } else if (item.category === "performance") {
        categoryScores.performance = Math.max(0, categoryScores.performance - deduction);
      } else if (item.category === "accessibility") {
        categoryScores.accessibility = Math.max(0, categoryScores.accessibility - deduction);
      }
    });

    const seoScore = Math.round(
      (categoryScores.content + categoryScores.technical) / 2
    );
    const overall = Math.round(
      (seoScore + categoryScores.performance + categoryScores.accessibility) / 3
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
