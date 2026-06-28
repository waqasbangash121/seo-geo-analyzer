import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Zap,
  Target,
  ArrowRight,
  Brain,
  Search,
  Globe,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { AuditReport, TechnicalAuditItem } from "@/lib/reportTypes";
import GeoReport from "@/components/GeoReport";
import ResearchReport from "@/components/ResearchReport";
import { ActionPlan } from "@/components/ActionPlan";
import { SchemaReport } from "@/components/SchemaReport";
import { ExecutiveSummary } from "@/components/ExecutiveSummary";
import { AuditHistory } from "@/components/AuditHistory";
import { useAuth } from "@/_core/hooks/useAuth";
import { exportJson, exportCsv, exportPdf } from "@/lib/exportReport";

const LOADING_STAGES = [
  "Crawling site & discovering pages...",
  "Running technical SEO checks...",
  "Analyzing GEO & AI visibility...",
  "Extracting entities & knowledge signals...",
  "Researching keywords & competitors...",
  "Compiling your report...",
];

export default function AuditPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AuditReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState(0);

  const analyzeMutation = trpc.audit.analyze.useMutation();
  const saveResultMutation = trpc.audit.saveResult.useMutation();
  const utils = trpc.useUtils();
  const { isAuthenticated } = useAuth();

  // Re-open a saved report from history without re-crawling.
  const handleOpenSaved = (report: AuditReport) => {
    setIsLoading(false);
    setResult(report);
    if (report?.url) setUrl(report.url);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("Please enter a valid URL");
      return;
    }

    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = "https://" + normalized;
    }

    setIsLoading(true);
    setResult(null);
    setStage(0);
    const stageTimer = setInterval(() => {
      setStage(s => Math.min(s + 1, LOADING_STAGES.length - 1));
    }, 4000);

    try {
      const response = await analyzeMutation.mutateAsync({ url: normalized });
      if (response.success) {
        const report = response.data as AuditReport;
        setResult(report);
        toast.success("Audit completed");

        // Persist to history for signed-in users (best-effort, non-blocking).
        if (isAuthenticated) {
          saveResultMutation.mutate(
            {
              url: report.url,
              domain: report.domain,
              overallScore: report.overallScore ?? 0,
              seoScore: report.seoScore ?? 0,
              geoScore: report.geoScore ?? 0,
              auditItems: (report.technicalAudit ||
                report.auditItems ||
                []) as unknown[],
              fullReport: report,
              pageTitle: report.title,
              pageDescription: report.description,
            },
            {
              onSuccess: () => utils.audit.getHistory.invalidate(),
              onError: () => {
                /* History save is best-effort; do not interrupt the user. */
              },
            }
          );
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Audit failed. Please try again."
      );
    } finally {
      clearInterval(stageTimer);
      setIsLoading(false);
    }
  };

  const auditItems: TechnicalAuditItem[] =
    result?.technicalAudit || result?.auditItems || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  SEO/GEO Analyzer
                </h1>
                <p className="text-sm text-muted-foreground">
                  Technical SEO · AI Visibility · Competitive Research
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AuditHistory
                isAuthenticated={isAuthenticated}
                onOpenReport={handleOpenSaved}
              />
              {result && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2 bg-card export-hide"
                    >
                      <Download className="w-4 h-4" /> Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => {
                        exportPdf();
                      }}
                      className="gap-2 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" /> PDF (print)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        exportCsv(result);
                        toast.success("CSV downloaded");
                      }}
                      className="gap-2 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4" /> CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        exportJson(result);
                        toast.success("JSON downloaded");
                      }}
                      className="gap-2 cursor-pointer"
                    >
                      <FileJson className="w-4 h-4" /> JSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-10">
        {/* URL Input Form */}
        <Card className="p-6 md:p-8 border border-border bg-card mb-8">
          <form onSubmit={handleAnalyze} className="space-y-3">
            <label className="block text-sm font-semibold text-foreground">
              Analyze any website
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="text"
                placeholder="example.com or https://example.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="flex-1 h-12 px-4 text-base"
                disabled={isLoading}
              />
              <Button
                type="submit"
                disabled={isLoading}
                className="h-12 px-7 font-semibold gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" /> Analyze
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              We crawl the site, run 30+ technical checks, score AI/GEO
              visibility, and research keywords & competitors.
            </p>
          </form>
        </Card>

        {/* Loading state */}
        {isLoading && (
          <Card className="p-10 border border-border bg-card flex flex-col items-center text-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-5" />
            <p className="text-base font-semibold text-foreground mb-2">
              {LOADING_STAGES[stage]}
            </p>
            <p className="text-sm text-muted-foreground">
              This deep analysis can take 30–90 seconds.
            </p>
            <Progress
              value={((stage + 1) / LOADING_STAGES.length) * 100}
              className="h-1.5 w-64 mt-5"
            />
          </Card>
        )}

        {/* Results */}
        {result && !isLoading && (
          <div className="space-y-8">
            {/* Score Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <ScoreCard
                label="Overall"
                value={result.overallScore}
                icon={TrendingUp}
                highlight
              />
              <ScoreCard label="SEO" value={result.seoScore} icon={Search} />
              <ScoreCard
                label="GEO / AI"
                value={result.geoScore}
                icon={Brain}
              />
              <ScoreCard
                label="Technical"
                value={result.technicalScore ?? result.seoScore}
                icon={Globe}
              />
              <ScoreCard
                label="Performance"
                value={result.performanceScore ?? 0}
                icon={Zap}
              />
            </div>

            {/* Page Info */}
            <Card className="p-6 border border-border bg-card">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <InfoBlock label="Domain" value={result.domain} />
                <InfoBlock
                  label="Pages Crawled"
                  value={String(result.crawlAnalysis?.totalPages ?? 1)}
                />
                <InfoBlock
                  label="Issues Found"
                  value={String(
                    result.summary?.issuesFound ?? auditItems.length
                  )}
                />
                <InfoBlock
                  label="Critical Issues"
                  value={String(result.summary?.criticalIssues ?? 0)}
                />
              </div>
            </Card>

            {/* Main Tabs */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 bg-muted/50 p-1 rounded-lg h-auto">
                <TabsTrigger value="overview" className="rounded-md">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="action" className="rounded-md">
                  Action Plan
                </TabsTrigger>
                <TabsTrigger value="technical" className="rounded-md">
                  Technical
                </TabsTrigger>
                <TabsTrigger value="geo" className="rounded-md">
                  GEO / AI
                </TabsTrigger>
                <TabsTrigger value="schema" className="rounded-md">
                  Schema
                </TabsTrigger>
                <TabsTrigger value="research" className="rounded-md">
                  Research
                </TabsTrigger>
              </TabsList>

              {/* OVERVIEW */}
              <TabsContent value="overview" className="mt-6 space-y-6">
                <ExecutiveSummary report={result} />
                <SummaryBar items={auditItems} />
                <PriorityActions
                  items={auditItems}
                  geoRecs={result.geo?.recommendations ?? []}
                />
              </TabsContent>

              {/* ACTION PLAN */}
              <TabsContent value="action" className="mt-6">
                <ActionPlan items={result.actionPlan ?? []} />
              </TabsContent>

              {/* TECHNICAL */}
              <TabsContent value="technical" className="mt-6">
                <TechnicalList
                  items={auditItems}
                  crawl={result.crawlAnalysis}
                />
              </TabsContent>

              {/* GEO */}
              <TabsContent value="geo" className="mt-6">
                {result.geo ? (
                  <GeoReport geo={result.geo} />
                ) : (
                  <EmptyNote text="GEO analysis was unavailable for this page." />
                )}
              </TabsContent>

              {/* SCHEMA */}
              <TabsContent value="schema" className="mt-6">
                {result.schema ? (
                  <SchemaReport schema={result.schema} />
                ) : (
                  <EmptyNote text="Schema analysis was unavailable for this page." />
                )}
              </TabsContent>

              {/* RESEARCH */}
              <TabsContent value="research" className="mt-6">
                {result.research ? (
                  <ResearchReport research={result.research} />
                ) : (
                  <EmptyNote text="Keyword & competitor research was unavailable for this page." />
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Empty State */}
        {!result && !isLoading && (
          <Card className="p-16 border border-border bg-card flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
              <Target className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              Ready to Analyze
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Enter any website URL to get a complete SEO & GEO audit —
              technical checks, AI visibility scoring, entity analysis, keyword
              opportunities, and competitor research.
            </p>
            <button
              onClick={() => {
                setUrl("https://www.smashingmagazine.com");
              }}
              className="text-sm text-primary font-medium mt-5 inline-flex items-center gap-1 hover:gap-2 transition-all"
            >
              Try a sample <ArrowRight className="w-4 h-4" />
            </button>
          </Card>
        )}
      </main>
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-error";
}

function ScoreCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: any;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`p-5 border bg-card ${highlight ? "border-primary/30 ring-1 ring-primary/10" : "border-border"}`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <Icon className="w-4 h-4 text-primary/40" />
      </div>
      <p className={`text-3xl font-bold ${scoreColor(value)}`}>{value}</p>
      <Progress value={value} className="h-1.5 mt-3" />
    </Card>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-sm text-foreground font-medium break-all">{value}</p>
    </div>
  );
}

function SummaryBar({ items }: { items: TechnicalAuditItem[] }) {
  const pass = items.filter(i => i.status === "pass").length;
  const warn = items.filter(i => i.status === "warning").length;
  const fail = items.filter(i => i.status === "fail").length;
  const stats = [
    { label: "Passed", value: pass, color: "text-success" },
    { label: "Warnings", value: warn, color: "text-warning" },
    { label: "Failed", value: fail, color: "text-error" },
    { label: "Total Checks", value: items.length, color: "text-primary" },
  ];
  return (
    <Card className="p-6 border border-border bg-card">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <div key={i}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {s.label}
            </p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PriorityActions({
  items,
  geoRecs,
}: {
  items: TechnicalAuditItem[];
  geoRecs: { priority: string; title: string; description: string }[];
}) {
  const failed = items
    .filter(i => i.status === "fail" || i.impact === "critical")
    .slice(0, 6);
  const highGeo = geoRecs.filter(r => r.priority === "high").slice(0, 4);
  if (failed.length === 0 && highGeo.length === 0) {
    return <EmptyNote text="No critical issues found. Great job!" />;
  }
  return (
    <Card className="p-6 border border-border bg-gradient-to-br from-primary/5 to-transparent">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Priority Action Items
      </h3>
      <div className="space-y-3">
        {failed.map(item => (
          <div
            key={item.id}
            className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border"
          >
            <AlertCircle className="w-4 h-4 text-error mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-foreground text-sm">
                {item.title}
              </h4>
              <p className="text-sm text-muted-foreground">
                {item.recommendation || item.description}
              </p>
            </div>
          </div>
        ))}
        {highGeo.map((rec, i) => (
          <div
            key={`geo-${i}`}
            className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border"
          >
            <Brain className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-foreground text-sm">
                {rec.title}
              </h4>
              <p className="text-sm text-muted-foreground">{rec.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TechnicalList({
  items,
  crawl,
}: {
  items: TechnicalAuditItem[];
  crawl?: AuditReport["crawlAnalysis"];
}) {
  const statusIcon = (status: string) => {
    if (status === "pass")
      return <CheckCircle2 className="w-5 h-5 text-success" />;
    if (status === "warning")
      return <AlertTriangle className="w-5 h-5 text-warning" />;
    return <AlertCircle className="w-5 h-5 text-error" />;
  };

  const perf = crawl?.performance;
  const cwvColor = (rating?: string) =>
    rating === "good"
      ? "text-success"
      : rating === "poor"
        ? "text-error"
        : "text-warning";
  return (
    <div className="space-y-6">
      {crawl && (
        <Card className="p-6 border border-border bg-card">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Crawl Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <InfoBlock label="Total Pages" value={String(crawl.totalPages)} />
            <InfoBlock label="Crawl Depth" value={String(crawl.crawlDepth)} />
            <InfoBlock
              label="Orphan Pages"
              value={String(crawl.orphanPages?.length ?? 0)}
            />
            <InfoBlock
              label="Broken Links"
              value={String(crawl.brokenLinks?.length ?? 0)}
            />
          </div>
        </Card>
      )}
      {perf && (
        <Card className="p-6 border border-border bg-card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-foreground">
              Core Web Vitals & Delivery
            </h3>
            <Badge
              variant="outline"
              className={`text-xs capitalize ${cwvColor(perf.rating)} border-current/20`}
            >
              {perf.rating}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <InfoBlock label="Est. LCP" value={`${perf.estLCP}s`} />
            <InfoBlock label="Est. CLS" value={String(perf.estCLS)} />
            <InfoBlock label="Est. INP" value={`${perf.estINP}ms`} />
            <InfoBlock
              label="Avg Page Size"
              value={`${perf.avgPageSizeKb}KB`}
            />
            <InfoBlock
              label="Cacheable Pages"
              value={`${perf.pagesWithCacheControl}/${crawl?.totalPages ?? 0}`}
            />
            <InfoBlock
              label="Compressed"
              value={`${perf.pagesCompressed}/${crawl?.totalPages ?? 0}`}
            />
            <InfoBlock
              label="ETag/Revalidate"
              value={`${perf.pagesWithETag}/${crawl?.totalPages ?? 0}`}
            />
            <InfoBlock
              label="HSTS"
              value={perf.pagesWithHsts > 0 ? "Yes" : "No"}
            />
          </div>
          {perf.cachingNote && (
            <p className="text-xs text-muted-foreground mt-4">
              {perf.cachingNote}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-2 italic">
            Core Web Vitals are heuristic estimates from payload, response time,
            and render-blocking resources — not Lighthouse field data.
          </p>
        </Card>
      )}
      <Card className="p-6 border border-border bg-card">
        <h3 className="text-lg font-semibold text-foreground mb-5">
          Technical SEO Checks
        </h3>
        <div className="space-y-3">
          {items.length === 0 ? (
            <EmptyNote text="No technical checks available." />
          ) : (
            items.map(item => (
              <div
                key={item.id}
                className="p-4 rounded-lg border border-border bg-background"
              >
                <div className="flex items-start gap-3">
                  {statusIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-semibold text-foreground">
                        {item.title}
                      </h4>
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${
                          item.status === "pass"
                            ? "bg-success/10 text-success border-success/20"
                            : item.status === "warning"
                              ? "bg-warning/10 text-warning border-warning/20"
                              : "bg-error/10 text-error border-error/20"
                        }`}
                      >
                        {item.status}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs capitalize bg-primary/5 text-primary border-primary/20"
                      >
                        {item.impact}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {item.description}
                    </p>
                    {item.recommendation && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-foreground">
                        <strong className="text-primary">
                          Recommendation:
                        </strong>{" "}
                        {item.recommendation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <Card className="p-10 border border-border bg-card">
      <p className="text-sm text-muted-foreground text-center">{text}</p>
    </Card>
  );
}
