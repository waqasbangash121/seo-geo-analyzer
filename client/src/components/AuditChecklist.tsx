import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

interface AuditItem {
  id: string;
  title: string;
  description: string;
  status: "pass" | "warning" | "fail";
  impact: "high" | "medium" | "low";
  recommendation: string;
  expanded?: boolean;
}

const auditItems: AuditItem[] = [
  {
    id: "metadata",
    title: "Next.js Metadata API",
    description: "Page uses createPageMetadata with clear title and description.",
    status: "pass",
    impact: "high",
    recommendation: "Already optimized. Maintain current implementation.",
  },
  {
    id: "structured-data",
    title: "JSON-LD Schema Implementation",
    description: "SoftwareApplication and FAQPage schemas are correctly implemented.",
    status: "pass",
    impact: "high",
    recommendation: "Add AggregateRating schema once you have customer reviews.",
  },
  {
    id: "semantic-html",
    title: "Semantic HTML Structure",
    description: "Proper heading hierarchy and semantic elements detected.",
    status: "pass",
    impact: "medium",
    recommendation: "Continue using semantic HTML for all new content.",
  },
  {
    id: "performance",
    title: "Core Web Vitals",
    description: "Dynamic imports and next/image optimization in place.",
    status: "pass",
    impact: "high",
    recommendation: "Monitor LCP, FID, and CLS metrics regularly.",
  },
  {
    id: "geo-content",
    title: "GEO-Specific Content",
    description: "Content lacks citation-worthy elements (statistics, expert quotes).",
    status: "warning",
    impact: "high",
    recommendation: "Inject 3-5 verified statistics and add expert quotes to key sections.",
  },
  {
    id: "entity-linking",
    title: "Entity Recognition",
    description: "Schema missing sameAs links to social profiles and authoritative directories.",
    status: "warning",
    impact: "medium",
    recommendation: "Add sameAs links to LinkedIn, Crunchbase, and GitHub in schema.",
  },
  {
    id: "internal-linking",
    title: "Internal Linking Strategy",
    description: "Single-page structure detected. No supporting blog posts or documentation.",
    status: "fail",
    impact: "high",
    recommendation: "Create 3 supporting blog posts to build topical authority.",
  },
  {
    id: "backlinks",
    title: "Backlink Profile",
    description: "Limited external references and citations detected.",
    status: "warning",
    impact: "high",
    recommendation: "Get listed on AI tool directories and Shopify App Store.",
  },
  {
    id: "mobile-optimization",
    title: "Mobile Responsiveness",
    description: "Layout is responsive across all device sizes.",
    status: "pass",
    impact: "medium",
    recommendation: "Continue testing on various devices and screen sizes.",
  },
  {
    id: "page-speed",
    title: "Page Load Speed",
    description: "Average load time is 2.3 seconds on 4G connection.",
    status: "warning",
    impact: "medium",
    recommendation: "Optimize images and implement lazy loading for below-the-fold content.",
  },
  {
    id: "ssl-security",
    title: "SSL/HTTPS Security",
    description: "Site is served over HTTPS with valid SSL certificate.",
    status: "pass",
    impact: "high",
    recommendation: "Maintain SSL certificate and monitor for expiration.",
  },
  {
    id: "robots-sitemap",
    title: "Robots.txt & Sitemap",
    description: "Robots.txt and XML sitemap are properly configured.",
    status: "pass",
    impact: "medium",
    recommendation: "Update sitemap when adding new pages or content.",
  },
  {
    id: "open-graph",
    title: "Open Graph & Social Meta",
    description: "OG tags are implemented for social sharing.",
    status: "pass",
    impact: "low",
    recommendation: "Test social sharing on various platforms.",
  },
  {
    id: "structured-faq",
    title: "FAQ Schema Markup",
    description: "FAQPage schema is correctly implemented and structured.",
    status: "pass",
    impact: "medium",
    recommendation: "Expand FAQ section with more common questions.",
  },
  {
    id: "keyword-optimization",
    title: "Keyword Optimization",
    description: "Primary keywords are present but could be more strategically placed.",
    status: "warning",
    impact: "medium",
    recommendation: "Optimize H2 and H3 headings with target keywords.",
  },
  {
    id: "content-freshness",
    title: "Content Freshness",
    description: "Page lacks 'last updated' date and version history.",
    status: "warning",
    impact: "low",
    recommendation: "Add lastModified date to metadata and display on page.",
  },
  {
    id: "canonical-tags",
    title: "Canonical Tags",
    description: "Canonical tag is properly set to prevent duplicate content issues.",
    status: "pass",
    impact: "medium",
    recommendation: "Maintain canonical tags for all pages.",
  },
  {
    id: "alt-text",
    title: "Image Alt Text",
    description: "All images have descriptive alt text for accessibility.",
    status: "pass",
    impact: "medium",
    recommendation: "Continue adding descriptive alt text to all images.",
  },
  {
    id: "heading-hierarchy",
    title: "Heading Hierarchy",
    description: "H1, H2, H3 hierarchy is properly structured.",
    status: "pass",
    impact: "medium",
    recommendation: "Maintain proper heading hierarchy for new content.",
  },
  {
    id: "call-to-action",
    title: "Call-to-Action Clarity",
    description: "CTAs are clear and action-oriented but could be more prominent.",
    status: "warning",
    impact: "low",
    recommendation: "Test different CTA placements and messaging for higher conversion.",
  },
  {
    id: "schema-validation",
    title: "Schema Validation",
    description: "All schema markup passes Google's Rich Results Test.",
    status: "pass",
    impact: "high",
    recommendation: "Regularly validate schema using Google's testing tools.",
  },
  {
    id: "accessibility",
    title: "WCAG Accessibility",
    description: "Page meets WCAG 2.1 AA accessibility standards.",
    status: "pass",
    impact: "medium",
    recommendation: "Continue following accessibility best practices.",
  },
  {
    id: "meta-description",
    title: "Meta Description",
    description: "Meta description is 160 characters and keyword-rich.",
    status: "pass",
    impact: "medium",
    recommendation: "Keep meta descriptions between 150-160 characters.",
  },
  {
    id: "url-structure",
    title: "URL Structure",
    description: "URL is clean, descriptive, and SEO-friendly.",
    status: "pass",
    impact: "low",
    recommendation: "Use hyphens to separate words in URLs.",
  },
];

