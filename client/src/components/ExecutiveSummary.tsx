import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { AuditReport, TechnicalAuditItem } from "@/lib/reportTypes";
import { Award, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

function grade(score: number): { letter: string; label: string; color: string } {
  if (score >= 90) return { letter: "A", label: "Excellent", color: "text-success" };
  if (score >= 80) return { letter: "B", label: "Good", color: "text-success" };
  if (score >= 65) return { letter: "C", label: "Fair", color: "text-warning" };
  if (score >= 50) return { letter: "D", label: "Needs Work", color: "text-warning" };
  return { letter: "F", label: "Critical", color: "text-error" };
}

function barColor(score: number) {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-warning";
  return "bg-error";
}

export function ExecutiveSummary({ report }: { report: AuditReport }) {
  const g = grade(report.overallScore);
  const items: TechnicalAuditItem[] = report.technicalAudit || report.auditItems || [];

  const breakdown = [
    { label: "SEO Fundamentals", value: report.seoScore },
    { label: "Technical SEO", value: report.technicalScore ?? report.seoScore },
    { label: "GEO / AI Visibility", value: report.geoScore },
    { label: "AI Citation Potential", value: report.geo?.citationPotential ?? 0 },
    { label: "Performance", value: report.performanceScore ?? 0 },
  ];

  // Quick wins: low-effort, high/medium-impact action items
  const quickWins = (report.actionPlan ?? [])
    .filter((a) => a.effort === "low" && (a.priority === "high" || a.priority === "critical"))
    .slice(0, 5);

  const failed = items.filter((i) => i.status === "fail").length;
  const warnings = items.filter((i) => i.status === "warning").length;
  const passed = items.filter((i) => i.status === "pass").length;

  // Heuristic improvement potential: how many points to reach 90
  const potential = Math.max(0, 90 - report.overallScore);

  return (
    <Card className="p-6 md:p-8 border border-border bg-card">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Grade */}
        <div className="flex flex-col items-center justify-center text-center lg:border-r border-border lg:pr-8">
          <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-muted/40 mb-3">
            <span className={`text-5xl font-bold ${g.color}`}>{g.letter}</span>
            <Award className="absolute -top-1 -right-1 w-6 h-6 text-primary/40" />
          </div>
          <p className="text-3xl font-bold text-foreground">{report.overallScore}<span className="text-base text-muted-foreground">/100</span></p>
          <Badge variant="secondary" className="mt-2">{g.label}</Badge>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            ~{potential} pts to reach an "A"
          </p>
        </div>

        {/* Breakdown */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-base font-semibold text-foreground">Executive Summary</h3>
          <div className="space-y-3">
            {breakdown.map((b) => (
              <div key={b.label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{b.label}</span>
                  <span className="font-semibold text-foreground">{b.value}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${barColor(b.value)}`} style={{ width: `${b.value}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-foreground font-semibold">{passed}</span>
              <span className="text-muted-foreground">passed</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span className="text-foreground font-semibold">{warnings}</span>
              <span className="text-muted-foreground">warnings</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-error" />
              <span className="text-foreground font-semibold">{failed}</span>
              <span className="text-muted-foreground">failed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick wins */}
      {quickWins.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border">
          <h4 className="text-sm font-semibold text-foreground mb-3">Quick Wins (low effort, high impact)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {quickWins.map((w, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-success/5 border border-success/20">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">{w.title}</p>
                  <p className="text-xs text-muted-foreground">{w.expectedImpact}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
