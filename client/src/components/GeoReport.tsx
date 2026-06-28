import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Quote, Network, MessageSquare, Sparkles, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import type { GeoAnalysis } from "@/lib/reportTypes";

function scoreColor(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-error";
}

function statusIcon(status: string) {
  if (status === "pass") return <CheckCircle2 className="w-4 h-4 text-success" />;
  if (status === "warning") return <AlertTriangle className="w-4 h-4 text-warning" />;
  return <AlertCircle className="w-4 h-4 text-error" />;
}

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    high: "bg-error/10 text-error border-error/20",
    medium: "bg-warning/10 text-warning border-warning/20",
    low: "bg-muted text-muted-foreground border-border",
  };
  return map[priority] ?? map.low;
}

export default function GeoReport({ geo }: { geo: GeoAnalysis }) {
  const metrics = [
    { label: "AI Visibility", value: geo.aiVisibilityScore, icon: Brain },
    { label: "Citation Potential", value: geo.citationPotential, icon: Quote },
    { label: "Semantic Richness", value: geo.semanticRichness, icon: Sparkles },
    { label: "Direct Answer Readiness", value: geo.directAnswerReadiness, icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      {/* GEO Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <Card key={i} className="p-5 border border-border bg-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{m.label}</p>
              <m.icon className="w-4 h-4 text-primary/40" />
            </div>
            <p className={`text-3xl font-bold ${scoreColor(m.value)}`}>{m.value}</p>
            <Progress value={m.value} className="h-1.5 mt-3" />
          </Card>
        ))}
      </div>

      {/* GEO Category Breakdown */}
      <Card className="p-6 border border-border bg-card">
        <h3 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" /> Generative Engine Optimization Breakdown
        </h3>
        <div className="space-y-4">
          {geo.scores.map((s, i) => (
            <div key={i} className="p-4 rounded-lg border border-border bg-background">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {statusIcon(s.status)}
                  <h4 className="font-semibold text-foreground">{s.category}</h4>
                </div>
                <span className={`text-sm font-bold ${scoreColor((s.score / s.maxScore) * 100)}`}>
                  {s.score}/{s.maxScore}
                </span>
              </div>
              {s.findings.length > 0 && (
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5 mb-2">
                  {s.findings.map((f, j) => <li key={j}>{f}</li>)}
                </ul>
              )}
              {s.recommendations.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-md p-2.5 text-xs text-foreground">
                  <strong className="text-primary">Improve: </strong>
                  {s.recommendations.join(" ")}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Entities */}
      <Card className="p-6 border border-border bg-card">
        <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
          <Network className="w-5 h-5 text-primary" /> Entity Analysis
        </h3>
        <p className="text-sm text-muted-foreground mb-5">
          Entity density: <span className="font-semibold text-foreground">{geo.entityDensity}%</span> — entities help AI engines understand and cite your content.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <EntityColumn title="Primary Entities" tone="success" entities={geo.entities.primary} />
          <EntityColumn title="Supporting Entities" tone="primary" entities={geo.entities.supporting} />
          <EntityColumn title="Missing / Recommended" tone="error" entities={geo.entities.missing} />
        </div>
      </Card>

      {/* Knowledge Graph Signals */}
      {geo.knowledgeGraphSignals.length > 0 && (
        <Card className="p-6 border border-border bg-card">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Knowledge Graph Signals
          </h3>
          <div className="flex flex-wrap gap-2">
            {geo.knowledgeGraphSignals.map((sig, i) => (
              <Badge key={i} variant="outline" className="bg-primary/5 text-foreground border-primary/20">{sig}</Badge>
            ))}
          </div>
        </Card>
      )}

      {/* GEO Recommendations */}
      {geo.recommendations.length > 0 && (
        <Card className="p-6 border border-border bg-gradient-to-br from-primary/5 to-transparent">
          <h3 className="text-lg font-semibold text-foreground mb-4">GEO Action Items</h3>
          <div className="space-y-3">
            {geo.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                <Badge variant="outline" className={`capitalize ${priorityBadge(rec.priority)}`}>{rec.priority}</Badge>
                <div>
                  <h4 className="font-semibold text-foreground text-sm">{rec.title}</h4>
                  <p className="text-sm text-muted-foreground">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function EntityColumn({ title, tone, entities }: { title: string; tone: "success" | "primary" | "error"; entities: { name: string; type: string; mentions: number }[] }) {
  const toneMap = {
    success: "bg-success/10 text-success border-success/20",
    primary: "bg-primary/5 text-primary border-primary/20",
    error: "bg-error/10 text-error border-error/20",
  };
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title}</p>
      {entities.length === 0 ? (
        <p className="text-sm text-muted-foreground">None detected</p>
      ) : (
        <div className="space-y-2">
          {entities.map((e, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="text-sm text-foreground truncate">{e.name}</span>
              <Badge variant="outline" className={`text-[10px] shrink-0 ${toneMap[tone]}`}>{e.type}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