export default function AuditChecklist() {
  const [items, setItems] = useState<AuditItem[]>(auditItems);

  const toggleExpand = (id: string) => {
    setItems(items.map((item) => (item.id === id ? { ...item, expanded: !item.expanded } : item)));
  };

  const passCount = items.filter((i) => i.status === "pass").length;
  const warningCount = items.filter((i) => i.status === "warning").length;
  const failCount = items.filter((i) => i.status === "fail").length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "fail":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "bg-red-500/20 text-red-300";
      case "medium":
        return "bg-yellow-500/20 text-yellow-300";
      case "low":
        return "bg-blue-500/20 text-blue-300";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Passed</p>
              <p className="text-2xl font-bold font-mono text-foreground">{passCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-500" />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Warnings</p>
              <p className="text-2xl font-bold font-mono text-foreground">{warningCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-500" />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Failed</p>
              <p className="text-2xl font-bold font-mono text-foreground">{failCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Audit Items */}
      <div className="space-y-3">
        {items.map((item) => (
          <Card
            key={item.id}
            className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 overflow-hidden"
          >
            <button
              onClick={() => toggleExpand(item.id)}
              className="w-full p-4 flex items-start justify-between hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-start gap-4 flex-1 text-left">
                {getStatusIcon(item.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                    <Badge variant="outline" className={`text-xs ${getImpactColor(item.impact)}`}>
                      {item.impact}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
              {item.expanded ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
            </button>

            {item.expanded && (
              <div className="px-4 pb-4 border-t border-border/30 bg-primary/5">
                <div className="mt-4">
                  <p className="text-sm font-medium text-foreground mb-2">Recommendation:</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.recommendation}</p>
                </div>
                {item.status !== "pass" && (
                  <Button size="sm" className="mt-4 gap-2" variant="outline">
                    View Details
                  </Button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
