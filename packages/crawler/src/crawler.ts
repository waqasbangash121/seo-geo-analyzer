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

export interface SiteCrawlerOptions {
  maxPages?: number;
  timeoutMs?: number;
  concurrency?: number;
  retries?: number;
  userAgent?: string;
  respectRobotsTxt?: boolean;
}

type RobotsRule = {
  userAgents: string[];
  allow: string[];
  disallow: string[];
};

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; SEOGEOCrawler/1.1; +https://github.com/waqasbangash121/seo-geo-analyzer)";

export class SiteCrawler {
  private readonly startUrl: URL;
  private readonly baseUrl: string;
  private readonly maxPages: number;
  private readonly timeoutMs: number;
  private readonly concurrency: number;
  private readonly retries: number;
  private readonly userAgent: string;
  private readonly respectRobotsTxt: boolean;
  private readonly visited = new Set<string>();
  private readonly queued = new Set<string>();
  private readonly queue: string[] = [];
  private readonly pages: CrawlPage[] = [];
  private readonly failedUrls = new Set<string>();
  private readonly redirectChains: { from: string; to: string }[] = [];
  private robotsRules: RobotsRule[] = [];
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

  constructor(startUrl: string, maxPagesOrOptions: number | SiteCrawlerOptions = 50) {
    this.startUrl = new URL(startUrl);
    this.baseUrl = this.startUrl.origin;

    const options =
      typeof maxPagesOrOptions === "number"
        ? { maxPages: maxPagesOrOptions }
        : maxPagesOrOptions;

    this.maxPages = Math.max(1, options.maxPages ?? 50);
    this.timeoutMs = Math.max(1_000, options.timeoutMs ?? 8_000);
    this.concurrency = Math.max(1, Math.min(10, options.concurrency ?? 4));
    this.retries = Math.max(0, Math.min(3, options.retries ?? 1));
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.respectRobotsTxt = options.respectRobotsTxt ?? false;

    this.enqueue(this.normalizeUrl(this.startUrl.href));
  }

  async fetchSiteFiles(): Promise<void> {
    await this.fetchRobotsTxt();
    await this.fetchSitemapXml();
  }

  async crawl(): Promise<CrawlPage[]> {
    if (!this.robotsResult.found && this.robotsRules.length === 0) {
      await this.fetchSiteFiles();
    }

    while (this.queue.length > 0 && this.pages.length < this.maxPages) {
      const batch = this.queue.splice(0, this.concurrency);
      const settled = await Promise.allSettled(batch.map((url) => this.crawlOne(url)));

      for (const result of settled) {
        if (result.status !== "fulfilled" || !result.value) continue;
        this.pages.push(result.value);
        this.enqueueLinks(result.value.internalLinks);
      }
    }

    return this.pages;
  }

  analyze(): CrawlAnalysis {
    return {
      totalPages: this.pages.length,
      crawlDepth: this.calculateCrawlDepth(),
      avgLoadTime: this.average(this.pages.map((page) => page.loadTime)),
      orphanPages: this.findOrphanPages(),
      brokenLinks: this.findBrokenLinks(),
      redirectChains: this.redirectChains,
      canonicalIssues: this.findCanonicalIssues(),
      noindexPages: this.pages.filter((page) => page.hasNoindex).map((page) => page.url),
      duplicateContentRisks: this.findDuplicateContentRisks(),
      internalLinkingGraph: this.buildInternalLinkingGraph(),
      robots: this.robotsResult,
      sitemap: this.sitemapResult,
      performance: this.estimatePerformance(),
      pageTypes: this.classifyPages(),
    };
  }

  private async crawlOne(url: string): Promise<CrawlPage | null> {
    if (this.visited.has(url)) return null;
    this.visited.add(url);

    if (this.respectRobotsTxt && !this.isAllowedByRobots(url)) {
      this.failedUrls.add(url);
      return null;
    }

    try {
      return await this.fetchPageWithRetry(url);
    } catch {
      this.failedUrls.add(url);
      return null;
    }
  }

  private enqueueLinks(links: string[]): void {
    for (const link of links) {
      if (this.pages.length + this.queue.length >= this.maxPages) return;
      this.enqueue(link);
    }
  }

  private enqueue(url: string): void {
    if (this.visited.has(url) || this.queued.has(url)) return;
    if (!this.isSameSite(url)) return;
    this.queued.add(url);
    this.queue.push(url);
  }

