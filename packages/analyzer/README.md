# @seo-geo/analyzer

Standalone SEO and GEO website analyzer for Node.js apps.

It crawls a website, checks technical SEO basics, reviews schema coverage, estimates performance signals, and returns a prioritized action plan.

## Install

```bash
pnpm add @seo-geo/analyzer
```

or:

```bash
npm install @seo-geo/analyzer
```

## Usage

```ts
import { analyzeWebsite } from "@seo-geo/analyzer";

const report = await analyzeWebsite({
  url: "https://example.com",
  maxPages: 25,
});

console.log(report.overallScore);
console.log(report.technicalAudit);
console.log(report.schema.recommendations);
console.log(report.actionPlan);
```

You can also use the shorter alias:

```ts
import { analyze } from "@seo-geo/analyzer";

const report = await analyze({ url: "https://example.com" });
```

## API

### `analyzeWebsite(options)`

```ts
type AnalyzeWebsiteOptions = {
  url: string;
  maxPages?: number;
  timeoutMs?: number;
  userAgent?: string;
};
```

Returns an `EnhancedAuditResult` with:

- `overallScore`
- `seoScore`
- `technicalScore`
- `performanceScore`
- `accessibilityScore`
- `crawlAnalysis`
- `technicalAudit`
- `schema`
- `actionPlan`
- `summary`

## Advanced usage

```ts
import { EnhancedAuditEngine, SiteCrawler, SchemaAuditEngine } from "@seo-geo/analyzer";

const engine = new EnhancedAuditEngine({ maxPages: 10 });
const result = await engine.performAudit("https://example.com");
```

## Build locally

```bash
pnpm --filter @seo-geo/analyzer build
```

## Publish

```bash
cd packages/analyzer
pnpm build
pnpm publish --access public
```

Make sure you are logged in first:

```bash
npm login
```

## Requirements

- Node.js 20+
- Publicly reachable website URL
