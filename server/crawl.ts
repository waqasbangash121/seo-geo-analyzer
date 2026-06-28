import * as cheerio from "cheerio";

export interface CrawlPage {
  url: string;
  title: string;
  description: string;
  h1: string[];
  images: number;
  internalLinks: string[];
  externalLinks: string[];
  statusCode: number;
  loadTime: number;
  hasCanonical: boolean;
  canonical: string;
  hasNoindex: boolean;
  hreflang: string[];
  structuredData: string[];
  headings: { level: string; text: string }[];
  wordCount: number;
  readabilityScore: number;
  bodyText: string;
  // Performance & technical signals
  pageSizeBytes: number;
  imagesWithoutAlt: number;
  imagesLazyLoaded: number;
  scriptCount: number;
  blockingScriptCount: number;
  stylesheetCount: number;
  inlineStyleCount: number;
  hasViewportMeta: boolean;
  hasOpenGraph: boolean;
  hasTwitterCard: boolean;
  schemaTypes: string[];
  // Caching / delivery headers (observed from HTTP response)
  hasCacheControl: boolean;
  cacheControl: string;
  hasExpires: boolean;
  hasETag: boolean;
  isCompressed: boolean;
  contentEncoding: string;
  hasHsts: boolean;
}

export interface CrawlAnalysis {
  totalPages: number;
  crawlDepth: number;
  avgLoadTime: number;
  orphanPages: string[];
  brokenLinks: string[];
  redirectChains: { from: string; to: string }[];
  canonicalIssues: { page: string; issue: string }[];
  noindexPages: string[];
  duplicateContentRisks: { page1: string; page2: string; similarity: number }[];
  internalLinkingGraph: Map<string, string[]>;
  robots: {
    found: boolean;
    hasSitemapDirective: boolean;
    disallowsAll: boolean;
    sitemapUrls: string[];
  };
  sitemap: {
    found: boolean;
    url: string;
    urlCount: number;
  };
  performance: {
    avgPageSizeKb: number;
    estLCP: number; // seconds
    estCLS: number;
    estINP: number; // ms
    rating: "good" | "needs-improvement" | "poor";
    totalImagesWithoutAlt: number;
    pagesWithBlockingScripts: number;
    pagesMissingViewport: number;
    // Caching & delivery (observed from response headers)
    pagesWithCacheControl: number;
    pagesCompressed: number;
    pagesWithETag: number;
    pagesWithHsts: number;
    cachingNote: string;
  };
  pageTypes: {
    homepage: CrawlPage[];
    category: CrawlPage[];
    product: CrawlPage[];
    service: CrawlPage[];
    blog: CrawlPage[];
    faq: CrawlPage[];
    contact: CrawlPage[];
    about: CrawlPage[];
    other: CrawlPage[];
  };
}

export class SiteCrawler {
  private visited = new Set<string>();
  private queue: string[] = [];
  private pages: CrawlPage[] = [];
  private baseUrl: string;
  private maxPages = 50;
  private timeout = 5000;
  private robotsResult: CrawlAnalysis["robots"] = {
    found: false,
    hasSitemapDirective: false,
    disallowsAll: false,
    sitemapUrls: [],
  };
  private sitemapResult: CrawlAnalysis["sitemap"] = {
    found: false,
    url: "",
    urlCount: 0,
  };

  constructor(startUrl: string, maxPages = 50) {
    this.baseUrl = new URL(startUrl).origin;
    this.queue = [startUrl];
    this.maxPages = maxPages;
  }

