import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { analyzeWebpage } from "./audit";
import { EnhancedAuditEngine } from "./audit-enhanced";
import { GeoAnalyzer } from "./geo";
import { ResearchEngine } from "./research";
import { SchemaAuditEngine } from "./schema-audit";
import { buildActionPlan } from "./action-plan";
import { getDb } from "./db";
import { auditResults } from "../drizzle/schema";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { safeParse, buildHistoryRow } from "./auditHistory";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  audit: router({
    // Full comprehensive analysis: technical + GEO + research
    analyze: publicProcedure
      .input(z.object({ url: z.string().url(), includeResearch: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        try {
          const engine = new EnhancedAuditEngine();
          const technical = await engine.performAudit(input.url);
          const pages = engine.lastCrawledPages;

          // Run GEO and research in parallel (both use LLM with fallbacks)
          const geoAnalyzer = new GeoAnalyzer();
          const researchEngine = new ResearchEngine();

          const [geo, research] = await Promise.all([
            geoAnalyzer.analyze(input.url, pages).catch((e) => {
              console.error("[GEO] failed:", e);
              return null;
            }),
            input.includeResearch === false
              ? Promise.resolve(null)
              : researchEngine.analyze(input.url, pages).catch((e) => {
                  console.error("[Research] failed:", e);
                  return null;
                }),
          ]);

          // Schema markup audit (deterministic, no LLM)
          const schemaEngine = new SchemaAuditEngine();
          const schema = schemaEngine.analyze(input.url, pages, technical.crawlAnalysis);

          const geoScore = geo?.overallGeoScore ?? 0;
          const combinedOverall = geo
            ? Math.round((technical.overallScore + geoScore) / 2)
            : technical.overallScore;

          // Prioritized action plan aggregated from all engines
          const actionPlan = buildActionPlan({
            technicalAudit: technical.technicalAudit,
            geo,
            research,
            schema,
          });

          return {
            success: true,
            data: {
              ...technical,
              overallScore: combinedOverall,
              geoScore,
              geo,
              research,
              schema,
              actionPlan,
            },
          };
        } catch (error) {
          // Fallback to basic single-page audit
          const { content, auditItems, scores } = await analyzeWebpage(input.url);

          return {
            success: true,
            data: {
              url: input.url,
              domain: new URL(input.url).hostname,
              title: content.title,
              description: content.description,
              overallScore: scores.overall,
              seoScore: scores.seo,
              technicalScore: scores.seo,
              performanceScore: 75,
              accessibilityScore: 75,
              geoScore: 0,
              geo: null,
              research: null,
              technicalAudit: auditItems,
              auditItems,
              statusCode: content.statusCode,
              crawlAnalysis: {
                totalPages: 1,
                crawlDepth: 0,
                avgLoadTime: 0,
                orphanPages: [],
                brokenLinks: [],
                redirectChains: [],
                canonicalIssues: [],
                noindexPages: [],
                duplicateContentRisks: [],
                internalLinkingGraph: [],
                pageTypes: {
                  homepage: [],
                  category: [],
                  service: [],
                  product: [],
                  blog: [],
                  faq: [],
                  contact: [],
                  about: [],
                  other: [],
                },
              },
              summary: {
                totalPages: 1,
                avgLoadTime: 0,
                issuesFound: auditItems.length,
                criticalIssues: 0,
              },
            },
          };
        }
      }),

    saveResult: protectedProcedure
      .input(
        z.object({
          url: z.string().url(),
          domain: z.string(),
          overallScore: z.number(),
          seoScore: z.number(),
          geoScore: z.number(),
          auditItems: z.array(z.any()),
          fullReport: z.any().optional(),
          pageTitle: z.string().optional(),
          pageDescription: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const row = buildHistoryRow({
          url: input.url,
          domain: input.domain,
          overallScore: input.overallScore,
          seoScore: input.seoScore,
          geoScore: input.geoScore,
          auditItems: input.auditItems,
          title: input.pageTitle,
          description: input.pageDescription,
        });

        await db.insert(auditResults).values({
          userId: ctx.user.id,
          url: row.url,
          domain: row.domain,
          overallScore: row.overallScore,
          seoScore: row.seoScore,
          geoScore: row.geoScore,
          auditItems: row.auditItems,
          // Persist the caller-provided full report snapshot when present.
          fullReport: input.fullReport ? JSON.stringify(input.fullReport) : null,
          pageTitle: row.pageTitle,
          pageDescription: row.pageDescription,
        });

        return { success: true };
      }),

    getHistory: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const results = await db
        .select()
        .from(auditResults)
        .where(eq(auditResults.userId, ctx.user.id))
        .orderBy(desc(auditResults.createdAt))
        .limit(50);

      return results.map((r) => ({
        ...r,
        auditItems: safeParse(r.auditItems, []),
        fullReport: r.fullReport ? safeParse(r.fullReport, null) : null,
      }));
    }),

    getResult: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const rows = await db
          .select()
          .from(auditResults)
          .where(eq(auditResults.id, input.id))
          .limit(1);

        const r = rows[0];
        if (!r || r.userId !== ctx.user.id) throw new Error("Not found");

        return {
          ...r,
          auditItems: safeParse(r.auditItems, []),
          fullReport: r.fullReport ? safeParse(r.fullReport, null) : null,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
