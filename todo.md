# SEO/GEO Analyzer Enterprise Platform - TODO

## Phase 1: UI Redesign to Premium Light-Mode SaaS
- [x] Update global theme to light mode (white background, professional colors)
- [x] Implement Inter typography with proper scaling (H1: 48px, H2: 36px, H3: 28px, Body: 16px)
- [x] Apply professional color palette (#2563EB primary, #10B981 success, #F59E0B warning, #EF4444 error)
- [x] Redesign AuditPage with card-based layouts and visual hierarchy
- [x] Create professional data visualization components
- [x] Add elegant loading states and skeleton screens
- [x] Ensure responsive design (desktop, tablet, mobile)
- [x] Implement high accessibility standards

## Phase 2: Deep Crawl Engine & Technical SEO Audit
- [x] Build site crawler to discover multiple page types (homepage, category, service, product, blog, FAQ, contact, about)
- [x] Generate crawl analysis (pages discovered, crawl depth, internal linking graph)
- [x] Detect orphan pages, broken links, redirect chains
- [x] Identify canonical conflicts and duplicate content risks
- [x] Analyze robots.txt and sitemap.xml
- [x] Detect canonical tags, noindex tags, hreflang
- [x] Estimate Core Web Vitals (LCP, CLS, INP)
- [x] Analyze image optimization, lazy loading, script loading
- [x] Identify render-blocking resources
- [x] Real caching/compression/HSTS header analysis (Cache-Control, Expires, ETag, gzip/br, HSTS)
- [x] Surface Core Web Vitals + Delivery panel in Technical tab UI (with honest estimate disclaimer)

## Phase 3: GEO Analysis & Entity Extraction
- [x] Create GEO audit module for AI visibility (ChatGPT, Perplexity, Gemini, Claude, Google AI Overviews)
- [x] Score entity coverage, knowledge graph signals, structured facts
- [x] Evaluate direct-answer formatting and semantic richness
- [x] Calculate citation potential
- [x] Build entity extraction engine (brands, products, locations, services, people, technologies, organizations)
- [x] Generate primary/supporting/missing entities analysis
- [x] Calculate entity density
- [x] LLM-powered analysis with deterministic heuristic fallback + vitest coverage

## Phase 4: Competitor Research & Keyword Research
- [x] Implement competitor discovery (ranking competitors with authority + advantages)
- [x] Analyze competitor strengths and key advantages
- [x] Build keyword research engine (primary, long-tail, commercial, semantic)
- [x] Calculate keyword metrics (intent, difficulty, volume, opportunity score)
- [x] Identify missing topics and content gaps
- [x] Generate FAQ opportunities with schema
- [x] Identify featured snippet opportunities (paragraphs, lists, tables)
- [x] Niche detection
- [x] Frontend display across Overview/Technical/GEO/Research tabs
- [x] Fixed opportunityScore display scale (0-100)

## Phase 4b: Research Honesty & Depth Improvements
- [x] Label keyword volume/difficulty and competitor authority as "AI estimate" in the UI
- [x] Generate copy-paste-ready JSON-LD FAQ schema output (verified valid, 20 entities)
- [x] Add table-format featured snippet opportunities (alongside paragraph/list)
- [x] Expand FAQ suggestions to 20+ items (verified 20 via dedicated LLM call)
- [x] Add a clear methodology/disclaimer note to the Research tab

## Phase 5: Schema Audit & Action Plan
- [x] Detect schema markup (Organization, LocalBusiness, Product, FAQ, Article, Breadcrumb, Review, Person)
- [x] Generate ready-to-use JSON-LD recommendations (copy-paste in UI)
- [x] Schema coverage % across crawled pages
- [x] Create prioritized Action Plan aggregating all engines with priority + effort + impact
- [x] Action Plan category filters (Content/Technical/Schema/GEO)
- [ ] Backlink analysis (deferred - requires paid third-party API; noted to user)

## Phase 6: Executive Dashboard & Reporting
- [x] Build executive dashboard with score breakdown (SEO, Technical, GEO, AI Citation, Performance) + letter grade
- [x] Quick wins summary (low effort, high impact) on the Overview tab
- [x] Comprehensive multi-tab report (Overview, Action Plan, Technical, GEO, Schema, Research)
- [x] Implement PDF export (print-optimized stylesheet)
- [x] Implement CSV export functionality
- [x] Implement JSON export functionality
- [x] Create prioritized action plan with difficulty and estimated gains
- [ ] Report scheduling and email delivery (deferred - optional future enhancement)

## Phase 7: Testing & Deployment
- [x] Test all crawl engine features (live audit of smashingmagazine.com crawled 50 pages)
- [x] Verify technical SEO audit accuracy (30+ checks render with status/impact/recommendation)
- [x] Test GEO analysis and entity extraction (GEO 85, AI Citation 90 on real site)
- [x] Validate competitor research and keyword research (niche-accurate competitors + 12 keywords)
- [x] Test reporting and export functionality (JSON + CSV verified end-to-end; PDF via native print)
- [x] Production build passes cleanly (`pnpm run build`, 1777 modules transformed)
- [x] All vitest tests pass (`pnpm test`, 6/6)
- [ ] Deploy to production (user clicks Publish in the UI)

## Phase 8: Audit History (persist & re-open past audits)
- [x] DB table `auditResults` with full report snapshot (already pushed)
- [x] Backend procedures: saveResult / getHistory / getResult (user-scoped, ownership-checked)
- [x] Auto-save completed audits for signed-in users (best-effort, non-blocking)
- [x] AuditHistory slide-over UI: list last 50 audits with domain, scores, timestamp
- [x] Click a past audit to re-open the full report instantly (no re-crawl)
- [x] Sign-in prompt + empty state for anonymous/no-history users
- [x] Backend round-trip test for history save/parse logic