  /** Fetch and parse robots.txt and sitemap.xml at the site root. */
  async fetchSiteFiles(): Promise<void> {
    // robots.txt
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), this.timeout);
      const res = await fetch(`${this.baseUrl}/robots.txt`, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SEOGEOAuditBot/1.0)" },
      });
      clearTimeout(t);
      if (res.ok) {
        const text = await res.text();
        const sitemapUrls = Array.from(text.matchAll(/sitemap:\s*(\S+)/gi)).map(
          (m) => m[1]
        );
        // Detect a global disallow-all under a wildcard user-agent
        const disallowsAll = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*(\n|$)/i.test(text);
        this.robotsResult = {
          found: true,
          hasSitemapDirective: sitemapUrls.length > 0,
          disallowsAll,
          sitemapUrls,
        };
      }
    } catch {
      // robots.txt unreachable
    }

    // sitemap.xml (prefer one declared in robots.txt, else default path)
    const sitemapCandidate =
      this.robotsResult.sitemapUrls[0] || `${this.baseUrl}/sitemap.xml`;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), this.timeout);
      const res = await fetch(sitemapCandidate, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SEOGEOAuditBot/1.0)" },
      });
      clearTimeout(t);
      if (res.ok) {
        const xml = await res.text();
        const locCount = (xml.match(/<loc>/gi) || []).length;
        this.sitemapResult = {
          found: true,
          url: sitemapCandidate,
          urlCount: locCount,
        };
      }
    } catch {
      // sitemap unreachable
    }
  }

  async crawl(): Promise<CrawlPage[]> {
    while (this.queue.length > 0 && this.pages.length < this.maxPages) {
      const url = this.queue.shift();
      if (!url || this.visited.has(url)) continue;

      this.visited.add(url);

      try {
        const page = await this.fetchPage(url);
        this.pages.push(page);

        // Extract links and add to queue
        page.internalLinks.forEach((link) => {
          if (!this.visited.has(link) && this.queue.length < this.maxPages * 2) {
            this.queue.push(link);
          }
        });
      } catch (error) {
        console.error(`Failed to crawl ${url}:`, error);
      }
    }

    return this.pages;
  }

  private async fetchPage(url: string): Promise<CrawlPage> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      
      clearTimeout(timeoutId);

      const html = await response.text();
      const $ = cheerio.load(html) as any;
      const loadTime = Date.now() - startTime;

      // Caching / delivery headers (observed from the HTTP response)
      const cacheControl = response.headers.get("cache-control") || "";
      const hasCacheControl =
        cacheControl.length > 0 && !/no-store|no-cache|max-age=0/i.test(cacheControl);
      const hasExpires = !!response.headers.get("expires");
      const hasETag =
        !!response.headers.get("etag") || !!response.headers.get("last-modified");
      const contentEncoding = response.headers.get("content-encoding") || "";
      const isCompressed = /gzip|br|deflate|zstd/i.test(contentEncoding);
      const hasHsts = !!response.headers.get("strict-transport-security");

      // Extract metadata
      const title = $("title").text() || $('meta[property="og:title"]').attr("content") || "";
      const description =
        $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") ||
        "";

      // Extract headings
      const h1: string[] = [];
      const headings: { level: string; text: string }[] = [];
      $("h1, h2, h3, h4, h5, h6").each((_: number, elem: any) => {
        const text = $(elem).text().trim();
        const level = elem.name;
        if (level === "h1") h1.push(text);
        if (text) headings.push({ level, text });
      });

      // Count images + alt/lazy analysis
      const images = $("img").length;
      let imagesWithoutAlt = 0;
      let imagesLazyLoaded = 0;
      $("img").each((_: number, elem: any) => {
        const alt = $(elem).attr("alt");
        if (alt === undefined || alt.trim() === "") imagesWithoutAlt++;
        const loading = $(elem).attr("loading");
        if (loading === "lazy" || $(elem).attr("data-src")) imagesLazyLoaded++;
      });

      // Script analysis (render-blocking = no async/defer in <head>)
      const scriptCount = $("script[src]").length;
      let blockingScriptCount = 0;
      $("head script[src]").each((_: number, elem: any) => {
        const isAsync = $(elem).attr("async") !== undefined;
        const isDefer = $(elem).attr("defer") !== undefined;
        const type = $(elem).attr("type");
        if (!isAsync && !isDefer && type !== "module") blockingScriptCount++;
      });
      const stylesheetCount = $('link[rel="stylesheet"]').length;
      const inlineStyleCount = $("style").length;

      // Mobile / social meta
      const hasViewportMeta = $('meta[name="viewport"]').length > 0;
      const hasOpenGraph = $('meta[property^="og:"]').length > 0;
      const hasTwitterCard = $('meta[name^="twitter:"]').length > 0;

      // Extract links
      const internalLinks: string[] = [];
      const externalLinks: string[] = [];
      $("a[href]").each((_: number, elem: any) => {
        const href = $(elem).attr("href");
        if (!href) return;

        try {
          const link = new URL(href, url).href;
          if (link.startsWith(this.baseUrl)) {
            internalLinks.push(link);
          } else if (href.startsWith("http")) {
            externalLinks.push(link);
          }
        } catch {
          // Invalid URL
        }
      });

      // Check for canonical
      const canonical = $('link[rel="canonical"]').attr("href") || "";
      const hasCanonical = !!canonical;

      // Check for noindex
      const hasNoindex =
        $('meta[name="robots"]').attr("content")?.includes("noindex") || false;

      // Extract hreflang
      const hreflang: string[] = [];
      $('link[rel="alternate"][hreflang]').each((_: number, elem: any) => {
        hreflang.push($(elem).attr("hreflang") || "");
      });

      // Extract structured data + schema @types
      const structuredData: string[] = [];
      const schemaTypes: string[] = [];
      $('script[type="application/ld+json"]').each((_: number, elem: any) => {
        const data = $(elem).html();
        if (!data) return;
        structuredData.push(data);
        try {
          const parsed = JSON.parse(data);
          const collect = (node: any) => {
            if (!node || typeof node !== "object") return;
            if (Array.isArray(node)) return node.forEach(collect);
            const t = node["@type"];
            if (typeof t === "string") schemaTypes.push(t);
            else if (Array.isArray(t)) t.forEach((x: any) => typeof x === "string" && schemaTypes.push(x));
            if (Array.isArray(node["@graph"])) node["@graph"].forEach(collect);
          };
          collect(parsed);
        } catch {
          // malformed JSON-LD; ignore for type extraction
        }
      });

      // Page size (bytes of HTML payload)
      const pageSizeBytes = Buffer.byteLength(html, "utf8");

      // Calculate word count
      const bodyText = $('body').text();
      const wordCount = bodyText.split(/\s+/).filter((w: string) => w.length > 0).length;

      // Simple readability score (0-100)
      const readabilityScore = Math.min(
        100,
        Math.round((wordCount / 300) * 100)
      );

      return {
        url,
        title,
        description,
        h1,
        images,
        internalLinks: Array.from(new Set(internalLinks)),
        externalLinks: Array.from(new Set(externalLinks)),
        statusCode: response.status,
        loadTime,
        hasCanonical,
        canonical,
        hasNoindex,
        hreflang,
        structuredData,
        headings,
        wordCount,
        readabilityScore,
        bodyText: bodyText.replace(/\s+/g, " ").trim().slice(0, 20000),
        pageSizeBytes,
        imagesWithoutAlt,
        imagesLazyLoaded,
        scriptCount,
        blockingScriptCount,
        stylesheetCount,
        inlineStyleCount,
        hasViewportMeta,
        hasOpenGraph,
        hasTwitterCard,
        schemaTypes: Array.from(new Set(schemaTypes)),
        hasCacheControl,
        cacheControl,
        hasExpires,
        hasETag,
        isCompressed,
        contentEncoding,
        hasHsts,
      };
    } catch (error) {
      throw new Error(`Failed to fetch ${url}: ${error}`);
    }
  }

  analyze(): CrawlAnalysis {
    const analysis: CrawlAnalysis = {
      totalPages: this.pages.length,
      crawlDepth: this.calculateCrawlDepth(),
      avgLoadTime:
        this.pages.reduce((sum, p) => sum + p.loadTime, 0) / this.pages.length,
      orphanPages: this.findOrphanPages(),
      brokenLinks: this.findBrokenLinks(),
      redirectChains: [],
      canonicalIssues: this.findCanonicalIssues(),
      noindexPages: this.pages
        .filter((p) => p.hasNoindex)
        .map((p) => p.url),
      duplicateContentRisks: this.findDuplicateContent(),
      internalLinkingGraph: this.buildLinkingGraph(),
      robots: this.robotsResult,
      sitemap: this.sitemapResult,
      performance: this.estimatePerformance(),
      pageTypes: this.classifyPages(),
    };

    return analysis;
  }

  /**
   * Estimate Core Web Vitals from observable signals (HTML payload size,
   * server response time, render-blocking resources). This is a heuristic
   * proxy, not a field-data / Lighthouse measurement.
   */
  private estimatePerformance(): CrawlAnalysis["performance"] {
    const count = this.pages.length || 1;
    const avgPageSizeKb =
      this.pages.reduce((s, p) => s + (p.pageSizeBytes || 0), 0) / count / 1024;
    const avgLoad =
      this.pages.reduce((s, p) => s + p.loadTime, 0) / count; // ms
    const avgBlocking =
      this.pages.reduce((s, p) => s + (p.blockingScriptCount || 0), 0) / count;
    const avgImages =
      this.pages.reduce((s, p) => s + (p.images || 0), 0) / count;

    // LCP proxy (s): server response + payload transfer + blocking JS penalty
    const estLCP = Math.round(
      ((avgLoad / 1000) + avgPageSizeKb / 600 + avgBlocking * 0.25) * 100
    ) / 100;
    // CLS proxy: more images without explicit handling => higher shift risk
    const avgNoAlt =
      this.pages.reduce((s, p) => s + (p.imagesWithoutAlt || 0), 0) / count;
    const estCLS = Math.round(Math.min(0.4, (avgImages * 0.004 + avgNoAlt * 0.003)) * 1000) / 1000;
    // INP proxy (ms): scales with script count
    const avgScripts =
      this.pages.reduce((s, p) => s + (p.scriptCount || 0), 0) / count;
    const estINP = Math.round(120 + avgScripts * 25 + avgBlocking * 40);

    const lcpGood = estLCP <= 2.5;
    const clsGood = estCLS <= 0.1;
    const inpGood = estINP <= 200;
    const goodCount = [lcpGood, clsGood, inpGood].filter(Boolean).length;
    const rating: "good" | "needs-improvement" | "poor" =
      goodCount === 3 ? "good" : goodCount >= 1 ? "needs-improvement" : "poor";

    return {
      avgPageSizeKb: Math.round(avgPageSizeKb),
      estLCP,
      estCLS,
      estINP,
      rating,
      totalImagesWithoutAlt: this.pages.reduce(
        (s, p) => s + (p.imagesWithoutAlt || 0),
        0
      ),
      pagesWithBlockingScripts: this.pages.filter(
        (p) => (p.blockingScriptCount || 0) > 0
      ).length,
      pagesMissingViewport: this.pages.filter((p) => !p.hasViewportMeta).length,
      pagesWithCacheControl: this.pages.filter((p) => p.hasCacheControl).length,
      pagesCompressed: this.pages.filter((p) => p.isCompressed).length,
      pagesWithETag: this.pages.filter((p) => p.hasETag).length,
      pagesWithHsts: this.pages.filter((p) => p.hasHsts).length,
      cachingNote: (() => {
        const c = this.pages.filter((p) => p.hasCacheControl).length;
        const z = this.pages.filter((p) => p.isCompressed).length;
        const total = this.pages.length || 1;
        const parts: string[] = [];
        if (c < total)
          parts.push(
            `${total - c}/${total} page(s) lack effective Cache-Control headers \u2014 set long max-age for static assets.`
          );
        if (z < total)
          parts.push(
            `${total - z}/${total} page(s) served without gzip/brotli compression \u2014 enable text compression.`
          );
        return parts.length
          ? parts.join(" ")
          : "Caching and compression headers look healthy across crawled pages.";
      })(),
    };
  }

  private calculateCrawlDepth(): number {
    const depths = new Map<string, number>();
    depths.set(this.baseUrl, 0);

    let maxDepth = 0;
    this.pages.forEach((page) => {
      const depth = this.getUrlDepth(page.url);
      maxDepth = Math.max(maxDepth, depth);
    });

    return maxDepth;
  }

  private getUrlDepth(url: string): number {
    const path = new URL(url).pathname;
    return path.split("/").filter((p) => p.length > 0).length;
  }

  private findOrphanPages(): string[] {
    const linkedPages = new Set<string>();
    this.pages.forEach((page) => {
      page.internalLinks.forEach((link) => linkedPages.add(link));
    });

      return Array.from(this.pages)
        .filter((p) => !linkedPages.has(p.url) && p.url !== this.baseUrl)
        .map((p) => p.url);
  }

  private findBrokenLinks(): string[] {
    const brokenLinks: string[] = [];
    this.pages.forEach((page) => {
      if (page.statusCode >= 400) {
        brokenLinks.push(page.url);
      }
    });
    return brokenLinks;
  }

  private findCanonicalIssues(): { page: string; issue: string }[] {
    const issues: { page: string; issue: string }[] = [];

    this.pages.forEach((page) => {
      if (!page.hasCanonical) {
        issues.push({
          page: page.url,
          issue: "Missing canonical tag",
        });
      } else if (page.canonical && !page.canonical.startsWith(this.baseUrl)) {
        issues.push({
          page: page.url,
          issue: "Canonical points to external domain",
        });
      }
    });

    return issues;
  }

  private buildLinkingGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    this.pages.forEach((page) => {
      graph.set(page.url, page.internalLinks);
    });
    return graph;
  }

  private findDuplicateContent(): { page1: string; page2: string; similarity: number }[] {
    const risks: { page1: string; page2: string; similarity: number }[] = [];

    // Check for similar titles and descriptions
    for (let i = 0; i < this.pages.length; i++) {
      for (let j = i + 1; j < this.pages.length; j++) {
        const page1 = this.pages[i];
        const page2 = this.pages[j];

        // Calculate similarity based on title and description
        const titleSimilarity =
          page1.title === page2.title ? 1 : 0;
        const descSimilarity =
          page1.description === page2.description ? 1 : 0;

        const similarity = (titleSimilarity + descSimilarity) / 2;

        if (similarity > 0.5) {
          risks.push({
            page1: page1.url,
            page2: page2.url,
            similarity: Math.round(similarity * 100),
          });
        }
      }
    }

    return risks;
  }

  private classifyPages(): CrawlAnalysis["pageTypes"] {
    const pageTypes: CrawlAnalysis["pageTypes"] = {
      homepage: [],
      category: [],
      product: [],
      service: [],
      blog: [],
      faq: [],
      contact: [],
      about: [],
      other: [],
    };

    this.pages.forEach((page) => {
      const url = page.url.toLowerCase();
      const path = new URL(url).pathname.toLowerCase();

      if (url === this.baseUrl || path === "/" || path === "") {
        pageTypes.homepage.push(page);
      } else if (path.includes("/category") || path.includes("/categories")) {
        pageTypes.category.push(page);
      } else if (
        path.includes("/product") ||
        path.includes("/products") ||
        path.includes("/shop")
      ) {
        pageTypes.product.push(page);
      } else if (path.includes("/service") || path.includes("/services")) {
        pageTypes.service.push(page);
      } else if (path.includes("/blog") || path.includes("/article")) {
        pageTypes.blog.push(page);
      } else if (path.includes("/faq")) {
        pageTypes.faq.push(page);
      } else if (path.includes("/contact")) {
        pageTypes.contact.push(page);
      } else if (path.includes("/about")) {
        pageTypes.about.push(page);
      } else {
        pageTypes.other.push(page);
      }
    });

    return pageTypes;
  }
}
