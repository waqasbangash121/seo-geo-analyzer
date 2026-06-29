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

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function calculateResearchScore(
  research: Awaited<ReturnType<ResearchEngine["analyze"]>> | null
): number {
  if (!research) return 0;

  const keywordScore = Math.min(100, (research.keywords?.length ?? 0) * 8);
  const competitorScore = Math.min(
    100,
    (research.competitors?.length ?? 0) * 16
  );
  const contentGapScore = Math.min(
    100,
    (research.contentGaps?.length ?? 0) * 16
  );
  const snippetScore = Math.min(
    100,
    (research.snippetOpportunities?.length ?? 0) * 16
  );
  const faqScore = Math.min(100, (research.faqSuggestions?.length ?? 0) * 5);

  return clampScore(
    keywordScore * 0.25 +
      competitorScore * 0.2 +
      contentGapScore * 0.2 +
      snippetScore * 0.2 +
      faqScore * 0.15
  );
}

function calculateSchemaScore(
  schema: ReturnType<SchemaAuditEngine["analyze"]> | null
): number {
  if (!schema) return 0;
  return clampScore(schema.coveragePercent ?? 0);
}

function calculateOverallScore(input: {
  technicalScore: number;
  geoScore: number;
  schemaScore: number;
  researchScore: number;
  hasGeo: boolean;
  hasResearch: boolean;
}): number {
  const weights = {
    technical: 0.45,
    geo: input.hasGeo ? 0.35 : 0,
    schema: 0.1,
    research: input.hasResearch ? 0.1 : 0,
  };

  const totalWeight =
    weights.technical + weights.geo + weights.schema + weights.research;

  return clampScore(
    (input.technicalScore * weights.technical +
      input.geoScore * weights.geo +
      input.schemaScore * weights.schema +
      input.researchScore * weights.research) /
      totalWeight
  );
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  audit: router({
    analyze: publicProcedure
      .input(
        z.object({
          url: z.string().url(),
          includeResearch: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const engine = new EnhancedAuditEngine();
          const technical = await engine.performAudit(input.url);
          const pages = engine.lastCrawledPages;

          const geoAnalyzer = new GeoAnalyzer();
          const researchEngine = new ResearchEngine();
          const schemaEngine = new SchemaAuditEngine();

          const [geo, research] = await Promise.all([
            geoAnalyzer.analyze(input.url, pages).catch(e => {
              console.error("[GEO] failed:", e);
              return null;
            }),
            input.includeResearch === false
              ? Promise.resolve(null)
              : researchEngine.analyze(input.url, pages).catch(e => {
                  console.error("[Research] failed:", e);
                  return null;
                }),
          ]);

          const schema = schemaEngine.analyze(
            input.url,
            pages,
            technical.crawlAnalysis
          );
          const geoScore = clampScore(geo?.overallGeoScore ?? 0);
          const schemaScore = calculateSchemaScore(schema);
          const researchScore = calculateResearchScore(research);
          const combinedOverall = calculateOverallScore({
            technicalScore: technical.overallScore,
            geoScore,
            schemaScore,
            researchScore,
            hasGeo: Boolean(geo),
            hasResearch: Boolean(research),
          });

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
              schemaScore,
              researchScore,
              actionPlan,
              pipeline: {
                crawledPages: pages.length,
                technicalComplete: true,
                geoComplete: Boolean(geo),
                researchComplete: Boolean(research),
                schemaComplete: Boolean(schema),
              },
            },
          };
        } catch (error) {
          console.error(
            "[Audit] enhanced pipeline failed, using basic fallback:",
            error
          );

          const { content, auditItems, scores } = await analyzeWebpage(
            input.url
          );

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
              schemaScore: 0,
              researchScore: 0,
              geo: null,
              research: null,
              schema: null,
              actionPlan: [],
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
              pipeline: {
                crawledPages: 1,
                technicalComplete: true,
                geoComplete: false,
                researchComplete: false,
                schemaComplete: false,
                fallback: true,
              },
              summary: {
                totalPages: 1,
                avgLoadTime: 0,
                issuesFound: auditItems.length,
                criticalIssues: auditItems.filter(
                  item => item.status === "fail"
                ).length,
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
          fullReport: input.fullReport
            ? JSON.stringify(input.fullReport)
            : null,
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

      return results.map(r => ({
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
