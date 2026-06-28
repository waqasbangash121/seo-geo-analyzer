import { useState } from "react";
import { ActionItem } from "@/lib/reportTypes";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  Zap,
  Code2,
  FileText,
  Gauge,
  Sparkles,
  Wrench,
} from "lucide-react";

const priorityStyles: Record<ActionItem["priority"], string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const effortStyles: Record<ActionItem["effort"], string> = {
  low: "bg-green-100 text-green-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-purple-100 text-purple-700",
};

const categoryIcon: Record<ActionItem["category"], React.ReactNode> = {
  "Technical SEO": <Wrench className="h-4 w-4" />,
  "GEO / AI Visibility": <Sparkles className="h-4 w-4" />,
  Content: <FileText className="h-4 w-4" />,
  Schema: <Code2 className="h-4 w-4" />,
  Performance: <Gauge className="h-4 w-4" />,
};

export function ActionPlan({ items }: { items: ActionItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [filter, setFilter] = useState<string>("all");

  if (!items || items.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No action items generated. The site may already be well-optimized, or the
        analysis was limited.
      </Card>
    );
  }

  const categories = ["all", ...Array.from(new Set(items.map((i) => i.category)))];
  const filtered = filter === "all" ? items : items.filter((i) => i.category === filter);

  const counts = {
    critical: items.filter((i) => i.priority === "critical").length,
    high: items.filter((i) => i.priority === "high").length,
    medium: items.filter((i) => i.priority === "medium").length,
    low: items.filter((i) => i.priority === "low").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
        <Zap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h3 className="font-semibold">Prioritized Action Plan</h3>
          <p className="text-sm text-muted-foreground">
            {items.length} recommendations aggregated across technical SEO, GEO,
            schema, content, and performance — sorted by priority and effort.
            Start at the top for the highest impact-to-effort ratio.
          </p>
        </div>
      </div>

      {/* Priority summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["critical", "high", "medium", "low"] as const).map((p) => (
          <div key={p} className="rounded-lg border bg-card p-3 text-center">
            <div className="text-2xl font-bold">{counts[p]}</div>
            <div className="text-xs capitalize text-muted-foreground">{p} priority</div>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === c
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            {c === "all" ? "All" : c}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="space-y-2">
        {filtered.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <Card key={idx} className="overflow-hidden">
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50"
              >
                <span className="text-muted-foreground">{categoryIcon[item.category]}</span>
                <span className="flex-1 font-medium">{item.title}</span>
                <Badge variant="outline" className={priorityStyles[item.priority]}>
                  {item.priority}
                </Badge>
                <Badge variant="outline" className={effortStyles[item.effort]}>
                  {item.effort} effort
                </Badge>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="border-t bg-muted/30 px-4 py-3 text-sm">
                  <p className="mb-2 text-foreground">{item.details}</p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Expected impact:</span>{" "}
                    {item.expectedImpact}
                  </p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Category: {item.category}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