  private async fetchRobotsTxt(): Promise<void> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/robots.txt`, {
        redirect: "follow",
      });
      if (!response.ok) return;

      const text = await response.text();
      const sitemapUrls = Array.from(text.matchAll(/^\s*sitemap:\s*(\S+)/gim)).map(
        (match) => match[1]
      );

      this.robotsRules = this.parseRobotsRules(text);
      this.robotsResult = {
        found: true,
        hasSitemapDirective: sitemapUrls.length > 0,
        disallowsAll: this.robotsRules.some(
          (rule) => rule.userAgents.includes("*") && rule.disallow.includes("/")
        ),
        sitemapUrls,
      };
    } catch {
      this.robotsResult = {
        found: false,
        hasSitemapDirective: false,
        disallowsAll: false,
        sitemapUrls: [],
      };
    }
  }

  private parseRobotsRules(text: string): RobotsRule[] {
    const rules: RobotsRule[] = [];
    let current: RobotsRule | null = null;

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.split("#")[0].trim();
      if (!line) continue;

      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) continue;

      const key = line.slice(0, separatorIndex).trim().toLowerCase();
      const value = line.slice(separatorIndex + 1).trim();

      if (key === "user-agent") {
        current = { userAgents: [value.toLowerCase()], allow: [], disallow: [] };
        rules.push(current);
      } else if (current && key === "allow") {
        current.allow.push(value);
      } else if (current && key === "disallow") {
        current.disallow.push(value);
      }
    }

    return rules;
  }

  private isAllowedByRobots(url: string): boolean {
    if (!this.robotsRules.length) return true;

    const path = new URL(url).pathname || "/";
    const userAgent = this.userAgent.toLowerCase();
    const matchingRules = this.robotsRules.filter(
      (rule) =>
        rule.userAgents.includes("*") ||
        rule.userAgents.some((agent) => agent && userAgent.includes(agent))
    );

    if (!matchingRules.length) return true;

    let longestAllow = 0;
    let longestDisallow = 0;

    for (const rule of matchingRules) {
      for (const allow of rule.allow) {
        if (allow && path.startsWith(allow)) longestAllow = Math.max(longestAllow, allow.length);
      }
      for (const disallow of rule.disallow) {
        if (disallow && path.startsWith(disallow)) {
          longestDisallow = Math.max(longestDisallow, disallow.length);
        }
      }
    }

    return longestAllow >= longestDisallow;
  }

  private async fetchSitemapXml(): Promise<void> {
    const candidates = Array.from(
      new Set([
        ...this.robotsResult.sitemapUrls,
        `${this.baseUrl}/sitemap.xml`,
        `${this.baseUrl}/sitemap_index.xml`,
      ])
    );

    for (const candidate of candidates) {
      try {
        const response = await this.fetchWithTimeout(candidate, { redirect: "follow" });
        if (!response.ok) continue;

        const xml = await response.text();
        const urls = Array.from(xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)).map((match) =>
          match[1].trim()
        );

        this.sitemapResult = {
          found: true,
          url: candidate,
          urlCount: urls.length,
        };

        for (const sitemapUrl of urls) {
          if (this.pages.length + this.queue.length >= this.maxPages) break;
          const normalized = this.resolveInternalUrl(sitemapUrl, candidate);
          if (normalized) this.enqueue(normalized);
        }

        return;
      } catch {
        // Try the next sitemap candidate.
      }
    }
  }

  private async fetchPageWithRetry(url: string): Promise<CrawlPage> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        return await this.fetchPage(url);
      } catch (error) {
        lastError = error;
        if (attempt < this.retries) {
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async fetchPage(url: string): Promise<CrawlPage> {
    const startedAt = Date.now();
    const response = await this.fetchWithTimeout(url, {
      redirect: "follow",
      headers: {
        "user-agent": this.userAgent,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });

    const finalUrl = this.normalizeUrl(response.url || url);
    if (finalUrl !== url) {
      this.redirectChains.push({ from: url, to: finalUrl });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return this.emptyPage(finalUrl, response.status, Date.now() - startedAt, response);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const loadTime = Date.now() - startedAt;

    const title = this.cleanText(
      $("title").first().text() || $('meta[property="og:title"]').attr("content") || ""
    );
    const description = this.cleanText(
      $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") ||
        ""
    );

    const h1: string[] = [];
    const headings: CrawlPage["headings"] = [];
    $("h1, h2, h3, h4, h5, h6").each((_, element) => {
      const text = this.cleanText($(element).text());
      const level = String((element as { name?: string }).name || "").toLowerCase();
      if (!text || !level) return;
      if (level === "h1") h1.push(text);
      headings.push({ level, text });
    });

    const internalLinks = new Set<string>();
    const externalLinks = new Set<string>();
    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");
      const resolved = this.resolveUrl(href, finalUrl);
      if (!resolved) return;

      if (this.isSameSite(resolved)) {
        internalLinks.add(this.normalizeUrl(resolved));
      } else if (/^https?:/i.test(resolved)) {
        externalLinks.add(this.normalizeUrl(resolved));
      }
    });

    let imagesWithoutAlt = 0;
    let imagesLazyLoaded = 0;
    const images = $("img").length;
    $("img").each((_, element) => {
      const alt = $(element).attr("alt");
      if (alt === undefined || alt.trim() === "") imagesWithoutAlt++;
      const loading = $(element).attr("loading");
      if (loading === "lazy" || $(element).attr("data-src") || $(element).attr("data-lazy-src")) {
        imagesLazyLoaded++;
      }
    });

    let blockingScriptCount = 0;
    $("head script[src]").each((_, element) => {
      const isAsync = $(element).attr("async") !== undefined;
      const isDefer = $(element).attr("defer") !== undefined;
      const type = $(element).attr("type");
      if (!isAsync && !isDefer && type !== "module") blockingScriptCount++;
    });

    const structuredData: string[] = [];
    const schemaTypes = new Set<string>();
    $('script[type="application/ld+json"]').each((_, element) => {
      const data = $(element).html();
      if (!data) return;
      structuredData.push(data);
      this.collectSchemaTypes(data, schemaTypes);
    });

    const bodyText = this.cleanText($("body").text());
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
    const canonical = this.resolveUrl($('link[rel="canonical"]').attr("href"), finalUrl) || "";
    const robotsContent = String(
      $('meta[name="robots"], meta[name="googlebot"]').attr("content") || ""
    ).toLowerCase();

    return {
      url: finalUrl,
      title,
      description,
      h1,
      images,
      internalLinks: Array.from(internalLinks),
      externalLinks: Array.from(externalLinks),
      statusCode: response.status,
      loadTime,
      hasCanonical: Boolean(canonical),
      canonical,
      hasNoindex: robotsContent.includes("noindex"),
      hreflang: this.extractHreflang($),
      structuredData,
      headings,
      wordCount,
      readabilityScore: Math.min(100, Math.round((wordCount / 300) * 100)),
      bodyText: bodyText.slice(0, 20_000),
      pageSizeBytes: new TextEncoder().encode(html).length,
      imagesWithoutAlt,
      imagesLazyLoaded,
      scriptCount: $("script[src]").length,
      blockingScriptCount,
      stylesheetCount: $('link[rel="stylesheet"]').length,
      inlineStyleCount: $("style").length,
      hasViewportMeta: $('meta[name="viewport"]').length > 0,
      hasOpenGraph: $('meta[property^="og:"]').length > 0,
      hasTwitterCard: $('meta[name^="twitter:"]').length > 0,
      schemaTypes: Array.from(schemaTypes),
      ...this.extractDeliveryHeaders(response),
    };
  }

  private emptyPage(
    url: string,
    statusCode: number,
    loadTime: number,
    response: Response
  ): CrawlPage {
    return {
      url,
      title: "",
      description: "",
      h1: [],
      images: 0,
      internalLinks: [],
      externalLinks: [],
      statusCode,
      loadTime,
      hasCanonical: false,
      canonical: "",
      hasNoindex: false,
      hreflang: [],
      structuredData: [],
      headings: [],
      wordCount: 0,
      readabilityScore: 0,
      bodyText: "",
      pageSizeBytes: 0,
      imagesWithoutAlt: 0,
      imagesLazyLoaded: 0,
      scriptCount: 0,
      blockingScriptCount: 0,
      stylesheetCount: 0,
      inlineStyleCount: 0,
      hasViewportMeta: false,
      hasOpenGraph: false,
      hasTwitterCard: false,
      schemaTypes: [],
      ...this.extractDeliveryHeaders(response),
    };
  }

  private extractDeliveryHeaders(response: Response): Pick<
    CrawlPage,
    | "hasCacheControl"
    | "cacheControl"
    | "hasExpires"
    | "hasETag"
    | "isCompressed"
    | "contentEncoding"
    | "hasHsts"
  > {
    const cacheControl = response.headers.get("cache-control") || "";
    const contentEncoding = response.headers.get("content-encoding") || "";

    return {
      hasCacheControl: cacheControl.length > 0 && !/no-store|no-cache|max-age=0/i.test(cacheControl),
      cacheControl,
      hasExpires: Boolean(response.headers.get("expires")),
      hasETag: Boolean(response.headers.get("etag") || response.headers.get("last-modified")),
      isCompressed: /gzip|br|deflate|zstd/i.test(contentEncoding),
      contentEncoding,
      hasHsts: Boolean(response.headers.get("strict-transport-security")),
    };
  }

  private extractHreflang($: cheerio.CheerioAPI): string[] {
    return $('link[rel="alternate"][hreflang]')
      .map((_, element) => this.cleanText($(element).attr("hreflang") || ""))
      .get()
      .filter(Boolean);
  }

  private collectSchemaTypes(data: string, schemaTypes: Set<string>): void {
    try {
      const parsed = JSON.parse(data);
      const collect = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
          node.forEach(collect);
          return;
        }

        const record = node as Record<string, unknown>;
        const type = record["@type"];
        if (typeof type === "string") schemaTypes.add(type);
        if (Array.isArray(type)) {
          type.forEach((item) => typeof item === "string" && schemaTypes.add(item));
        }
        if (Array.isArray(record["@graph"])) record["@graph"].forEach(collect);
      };
      collect(parsed);
    } catch {
      // Invalid JSON-LD should not break crawling.
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          "user-agent": this.userAgent,
          ...(init.headers || {}),
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private resolveInternalUrl(href: string | undefined, baseUrl: string): string | undefined {
    const resolved = this.resolveUrl(href, baseUrl);
    if (!resolved || !this.isSameSite(resolved)) return undefined;
    return this.normalizeUrl(resolved);
  }

  private resolveUrl(href: string | undefined, baseUrl: string): string | undefined {
    if (!href) return undefined;
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith("#") || /^(mailto|tel|javascript):/i.test(trimmed)) {
      return undefined;
    }

    try {
      const parsed = new URL(trimmed, baseUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) return undefined;
      return parsed.href;
    } catch {
      return undefined;
    }
  }

  private normalizeUrl(url: string): string {
    const parsed = new URL(url);
    parsed.hash = "";

    for (const key of Array.from(parsed.searchParams.keys())) {
      if (/^(utm_|fbclid$|gclid$|msclkid$)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }

    if (parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }

    return parsed.href;
  }

  private isSameSite(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, "") === this.startUrl.hostname.replace(/^www\./, "");
    } catch {
      return false;
    }
  }

  private calculateCrawlDepth(): number {
    return this.pages.reduce((maxDepth, page) => {
      try {
        const depth = new URL(page.url).pathname.split("/").filter(Boolean).length;
        return Math.max(maxDepth, depth);
      } catch {
        return maxDepth;
      }
    }, 0);
  }

  private findOrphanPages(): string[] {
    const linkedPages = new Set<string>();
    this.pages.forEach((page) => page.internalLinks.forEach((link) => linkedPages.add(link)));
    return this.pages
      .filter((page) => !linkedPages.has(page.url) && new URL(page.url).pathname !== "/")
      .map((page) => page.url);
  }

  private findBrokenLinks(): string[] {
    return [
      ...this.pages.filter((page) => page.statusCode >= 400).map((page) => page.url),
      ...Array.from(this.failedUrls),
    ];
  }

  private findCanonicalIssues(): { page: string; issue: string }[] {
    return this.pages.flatMap((page) => {
      if (!page.hasCanonical) return [{ page: page.url, issue: "Missing canonical tag" }];
      if (page.canonical && !this.isSameSite(page.canonical)) {
        return [{ page: page.url, issue: "Canonical points to an external domain" }];
      }
      return [];
    });
  }

  private findDuplicateContentRisks(): { page1: string; page2: string; similarity: number }[] {
    const risks: { page1: string; page2: string; similarity: number }[] = [];

    for (let i = 0; i < this.pages.length; i++) {
      for (let j = i + 1; j < this.pages.length; j++) {
        const first = this.pages[i];
        const second = this.pages[j];
        const titleMatch = first.title && first.title === second.title ? 50 : 0;
        const descriptionMatch = first.description && first.description === second.description ? 50 : 0;
        const similarity = titleMatch + descriptionMatch;

        if (similarity >= 50) {
          risks.push({ page1: first.url, page2: second.url, similarity });
        }
      }
    }

    return risks;
  }

  private buildInternalLinkingGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    this.pages.forEach((page) => graph.set(page.url, page.internalLinks));
    return graph;
  }

  private estimatePerformance(): CrawlAnalysis["performance"] {
    const count = this.pages.length || 1;
    const avgPageSizeKb = this.average(this.pages.map((page) => page.pageSizeBytes)) / 1024;
    const avgLoad = this.average(this.pages.map((page) => page.loadTime));
    const avgBlocking = this.average(this.pages.map((page) => page.blockingScriptCount));
    const avgImages = this.average(this.pages.map((page) => page.images));
    const avgMissingAlt = this.average(this.pages.map((page) => page.imagesWithoutAlt));
    const avgScripts = this.average(this.pages.map((page) => page.scriptCount));

    const estLCP = Math.round((avgLoad / 1000 + avgPageSizeKb / 600 + avgBlocking * 0.25) * 100) / 100;
    const estCLS = Math.round(Math.min(0.4, avgImages * 0.004 + avgMissingAlt * 0.003) * 1000) / 1000;
    const estINP = Math.round(120 + avgScripts * 25 + avgBlocking * 40);

    const goodCount = [estLCP <= 2.5, estCLS <= 0.1, estINP <= 200].filter(Boolean).length;
    const rating: CrawlAnalysis["performance"]["rating"] =
      goodCount === 3 ? "good" : goodCount >= 1 ? "needs-improvement" : "poor";

    const pagesWithCacheControl = this.pages.filter((page) => page.hasCacheControl).length;
    const pagesCompressed = this.pages.filter((page) => page.isCompressed).length;
    const total = this.pages.length || count;
    const cachingNotes: string[] = [];

    if (pagesWithCacheControl < total) {
      cachingNotes.push(`${total - pagesWithCacheControl}/${total} page(s) lack effective Cache-Control headers.`);
    }
    if (pagesCompressed < total) {
      cachingNotes.push(`${total - pagesCompressed}/${total} page(s) were served without gzip/brotli compression.`);
    }

    return {
      avgPageSizeKb: Math.round(avgPageSizeKb),
      estLCP,
      estCLS,
      estINP,
      rating,
      totalImagesWithoutAlt: this.pages.reduce((sum, page) => sum + page.imagesWithoutAlt, 0),
      pagesWithBlockingScripts: this.pages.filter((page) => page.blockingScriptCount > 0).length,
      pagesMissingViewport: this.pages.filter((page) => !page.hasViewportMeta).length,
      pagesWithCacheControl,
      pagesCompressed,
      pagesWithETag: this.pages.filter((page) => page.hasETag).length,
      pagesWithHsts: this.pages.filter((page) => page.hasHsts).length,
      cachingNote: cachingNotes.length
        ? cachingNotes.join(" ")
        : "Caching and compression headers look healthy across crawled pages.",
    };
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

    for (const page of this.pages) {
      const path = new URL(page.url).pathname.toLowerCase();
      const text = `${page.title} ${page.description} ${page.h1.join(" ")}`.toLowerCase();

      if (path === "/" || path === "") pageTypes.homepage.push(page);
      else if (/category|categories|collections|shop/.test(path)) pageTypes.category.push(page);
      else if (/product|products|item|sku/.test(path)) pageTypes.product.push(page);
      else if (/service|services|solution|solutions/.test(path)) pageTypes.service.push(page);
      else if (/blog|article|news|guide|post/.test(path)) pageTypes.blog.push(page);
      else if (/faq|help|support/.test(path) || text.includes("frequently asked")) pageTypes.faq.push(page);
      else if (/contact|get-in-touch/.test(path)) pageTypes.contact.push(page);
      else if (/about|company|team/.test(path)) pageTypes.about.push(page);
      else pageTypes.other.push(page);
    }

    return pageTypes;
  }

  private average(values: number[]): number {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private cleanText(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }
}
