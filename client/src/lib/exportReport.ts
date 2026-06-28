import type { AuditReport, TechnicalAuditItem } from "@/lib/reportTypes";

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function exportJson(report: AuditReport) {
  triggerDownload(
    JSON.stringify(report, null, 2),
    `${report.domain}-seo-geo-audit.json`,
    "application/json",
  );
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportCsv(report: AuditReport) {
  const rows: string[][] = [];
  rows.push(["Section", "Item", "Status / Detail", "Impact / Priority", "Recommendation"]);

  // Scores
  rows.push(["Scores", "Overall", String(report.overallScore), "", ""]);
  rows.push(["Scores", "SEO", String(report.seoScore), "", ""]);
  rows.push(["Scores", "GEO / AI", String(report.geoScore), "", ""]);
  rows.push(["Scores", "Technical", String(report.technicalScore ?? ""), "", ""]);
  rows.push(["Scores", "Performance", String(report.performanceScore ?? ""), "", ""]);

  // Technical checks
  const items: TechnicalAuditItem[] = report.technicalAudit || report.auditItems || [];
  items.forEach((i) => {
    rows.push(["Technical SEO", i.title, i.status, i.impact ?? "", i.recommendation ?? i.description ?? ""]);
  });

  // Action plan
  (report.actionPlan ?? []).forEach((a) => {
    rows.push(["Action Plan", a.title, a.category, a.priority, a.details]);
  });

  // Keywords
  report.research?.keywords?.forEach((k) => {
    rows.push([
      "Keyword (AI estimate)",
      k.keyword,
      `vol≈${k.estimatedVolume ?? ""}, diff≈${k.difficulty ?? ""}`,
      k.intent ?? "",
      `opportunity≈${k.opportunityScore ?? ""}`,
    ]);
  });

  // Competitors
  report.research?.competitors?.forEach((c) => {
    rows.push([
      "Competitor (AI estimate)",
      c.name ?? c.domain ?? "",
      `authority≈${c.estimatedAuthority ?? ""}`,
      "",
      (c.keyAdvantages ?? []).join("; "),
    ]);
  });

  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  triggerDownload(csv, `${report.domain}-seo-geo-audit.csv`, "text/csv");
}

export function exportPdf() {
  // Uses the browser's native print-to-PDF. A print stylesheet keeps the
  // report readable and hides interactive chrome.
  window.print();
}
