# @seo-geo/crawler

A lightweight crawler utility for SEO and Generative Engine Optimization (GEO) website analysis.

## Installation

```bash
npm install @seo-geo/crawler
```

## Usage

```ts
import { SiteCrawler } from "@seo-geo/crawler";

const crawler = new SiteCrawler("https://example.com", 50);
const result = await crawler.crawl();

console.log(result.pages);
console.log(result.errors);
```

## API

### `new SiteCrawler(startUrl, maxPages?)`

Creates a crawler for the provided website URL.

- `startUrl`: The starting URL to crawl.
- `maxPages`: Optional maximum number of internal pages to crawl. Defaults to `50`.

### `crawler.crawl()`

Returns a promise resolving to:

```ts
type CrawlResult = {
  startUrl: string;
  pages: CrawlPage[];
  errors: Array<{
    url: string;
    message: string;
  }>;
};
```

Each crawled page contains:

```ts
type CrawlPage = {
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
```

## License

MIT
