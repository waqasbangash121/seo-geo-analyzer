import * as cheerio from "cheerio";

export type CrawlPage = {
  url: string;
  status: number;
  title: string;
  description: string;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  links: string[];
  canonical?: string;
};

export type CrawlResult = {
  startUrl: string;
  pages: CrawlPage[];
  errors: Array<{
    url: string;
    message: string;
  }>;
};

export class SiteCrawler {
  private readonly startUrl: URL;
  private readonly maxPages: number;
  private readonly visited = new Set<string>();
  private readonly queue: string[] = [];

  constructor(startUrl: string, maxPages = 50) {
    this.startUrl = new URL(startUrl);
    this.maxPages = Math.max(1, maxPages);
    this.queue.push(this.normalizeUrl(this.startUrl.href));
  }

  async crawl(): Promise<CrawlResult> {
    const pages: CrawlPage[] = [];
    const errors: CrawlResult["errors"] = [];

    while (this.queue.length > 0 && pages.length < this.maxPages) {
      const nextUrl = this.queue.shift();
      if (!nextUrl || this.visited.has(nextUrl)) continue;

      this.visited.add(nextUrl);

      try {
        const page = await this.fetchPage(nextUrl);
        pages.push(page);

        for (const link of page.links) {
          if (pages.length + this.queue.length >= this.maxPages) break;
          if (!this.visited.has(link) && !this.queue.includes(link)) {
            this.queue.push(link);
          }
        }
      } catch (error) {
        errors.push({
          url: nextUrl,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      startUrl: this.startUrl.href,
      pages,
      errors,
    };
  }

  private async fetchPage(url: string): Promise<CrawlPage> {
    const response = await fetch(url, {
      headers: {
        "user-agent": "seo-geo-crawler/1.0 (+https://github.com/waqasbangash121/seo-geo-analyzer)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    const links = new Set<string>();

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");
      const normalized = this.resolveInternalUrl(href, url);
      if (normalized) links.add(normalized);
    });

    return {
      url,
      status: response.status,
      title: this.cleanText($("title").first().text()),
      description: this.cleanText($('meta[name="description"]').attr("content") ?? ""),
      canonical: this.resolveUrl($('link[rel="canonical"]').attr("href"), url),
      headings: {
        h1: this.extractTextList($, "h1"),
        h2: this.extractTextList($, "h2"),
        h3: this.extractTextList($, "h3"),
      },
      links: [...links],
    };
  }

  private extractTextList($: cheerio.CheerioAPI, selector: string): string[] {
    return $(selector)
      .map((_, element) => this.cleanText($(element).text()))
      .get()
      .filter(Boolean);
  }

  private resolveInternalUrl(href: string | undefined, baseUrl: string): string | undefined {
    const resolved = this.resolveUrl(href, baseUrl);
    if (!resolved) return undefined;

    const parsed = new URL(resolved);
    if (parsed.hostname !== this.startUrl.hostname) return undefined;
    if (!["http:", "https:"].includes(parsed.protocol)) return undefined;

    return this.normalizeUrl(parsed.href);
  }

  private resolveUrl(href: string | undefined, baseUrl: string): string | undefined {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return undefined;
    }

    try {
      return new URL(href, baseUrl).href;
    } catch {
      return undefined;
    }
  }

  private normalizeUrl(url: string): string {
    const parsed = new URL(url);
    parsed.hash = "";
    if (parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/$/, "");
    }
    return parsed.href;
  }

  private cleanText(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }
}
