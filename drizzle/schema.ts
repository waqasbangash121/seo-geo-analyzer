import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Audit results table for storing SEO/GEO audit data
 */
export const auditResults = mysqlTable("auditResults", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  url: varchar("url", { length: 2048 }).notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  
  // Overall scores
  overallScore: int("overallScore").notNull(), // 0-100
  seoScore: int("seoScore").notNull(), // 0-100
  geoScore: int("geoScore").notNull(), // 0-100
  
  // Audit results (JSON array of audit items)
  auditItems: text("auditItems").notNull(), // JSON string of Array<AuditItem>

  // Full report snapshot (technical + geo + research)
  fullReport: text("fullReport"), // JSON string of the complete report
  
  // Metadata
  statusCode: int("statusCode"),
  pageTitle: text("pageTitle"),
  pageDescription: text("pageDescription"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AuditResult = typeof auditResults.$inferSelect;
export type InsertAuditResult = typeof auditResults.$inferInsert;

export interface AuditItem {
  id: string;
  category: "technical" | "content" | "geo" | "accessibility" | "performance";
  title: string;
  description: string;
  status: "pass" | "warning" | "fail";
  impact: "high" | "medium" | "low";
  recommendation?: string;
  value?: string | number;
}