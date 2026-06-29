# @waqashanifkhan/crawler

A TypeScript crawler and actionable SEO/GEO audit utility for public websites.

It can crawl internal HTML pages, inspect technical and on-page signals, then return a JSON-safe report with raw page data, prioritized issues, evidence, scores, and implementation steps.

## Installation

```bash
npm install @waqashanifkhan/crawler
```

## Crawl pages only

```ts
import { SiteCrawler } from "@waqashanifkhan/crawler";

const crawler = new SiteCrawler("https://example.com", {
  maxPages: 20,
  concurrency: 4,
  timeoutMs: 8_000,
});

const pages = await crawler.crawl();
const analysis = crawler.analyze();

console.log(pages);
console.log(analysis);
```

`crawl()` returns a `CrawlPage[]`. Each page includes its URL, status code, title, description, headings, links, canonical state, robots state, schema types, image accessibility data, delivery headers, and crawl timing.

## Run a full actionable audit

```ts
import { auditWebsite } from "@waqashanifkhan/crawler";

const report = await auditWebsite("example.com", {
  maxPages: 20,
  concurrency: 4,
  timeoutMs: 8_000,
  maxAffectedUrls: 20,
});

console.log(report.scores);
console.log(report.summary.topPriorities);
console.log(report.recommendations);
```

The audit report is JSON-safe and contains:

- `scores`: overall, technical, SEO, content, performance, accessibility, and security scores.
- `summary`: crawl totals, issue counts, and the top five priorities.
- `pages`: all crawled page-level data.
- `crawlAnalysis`: robots.txt, sitemap, internal-link graph, duplicate metadata risk, canonical issues, orphan pages, and crawl-based performance estimates.
- `issues`: grouped findings with severity, affected URLs, evidence, why the finding matters, and clear remediation steps.
- `recommendations`: the same issues sorted into an implementation priority order.
- `pageAudits`: each crawled URL with the related issues attached.

## Recommendation format

```ts
for (const recommendation of report.recommendations) {
  console.log(`#${recommendation.priority}: ${recommendation.title}`);
  console.log(recommendation.whatToFix);
  console.log(recommendation.howToFix);
}
```

## Notes and limitations

- Performance numbers are crawl-based estimates. Validate them with Lighthouse and real-user Core Web Vitals before making performance claims.
- The package reads the HTML returned to the crawler. Fully client-rendered, login-protected, or blocked pages may need browser-based testing too.
- Respect website terms, robots.txt, rate limits, and applicable law when crawling websites.

## License

MIT
