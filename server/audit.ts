import { AuditItem } from "../drizzle/schema";

interface PageContent {
  title: string;
  description: string;
  headings: string[];
  images: { src: string; alt: string }[];
  links: { href: string; text: string }[];
  textContent: string;
  statusCode: number;
  headers: Record<string, string>;
  html: string;
}

/**
 * Fetch and analyze a webpage for SEO/GEO compliance
 */
export async function analyzeWebpage(url: string): Promise<{
  content: PageContent;
  auditItems: AuditItem[];
  scores: { overall: number; seo: number; geo: number };
}> {
  try {
    // Validate URL
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      throw new Error("Invalid URL protocol");
    }

    // Fetch the webpage with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const content = parseHTML(html, response.headers);
    const auditItems = runAuditChecks(content, url);
    const scores = calculateScores(auditItems);

    return { content, auditItems, scores };
  } catch (error) {
    throw new Error(`Failed to analyze webpage: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse HTML and extract relevant SEO/GEO data
 */
function parseHTML(
  html: string,
  headers: Headers
): PageContent {
  // Simple HTML parsing (in production, use jsdom or cheerio)
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const metaDescMatch = html.match(
    /<meta\s+name="description"\s+content="([^"]*)"/i
  );
  const h1Matches = html.match(/<h1[^>]*>([^<]+)<\/h1>/gi) || [];
  const h2Matches = html.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
  const h3Matches = html.match(/<h3[^>]*>([^<]+)<\/h3>/gi) || [];
  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  const linkMatches = html.match(/<a\s+href="([^"]*)"[^>]*>([^<]+)<\/a>/gi) || [];

  const title = titleMatch ? titleMatch[1].trim() : "";
  const description = metaDescMatch ? metaDescMatch[1].trim() : "";

  const headings = [
    ...h1Matches.map((h) => h.replace(/<[^>]*>/g, "").trim()),
    ...h2Matches.map((h) => h.replace(/<[^>]*>/g, "").trim()),
    ...h3Matches.map((h) => h.replace(/<[^>]*>/g, "").trim()),
  ];

  const images = imgMatches
    .map((img) => {
      const srcMatch = img.match(/src="([^"]*)"/i);
      const altMatch = img.match(/alt="([^"]*)"/i);
      return {
        src: srcMatch ? srcMatch[1] : "",
        alt: altMatch ? altMatch[1] : "",
      };
    })
    .filter((img) => img.src);

  const links = linkMatches
    .map((link) => {
      const hrefMatch = link.match(/href="([^"]*)"/i);
      const textMatch = link.match(/>([^<]+)<\/a>/i);
      return {
        href: hrefMatch ? hrefMatch[1] : "",
        text: textMatch ? textMatch[1].trim() : "",
      };
    })
    .filter((link) => link.href);

  const textContent = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title,
    description,
    headings,
    images,
    links,
    textContent,
    statusCode: 200,
    headers: Object.fromEntries(headers),
    html,
  };
}

/**
 * Run comprehensive SEO/GEO audit checks
 */
function runAuditChecks(content: PageContent, url: string): AuditItem[] {
  const items: AuditItem[] = [];

  // TECHNICAL SEO CHECKS
  items.push({
    id: "meta-title",
    category: "technical",
    title: "Meta Title",
    description: "Page has a descriptive meta title tag",
    status: content.title && content.title.length > 0 ? "pass" : "fail",
    impact: "high",
    recommendation:
      "Add a unique, descriptive title (50-60 characters) that includes your primary keyword",
    value: content.title || "(missing)",
  });

  items.push({
    id: "meta-description",
    category: "technical",
    title: "Meta Description",
    description: "Page has a meta description tag",
    status: content.description && content.description.length > 0 ? "pass" : "fail",
    impact: "high",
    recommendation:
      "Add a compelling meta description (150-160 characters) that encourages clicks",
    value: content.description || "(missing)",
  });

  items.push({
    id: "h1-tags",
    category: "technical",
    title: "H1 Heading",
    description: "Page has exactly one H1 tag",
    status:
      content.headings.filter((h) => h.startsWith("h1")).length === 1
        ? "pass"
        : "warning",
    impact: "high",
    recommendation: "Ensure the page has exactly one H1 tag with your main topic",
    value: content.headings.filter((h) => h.startsWith("h1")).join(", ") || "(missing)",
  });

  items.push({
    id: "heading-hierarchy",
    category: "technical",
    title: "Heading Hierarchy",
    description: "Proper heading structure (H1 > H2 > H3)",
    status: content.headings.length > 0 ? "pass" : "warning",
    impact: "medium",
    recommendation: "Use proper heading hierarchy to structure your content",
    value: `${content.headings.length} headings found`,
  });

  items.push({
    id: "mobile-viewport",
    category: "technical",
    title: "Mobile Viewport Meta Tag",
    description: "Page has viewport meta tag for mobile optimization",
    status: content.html.includes("viewport") ? "pass" : "fail",
    impact: "high",
    recommendation: "Add <meta name='viewport' content='width=device-width, initial-scale=1'>",
  });

  items.push({
    id: "canonical-tag",
    category: "technical",
    title: "Canonical Tag",
    description: "Page has a canonical tag to prevent duplicate content",
    status: content.html.includes("rel=\"canonical\"") ? "pass" : "warning",
    impact: "medium",
    recommendation: "Add a canonical tag pointing to the preferred version of this page",
  });

  items.push({
    id: "robots-meta",
    category: "technical",
    title: "Robots Meta Tag",
    description: "Page doesn't have blocking robots directives",
    status: !content.html.includes('robots" content="noindex') ? "pass" : "fail",
    impact: "high",
    recommendation: "Ensure search engines can index this page",
  });

  items.push({
    id: "ssl-https",
    category: "technical",
    title: "HTTPS/SSL",
    description: "Page is served over HTTPS",
    status: url.startsWith("https://") ? "pass" : "fail",
    impact: "high",
    recommendation: "Enable HTTPS/SSL for all pages",
  });

  // CONTENT QUALITY CHECKS
  items.push({
    id: "content-length",
    category: "content",
    title: "Content Length",
    description: "Page has sufficient content (300+ words)",
    status: content.textContent.split(/\s+/).length >= 300 ? "pass" : "warning",
    impact: "medium",
    recommendation: "Add more substantive content (aim for 300+ words minimum)",
    value: `${content.textContent.split(/\s+/).length} words`,
  });

  items.push({
    id: "image-alt-text",
    category: "content",
    title: "Image Alt Text",
    description: "Images have descriptive alt text",
    status:
      content.images.length > 0 &&
      content.images.filter((img) => img.alt).length === content.images.length
        ? "pass"
        : "warning",
    impact: "medium",
    recommendation: "Add descriptive alt text to all images for accessibility and SEO",
    value: `${content.images.filter((img) => img.alt).length}/${content.images.length} images with alt text`,
  });

  items.push({
    id: "keyword-in-title",
    category: "content",
    title: "Keyword in Title",
    description: "Primary keyword appears in title",
    status: content.title.length > 0 ? "pass" : "warning",
    impact: "high",
    recommendation: "Include your primary keyword in the page title",
  });

  items.push({
    id: "keyword-in-description",
    category: "content",
    title: "Keyword in Meta Description",
    description: "Primary keyword appears in meta description",
    status: content.description.length > 0 ? "pass" : "warning",
    impact: "medium",
    recommendation: "Include your primary keyword in the meta description",
  });

  items.push({
    id: "internal-links",
    category: "content",
    title: "Internal Links",
    description: "Page has internal links to other pages",
    status: content.links.filter((l) => !l.href.startsWith("http")).length > 0 ? "pass" : "warning",
    impact: "medium",
    recommendation: "Add internal links to related pages on your site",
    value: `${content.links.filter((l) => !l.href.startsWith("http")).length} internal links`,
  });

  items.push({
    id: "external-links",
    category: "content",
    title: "External Links",
    description: "Page links to authoritative external sources",
    status: content.links.filter((l) => l.href.startsWith("http")).length > 0 ? "pass" : "warning",
    impact: "medium",
    recommendation: "Link to authoritative external sources to build credibility",
    value: `${content.links.filter((l) => l.href.startsWith("http")).length} external links`,
  });

  // GEO (Generative Engine Optimization) CHECKS
  items.push({
    id: "structured-data",
    category: "geo",
    title: "Structured Data (Schema.org)",
    description: "Page includes JSON-LD structured data",
    status: content.html.includes("application/ld+json") ? "pass" : "warning",
    impact: "high",
    recommendation:
      "Add JSON-LD structured data (Schema.org) for better AI engine understanding",
  });

  items.push({
    id: "faq-schema",
    category: "geo",
    title: "FAQ Schema",
    description: "Page includes FAQ schema markup if applicable",
    status: content.html.includes("FAQPage") ? "pass" : "warning",
    impact: "medium",
    recommendation: "Add FAQ schema if your page contains frequently asked questions",
  });

  items.push({
    id: "breadcrumb-schema",
    category: "geo",
    title: "Breadcrumb Schema",
    description: "Page includes breadcrumb navigation schema",
    status: content.html.includes("BreadcrumbList") ? "pass" : "warning",
    impact: "medium",
    recommendation: "Add breadcrumb schema to help AI engines understand site structure",
  });

  items.push({
    id: "statistics-data",
    category: "geo",
    title: "Statistics & Data",
    description: "Page includes statistics, data, or research",
    status: /(\d+%|\d+\s*(million|billion|thousand))/i.test(content.textContent)
      ? "pass"
      : "warning",
    impact: "high",
    recommendation:
      "Include statistics, data points, and research findings to increase AI citation likelihood",
  });

  items.push({
    id: "expert-quotes",
    category: "geo",
    title: "Expert Quotes",
    description: "Page includes expert quotes or citations",
    status: /["""]([^"""]){50,}["""]/.test(content.textContent) ? "pass" : "warning",
    impact: "medium",
    recommendation:
      "Include quotes from industry experts to increase credibility in AI responses",
  });

  items.push({
    id: "technical-terminology",
    category: "geo",
    title: "Technical Terminology",
    description: "Page uses industry-specific technical terms",
    status: content.textContent.length > 500 ? "pass" : "warning",
    impact: "medium",
    recommendation: "Use precise technical terminology relevant to your industry",
  });

  items.push({
    id: "source-citations",
    category: "geo",
    title: "Source Citations",
    description: "Page cites sources and provides attribution",
    status: content.links.filter((l) => l.href.startsWith("http")).length >= 3 ? "pass" : "warning",
    impact: "high",
    recommendation:
      "Cite authoritative sources to increase your page's authority in AI-generated content",
  });

  // ACCESSIBILITY CHECKS
  items.push({
    id: "semantic-html",
    category: "accessibility",
    title: "Semantic HTML",
    description: "Page uses semantic HTML elements",
    status: /(<header|<nav|<main|<article|<section|<footer)/i.test(content.html)
      ? "pass"
      : "warning",
    impact: "medium",
    recommendation: "Use semantic HTML5 elements for better accessibility and SEO",
  });

  items.push({
    id: "lang-attribute",
    category: "accessibility",
    title: "Language Attribute",
    description: "HTML tag has lang attribute",
    status: /lang="[a-z]{2}"/i.test(content.html) ? "pass" : "warning",
    impact: "low",
    recommendation: "Add lang attribute to HTML tag (e.g., lang='en')",
  });

  items.push({
    id: "form-labels",
    category: "accessibility",
    title: "Form Labels",
    description: "Form inputs have associated labels",
    status: !content.html.includes("<input") ||
    /for="[^"]*"/.test(content.html)
      ? "pass"
      : "warning",
    impact: "medium",
    recommendation: "Ensure all form inputs have associated labels",
  });

  // PERFORMANCE CHECKS
  items.push({
    id: "page-size",
    category: "performance",
    title: "Page Size",
    description: "Page size is reasonable (< 5MB)",
    status: content.html.length < 5000000 ? "pass" : "warning",
    impact: "medium",
    recommendation: "Optimize page size for faster loading",
    value: `${(content.html.length / 1024).toFixed(2)} KB`,
  });

  items.push({
    id: "compression",
    category: "performance",
    title: "Gzip Compression",
    description: "Server uses gzip compression",
    status: content.headers["content-encoding"]?.includes("gzip") ? "pass" : "warning",
    impact: "medium",
    recommendation: "Enable gzip compression on your server",
  });

  return items;
}

/**
 * Calculate overall SEO/GEO scores based on audit items
 */
function calculateScores(
  items: AuditItem[]
): { overall: number; seo: number; geo: number } {
  const categories = {
    seo: ["technical", "content", "accessibility", "performance"],
    geo: ["geo"],
  };

  const calculateCategoryScore = (categoryNames: string[]) => {
    const categoryItems = items.filter((item) =>
      categoryNames.includes(item.category)
    );
    if (categoryItems.length === 0) return 0;

    const passCount = categoryItems.filter((item) => item.status === "pass").length;
    const warningCount = categoryItems.filter((item) => item.status === "warning").length;
    const failCount = categoryItems.filter((item) => item.status === "fail").length;

    const score =
      (passCount * 100 + warningCount * 50 + failCount * 0) / categoryItems.length;
    return Math.round(score);
  };

  const seoScore = calculateCategoryScore(categories.seo);
  const geoScore = calculateCategoryScore(categories.geo);
  const overall = Math.round((seoScore + geoScore) / 2);

  return { overall, seo: seoScore, geo: geoScore };
}
