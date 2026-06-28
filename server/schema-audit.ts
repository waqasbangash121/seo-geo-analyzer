import { CrawlPage, CrawlAnalysis } from "./crawl";

export interface SchemaRecommendation {
  type: string;
  reason: string;
  priority: "high" | "medium" | "low";
  jsonLd: string;
}

export interface SchemaAuditResult {
  detectedTypes: string[];
  /** Schema types commonly expected for this kind of site but not found. */
  missingTypes: string[];
  pagesWithSchema: number;
  totalPages: number;
  coveragePercent: number;
  recommendations: SchemaRecommendation[];
}

/**
 * Derive a clean brand/site name from a raw page <title>.
 * Page titles often append separators and navigation fragments
 * (e.g. "Brand — Tagline | Clear Search Back to top"); this keeps only
 * the leading brand segment and strips common nav/boilerplate noise.
 */
export function cleanBrandName(rawTitle: string | undefined | null, fallback: string): string {
  if (!rawTitle) return fallback;
  // Take the segment before the first common title separator.
  let name = rawTitle.split(/\s*[|\u2013\u2014\-\u00b7:]\s*/)[0] ?? rawTitle;
  // Strip common navigation/boilerplate fragments that get concatenated
  // when a title is built from DOM text without spacing.
  name = name
    .replace(/\b(Clear Search|Back to top|Skip to content|Menu|Search|Home|Subscribe|Sign in|Log in|Newsletter)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Guard against over-trimming to an empty/too-short value.
  if (name.length < 2) return fallback;
  // Cap absurdly long titles.
  if (name.length > 80) name = name.slice(0, 80).trim();
  return name;
}

/**
 * Auditing schema.org / JSON-LD coverage across the crawled site and producing
 * copy-paste-ready JSON-LD recommendations for high-value missing types.
 */
export class SchemaAuditEngine {
  analyze(url: string, pages: CrawlPage[], analysis: CrawlAnalysis): SchemaAuditResult {
    const origin = (() => {
      try {
        return new URL(url).origin;
      } catch {
        return url;
      }
    })();
    const domain = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    })();
    const siteName = cleanBrandName(pages[0]?.title, domain);

    const detectedTypes = Array.from(
      new Set(pages.flatMap((p) => p.schemaTypes || []))
    );
    const pagesWithSchema = pages.filter(
      (p) => (p.schemaTypes?.length || 0) > 0
    ).length;
    const totalPages = pages.length || 1;
    const coveragePercent = Math.round((pagesWithSchema / totalPages) * 100);

    const has = (t: string) =>
      detectedTypes.some((d) => d.toLowerCase() === t.toLowerCase());

    const recommendations: SchemaRecommendation[] = [];
    const missingTypes: string[] = [];

    // Organization / WebSite — expected on virtually every site.
    if (!has("Organization")) {
      missingTypes.push("Organization");
      recommendations.push({
        type: "Organization",
        reason:
          "Establishes your brand entity for Google's Knowledge Graph and AI engines.",
        priority: "high",
        jsonLd: JSON.stringify(
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: siteName,
            url: origin,
            logo: `${origin}/logo.png`,
            sameAs: [
              "https://www.linkedin.com/company/your-company",
              "https://twitter.com/your-handle",
            ],
          },
          null,
          2
        ),
      });
    }

    if (!has("WebSite")) {
      missingTypes.push("WebSite");
      recommendations.push({
        type: "WebSite",
        reason:
          "Enables the sitelinks search box and clarifies site identity for crawlers.",
        priority: "medium",
        jsonLd: JSON.stringify(
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: siteName,
            url: origin,
            potentialAction: {
              "@type": "SearchAction",
              target: `${origin}/search?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          },
          null,
          2
        ),
      });
    }

    // BreadcrumbList — valuable when the site has depth.
    if (!has("BreadcrumbList") && analysis.crawlDepth >= 2) {
      missingTypes.push("BreadcrumbList");
      recommendations.push({
        type: "BreadcrumbList",
        reason:
          "Improves how URLs display in search results and helps crawlers understand hierarchy.",
        priority: "medium",
        jsonLd: JSON.stringify(
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: origin },
              {
                "@type": "ListItem",
                position: 2,
                name: "Category",
                item: `${origin}/category`,
              },
            ],
          },
          null,
          2
        ),
      });
    }

    // Article — recommended if a blog exists.
    if (!has("Article") && !has("BlogPosting") && analysis.pageTypes.blog.length > 0) {
      missingTypes.push("Article");
      recommendations.push({
        type: "Article",
        reason:
          "Blog/article pages were detected; Article schema boosts eligibility for rich results and AI citations.",
        priority: "high",
        jsonLd: JSON.stringify(
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "Your Article Title",
            author: { "@type": "Person", name: "Author Name" },
            publisher: {
              "@type": "Organization",
              name: siteName,
              logo: { "@type": "ImageObject", url: `${origin}/logo.png` },
            },
            datePublished: "2026-01-01",
            dateModified: "2026-01-01",
          },
          null,
          2
        ),
      });
    }

    // Product — recommended if products/shop detected.
    if (!has("Product") && analysis.pageTypes.product.length > 0) {
      missingTypes.push("Product");
      recommendations.push({
        type: "Product",
        reason:
          "Product/shop pages were detected; Product schema enables price, availability, and review rich results.",
        priority: "high",
        jsonLd: JSON.stringify(
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Product Name",
            description: "Product description",
            brand: { "@type": "Brand", name: siteName },
            offers: {
              "@type": "Offer",
              price: "0.00",
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
            },
          },
          null,
          2
        ),
      });
    }

    // LocalBusiness — recommended if a contact page exists.
    if (
      !has("LocalBusiness") &&
      analysis.pageTypes.contact.length > 0
    ) {
      missingTypes.push("LocalBusiness");
      recommendations.push({
        type: "LocalBusiness",
        reason:
          "A contact page was detected; LocalBusiness schema supports local SEO and map visibility.",
        priority: "medium",
        jsonLd: JSON.stringify(
          {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: siteName,
            url: origin,
            telephone: "+1-000-000-0000",
            address: {
              "@type": "PostalAddress",
              streetAddress: "123 Main St",
              addressLocality: "City",
              addressRegion: "State",
              postalCode: "00000",
              addressCountry: "US",
            },
          },
          null,
          2
        ),
      });
    }

    // FAQPage — recommended if FAQ page exists but no FAQ schema.
    if (!has("FAQPage") && analysis.pageTypes.faq.length > 0) {
      missingTypes.push("FAQPage");
      recommendations.push({
        type: "FAQPage",
        reason:
          "An FAQ page was detected without FAQ schema; adding it can win FAQ rich results.",
        priority: "high",
        jsonLd: JSON.stringify(
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Your question?",
                acceptedAnswer: { "@type": "Answer", text: "Your answer." },
              },
            ],
          },
          null,
          2
        ),
      });
    }

    return {
      detectedTypes,
      missingTypes,
      pagesWithSchema,
      totalPages: pages.length,
      coveragePercent,
      recommendations,
    };
  }
}
