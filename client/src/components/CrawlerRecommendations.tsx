import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  CrawlerAuditReport,
  CrawlerRecommendation,
  CrawlerSeverity,
} from "@/lib/reportTypes";
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  ExternalLink,
  Wrench,
} from "lucide-react";

const severityStyles: Record<CrawlerSeverity, string> = {
  critical: "border-red-200 bg-red-100 text-red-700",
  high: "border-orange-200 bg-orange-100 text-orange-700",
  medium: "border-amber-200 bg-amber-100 text-amber-700",
  low: "border-slate-200 bg-slate-100 text-slate-700",
  info: "border-blue-200 bg-blue-100 text-blue-700",
};

const effortStyles: Record<CrawlerRecommendation["effort"], string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-purple-100 text-purple-700",
};

function Score({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-lg font-bold">{value}/100</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </Card>
  );
}

function RecommendationRow({
  recommendation,
  open,
  onToggle,
}: {
  recommendation: CrawlerRecommendation;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50"
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {recommendation.priority}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{recommendation.title}</span>
            <Badge
              variant="outline"
              className={severityStyles[recommendation.severity]}
            >
              {recommendation.severity}
            </Badge>
            <Badge variant="outline" className={effortStyles[recommendation.effort]}>
              {recommendation.effort} effort
            </Badge>
          </span>
          <span className="mt-2 block text-sm leading-6 text-muted-foreground">
            {recommendation.whatToFix}
          </span>
        </span>

        <ChevronDown
          className={`mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t bg-muted/30 px-4 py-5 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Wrench className="h-4 w-4 text-primary" />
                How to fix it
              </div>
              <ol className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                {recommendation.howToFix.map((step, index) => (
                  <li key={`${recommendation.issueId}-${index}`} className="flex gap-3">
                    <span className="font-semibold text-primary">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ExternalLink className="h-4 w-4 text-primary" />
                Affected URLs
              </div>

              {recommendation.affectedUrls.length > 0 ? (
                <div className="mt-3 max-h-44 space-y-2 overflow-auto">
                  {recommendation.affectedUrls.map((url) => (
                    <p
                      key={url}
                      className="break-all rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground"
                    >
                      {url}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  This is a site-wide finding rather than a URL-specific issue.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export function CrawlerRecommendations({
  report,
}: {
  report: CrawlerAuditReport | undefined;
}) {
  const [openPriority, setOpenPriority] = useState<number | null>(1);

  if (!report) {
    return (
      <Card className="p-8 text-center">
        <CircleAlert className="mx-auto h-8 w-8 text-muted-foreground" />
        <h3 className="mt-3 font-semibold">Actionable crawler recommendations are unavailable</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Run a new audit after updating the crawler package and server integration to see
          URL-level evidence and implementation steps here.
        </p>
      </Card>
    );
  }

  const counts = {
    critical: report.recommendations.filter((item) => item.severity === "critical").length,
    high: report.recommendations.filter((item) => item.severity === "high").length,
    medium: report.recommendations.filter((item) => item.severity === "medium").length,
    low: report.recommendations.filter(
      (item) => item.severity === "low" || item.severity === "info"
    ).length,
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
          <div>
            <h3 className="font-semibold">Crawler Recommendations</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Each recommendation is based on the crawl evidence and includes the exact
              implementation steps and affected pages.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            ["Critical", counts.critical],
            ["High", counts.high],
            ["Medium", counts.medium],
            ["Low", counts.low],
          ] as const).map(([label, count]) => (
            <div key={label} className="rounded-lg border bg-muted/30 p-3 text-center">
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-muted-foreground">{label} priority</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Score label="Technical" value={report.scores.technical} />
        <Score label="SEO" value={report.scores.seo} />
        <Score label="Content" value={report.scores.content} />
        <Score label="Performance" value={report.scores.performance} />
        <Score label="Accessibility" value={report.scores.accessibility} />
        <Score label="Security" value={report.scores.security} />
      </div>

      {report.recommendations.length > 0 ? (
        <div className="space-y-3">
          {report.recommendations.map((recommendation) => (
            <RecommendationRow
              key={recommendation.issueId}
              recommendation={recommendation}
              open={openPriority === recommendation.priority}
              onToggle={() =>
                setOpenPriority((current) =>
                  current === recommendation.priority ? null : recommendation.priority
                )
              }
            />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <h3 className="mt-3 font-semibold">No crawler issues were found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Continue validating priority pages with Google Search Console and real-user
            performance data.
          </p>
        </Card>
      )}

      {report.notes.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold">Audit notes</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            {report.notes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
