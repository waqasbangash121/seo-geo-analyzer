import React from "react";
import { trpc } from "@/lib/trpc";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { History, Clock, ArrowRight, LogIn } from "lucide-react";
import type { AuditReport } from "@/lib/reportTypes";
import { getLoginUrl } from "@/const";

interface AuditHistoryProps {
  isAuthenticated: boolean;
  /** Called when the user picks a past audit to re-open. */
  onOpenReport: (report: AuditReport) => void;
}

function scoreBadgeClass(score: number) {
  if (score >= 80) return "bg-success/10 text-success border-success/20";
  if (score >= 60) return "bg-warning/10 text-warning border-warning/20";
  return "bg-error/10 text-error border-error/20";
}

export function AuditHistory({ isAuthenticated, onOpenReport }: AuditHistoryProps) {
  const [open, setOpen] = React.useState(false);

  // Only fetch when the sheet is open AND the user is authenticated, to avoid
  // unauthorized errors / unnecessary requests for anonymous visitors.
  const historyQuery = trpc.audit.getHistory.useQuery(undefined, {
    enabled: open && isAuthenticated,
    refetchOnWindowFocus: false,
  });

  const handleOpen = (report: AuditReport | null) => {
    if (!report) return;
    onOpenReport(report);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2 bg-card export-hide">
          <History className="w-4 h-4" /> History
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Audit History
          </SheetTitle>
          <SheetDescription>
            Re-open a past report instantly — no re-crawling required. Your last 50 audits are saved.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 mt-4 min-h-0">
          {!isAuthenticated ? (
            <div className="flex flex-col items-center justify-center text-center h-full px-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <LogIn className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">Sign in to save your audits</p>
              <p className="text-sm text-muted-foreground mb-5">
                Logged-in users get their full audit history saved automatically.
              </p>
              <Button asChild className="gap-2">
                <a href={getLoginUrl()}>
                  <LogIn className="w-4 h-4" /> Sign in
                </a>
              </Button>
            </div>
          ) : historyQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : historyQuery.error ? (
            <div className="text-center text-sm text-muted-foreground px-6 mt-10">
              Could not load history. Please try again.
            </div>
          ) : !historyQuery.data || historyQuery.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center h-full px-6">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">No saved audits yet</p>
              <p className="text-sm text-muted-foreground">
                Run an audit and it will be saved here automatically.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full pr-3">
              <div className="space-y-3">
                {historyQuery.data.map((item) => {
                  const report = (item.fullReport as AuditReport | null) ?? null;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleOpen(report)}
                      disabled={!report}
                      className="w-full text-left p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors group disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{item.domain}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.url}</p>
                          <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className={`text-xs ${scoreBadgeClass(item.overallScore)}`}>
                            {item.overallScore}
                          </Badge>
                          {report && (
                            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
                        <span>SEO {item.seoScore}</span>
                        <span>GEO {item.geoScore}</span>
                        {!report && <span className="text-warning">snapshot unavailable</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
