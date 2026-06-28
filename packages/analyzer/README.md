# @seo-geo/analyzer

Reusable SEO/GEO analysis package for pnpm workspace consumers.

## Usage inside another pnpm workspace project

Add the package to the consuming app:

```bash
pnpm add @seo-geo/analyzer@workspace:*
```

Then import the analyzer API:

```ts
import { analyzeWebsite } from "@seo-geo/analyzer";

const report = await analyzeWebsite({
  url: "https://example.com",
});

console.log(report.overallScore);
console.log(report.technicalAudit);
```

## Available exports

- `analyzeWebsite`
- `EnhancedAuditEngine`
- `SiteCrawler`
- `GeoAnalyzer`
- `ResearchEngine`
- `SchemaAuditEngine`
- `buildActionPlan`

## Notes

This package currently exposes the existing analyzer implementation through a workspace package facade. The next refactor step should move the analyzer source files fully into this package so it can be published independently outside the monorepo.
