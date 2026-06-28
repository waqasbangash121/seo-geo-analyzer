/**
 * Pure, DB-independent helpers for audit-history persistence.
 * Kept separate from the tRPC router so the serialization/round-trip logic
 * is unit-testable without standing up a database or mocking Drizzle.
 */

export function safeParse<T>(value: string | null | undefined, fallback: T): T {
  if (value == null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export interface HistoryReportInput {
  url: string;
  domain: string;
  overallScore?: number;
  seoScore?: number;
  geoScore?: number;
  technicalAudit?: unknown[];
  auditItems?: unknown[];
  title?: string;
  description?: string;
}

export interface HistoryRowInsert {
  url: string;
  domain: string;
  overallScore: number;
  seoScore: number;
  geoScore: number;
  auditItems: string;
  fullReport: string | null;
  pageTitle?: string;
  pageDescription?: string;
}

/**
 * Map a completed audit report into the exact row shape we persist.
 * Scores are rounded to integers (the DB columns are ints); JSON fields
 * are stringified; audit items fall back across the two possible field names.
 */
export function buildHistoryRow(report: HistoryReportInput): HistoryRowInsert {
  const items = report.technicalAudit ?? report.auditItems ?? [];
  return {
    url: report.url,
    domain: report.domain,
    overallScore: Math.round(report.overallScore ?? 0),
    seoScore: Math.round(report.seoScore ?? 0),
    geoScore: Math.round(report.geoScore ?? 0),
    auditItems: JSON.stringify(items),
    fullReport: report ? JSON.stringify(report) : null,
    pageTitle: report.title,
    pageDescription: report.description,
  };
}
