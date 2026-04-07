# Performance Benchmark Leaderboard — Full Plan

## Context
PlaywrightValidator is being **pivoted** from a general QA testing tool into a **public-facing Performance Benchmark Leaderboard**. The deterministic test selection UI is being removed. The entire app is now focused on:

1. A **ranked leaderboard** of websites by Core Web Vitals (LCP, FCP, CLS, TTFB, INP, TBT)
2. **AI-powered analysis** — the Claude agentic loop with Playwright browser tools is the core engine. It doesn't just collect metrics — it **reasons about WHY** one site is faster than another, analyzes architecture choices, and provides actionable insights.
3. **Community-driven** — users submit URLs, the system benchmarks them, AI analyzes them, they appear on the leaderboard.

**Key decision: The AI agent IS the benchmarking engine.** It uses its 15 Playwright tools to navigate, measure, inspect network requests, evaluate JavaScript, and then reasons about what it found. This is NOT just a number collector — it's an intelligent analyst.

## What Gets Removed
- ConfigPanel's deterministic test selection (checkboxes for nav, security, forms, etc.)
- The "Configure → Execution → Report → History" tab flow
- Individual test modules as selectable options (they become internal tools the AI uses)

## What Stays / Gets Enhanced
- **AI Agent** (server/agent/ai-orchestrator.js) — core engine, enhanced with performance-focused prompts
- **Playwright browser tools** (server/agent/tools.js) — all 15 tools stay, AI decides which to use
- **Performance metrics collection** (server/tests/performance.test.js) — `runPerfVitals()` still used for quick metric snapshots
- **WebSocket real-time updates** — live progress while AI benchmarks a site
- **Report generation** — PDF/Markdown export of AI findings
- **Cost tracking** — token/cost display for AI runs

## New App Structure — 21st.dev MCP-First UI

Every component below is built using **21st.dev Magic MCP** (`21st_magic_component_builder`)
as the primary design tool. Use `21st_magic_component_inspiration` to discover reference
patterns before building, then `21st_magic_component_refiner` to polish after first pass.

### Layout: Single-page, three zones

```
┌─────────────────────────────────────────────────────┐
│  HERO ZONE — URL input + tagline                    │
├─────────────────────────────────────────────────────┤
│  LEADERBOARD ZONE — the main table                  │
│  ┌─ filters/search ─────────────────────────────┐   │
│  │  ranked table with inline sparklines         │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  DETAIL/COMPARE ZONE — slides up as overlay/drawer  │
└─────────────────────────────────────────────────────┘
```

### Component Plan (all via 21st.dev MCP)

**1. Hero Section** — `21st_magic_component_builder`
- Full-width dark section with animated gradient mesh background (subtle, not distracting)
- Tagline: something sharp — see Naming section below
- Large URL input with glowing accent border (#E8FF47) + "Benchmark" button
- Below input: "Recently benchmarked: google.com (A+), reddit.com (C), cnn.com (D)" — auto-rotating ticker showing recent entries as social proof
- When benchmark is running: input transforms into a live progress stream (see BenchmarkProgress below)

**2. LeaderboardTable** — `21st_magic_component_builder`
- Use `21st_magic_component_inspiration` to find best data-table patterns first
- Columns: Rank (#), Favicon + Domain, Category (pill badge), Score (large, colored), Grade (letter badge), LCP, FCP, CLS, TTFB, INP, TBT
- Each metric cell: value + tiny colored dot (green/yellow/red) — NOT full bg color, too noisy
- Row hover: subtle glow, shows "Analyze" and "Compare" action buttons
- Sortable columns with animated sort indicator
- Category filter bar above table: horizontal pill toggles (All, Search, News, Dev Tools, AI, E-Commerce, etc.)
- Search input for domain filtering
- Checkbox column for selecting 2 sites → enables "Compare with AI" floating action button
- Pagination or virtual scroll for large lists
- **Key design goal**: data-dense but not cluttered. Think Linear's table aesthetic, not Material UI.

**3. BenchmarkProgress** — `21st_magic_component_builder`
- Replaces the hero input area when a benchmark is running
- Three-phase progress indicator: "Collecting metrics (1/3)..." → "Collecting metrics (2/3)..." → "AI is analyzing..."
- Phase 1 (collector): show a clean progress bar with checkmarks appearing as each step completes (vitals ✓, network ✓, bundles ✓, images ✓, etc.)
- Phase 2 (AI analyst): streaming text area showing the AI's reasoning in real-time via WebSocket — styled like a terminal/monospace block with a subtle typing cursor
- Cost ticker in corner: "$0.003..." incrementing live
- "Cancel" button
- On completion: smooth transition — progress collapses, new entry animates into the leaderboard table with a highlight pulse

**4. SiteDetailDrawer** — `21st_magic_component_builder`
- Slides up from bottom as an overlay drawer (not a new page — keeps leaderboard context)
- Header: favicon + domain + score gauge (animated arc) + grade badge + "benchmarked 2 hours ago"
- Vitals grid: 6 cards in a 3x2 grid, each showing metric name, value, rating dot, and a one-line AI explanation pulled from keyFindings
- Use `21st_magic_component_builder` for animated gauge/arc components for each vital
- AI Analysis section: rendered markdown of the full `architectureAnalysis` — rendering strategy, bundle efficiency, CDN/caching, image optimization, third-party impact
- Recommendations section: ordered cards with action, expected impact, effort badge (low/medium/high)
- Screenshot thumbnail of the site (from collector)
- Raw data expandable section: full CollectionResult JSON in a collapsible code block
- Export buttons: PDF, Markdown, share link
- "Compare with..." dropdown to pick another site

**5. CompareView** — `21st_magic_component_builder`
- Full-width overlay or dedicated route
- Side-by-side layout: Site A | vs | Site B
- Header: both favicons + domains + scores + grades
- Vitals comparison: horizontal bar chart for each metric — Site A bar vs Site B bar, winner highlighted
- Use Recharts for the comparison bar charts, styled to match 21st.dev aesthetic
- AI comparison narrative: streaming markdown rendered in real-time
- "Winner" callout per category with explanation
- Key architectural differences section
- Recommendations for the slower site

**6. Shared Components** (all via 21st.dev MCP)
- `GradeBadge` — letter grade in a colored pill (A+=emerald, A=green, B=yellow, C=orange, D=red, F=crimson)
- `MetricDot` — tiny colored circle indicator (good/needs-improvement/poor)
- `ScoreArc` — animated circular arc gauge, 0-100, color transitions
- `CategoryPill` — subtle pill badge for site categories
- `CostTicker` — live-updating cost display with $ prefix
- `StreamingText` — monospace streaming text component for AI reasoning
- `FaviconCell` — favicon image + domain text, handles missing favicons gracefully

### Design System (enforced across all 21st.dev builds)

```
Background:     #0D0D0D (page), #141414 (cards), #1A1A1A (hover)
Borders:        #2A2A2A (default), #3A3A3A (hover)
Accent:         #E8FF47 (primary actions, input focus, highlights)
Text:           #FFFFFF (primary), #A0A0A0 (secondary), #666666 (muted)

Performance:    #4ECDC4 (good), #F5A623 (needs-improvement), #FF2D2D (poor)
Grades:         #10B981 (A+/A), #84CC16 (B+/B), #F59E0B (C+/C), #EF4444 (D/F)

Font:           Inter (UI), JetBrains Mono (metrics/code/streaming)
Radius:         8px (cards), 6px (buttons), 4px (badges)
Shadows:        Minimal — use border-based elevation, not drop shadows
```

Pass this design system as context to every `21st_magic_component_builder` call.
After each component build, run `21st_magic_component_refiner` to tighten consistency.

## User Submissions & Rate Limiting

### How user-submitted sites enter the leaderboard

The leaderboard is a **single, unified ranking** — seed sites and user submissions live
side by side. There is no separate "community" tab. When you benchmark a site, it joins
the same leaderboard everyone sees.

### Auth: NONE for v1 launch

> **Critical scope decision**: Google OAuth adds 1-2 days of implementation (passport setup,
> session management, callback routes, frontend auth state, protected routes, cookie handling)
> for minimal launch-day value. Most HN readers will NOT sign up — they want to try it
> immediately. Auth friction at the moment of highest engagement = lost users.

**v1 (HN launch):** No auth. Rate limit by IP address.
**v1.1 (post-validation):** Add Google OAuth for higher rate limits, user profiles, attribution.

### Submission Flow (v1 — no auth)

```
User sees "Benchmark a site" input in hero section
  → enters URL, clicks "Benchmark"
  → system checks: is this domain already in the leaderboard?
     ├── YES, benchmarked < 24h ago → show existing entry immediately ("already benchmarked today")
     ├── YES, benchmarked > 24h ago → re-benchmark with fresh data, update the existing entry
     └── NO → new benchmark, new entry added to leaderboard
  → benchmark runs (collector → scorer → AI analyst)
  → entry appears in leaderboard
```

### Rate Limiting (IP-based for v1)

| Limit | Value | Notes |
|-------|-------|-------|
| Benchmarks per IP per 24h | **2** | Enough to test your site + one competitor |
| Concurrent benchmarks system-wide | **3** | Playwright browser instance limit |
| Queue depth | **20** | Beyond this, return "try again later" |
| Comparisons per IP per 24h | **5** | Cheaper than benchmarks (no Playwright, just AI) |

**Why 2 per day?** Each benchmark costs ~$0.008 AI + ~30s of server compute.
At HN scale with IP limiting, worst case is manageable. If someone really wants to
abuse it via VPN, the queue depth limit catches it.

Display in UI: "You have 1 benchmark remaining today" or "Next benchmark available in Xh Xm"

### Duplicate Handling

- Leaderboard has **one entry per domain** (not per URL — `google.com/search` and `google.com` = same entry)
- The URL stored is always the homepage (`https://{domain}/`) — we normalize on submission
- When a domain is re-benchmarked, the old entry is **updated in place** (new vitals, new AI analysis, new timestamp)
- The leaderboard always shows the **most recent** benchmark

### v1.1 — Post-Launch Auth Additions (NOT in v1 build)
- Google OAuth for signed-in users → 5 benchmarks/day instead of 2
- User profiles with submission history
- "Benchmarked by [name]" attribution on entries
- Claim your domain: verify you own a site to get unlimited re-benchmarks of it

## Data Model

### `reports/leaderboard.json`
```json
{
  "entries": [{
    "id": "uuid",
    "url": "https://google.com",
    "domain": "google.com",
    "category": "search-engine",
    "vitals": {
      "lcp": { "value": 1200, "unit": "ms", "rating": "good" },
      "fcp": { "value": 800, "unit": "ms", "rating": "good" },
      "cls": { "value": 0.02, "unit": "", "rating": "good" },
      "ttfb": { "value": 150, "unit": "ms", "rating": "good" },
      "inp": { "value": 80, "unit": "ms", "rating": "good" },
      "tbt": { "value": 120, "unit": "ms", "rating": "good" }
    },
    "overallScore": 92,
    "grade": "A",
    "aiAnalysis": "Google's homepage achieves exceptional performance through...",
    "benchmarkedAt": "ISO8601",
    "source": "seed|community",
    "aiStats": {
      "turns": 3,
      "toolCalls": 2,
      "model": "Haiku 4.5",
      "cost": 0.0085
    }
  }],
  "comparisons": [{
    "id": "uuid",
    "entryIdA": "uuid",
    "entryIdB": "uuid",
    "analysis": "markdown comparison text from AI",
    "createdAt": "ISO8601"
  }],
  "lastUpdated": "ISO8601"
}
```

> **Note**: JSON file storage is fine for launch. If this grows past ~500 entries or needs
> concurrent writes under load, migrate to SQLite or Supabase. Don't over-engineer storage
> before validating the product.

## API Endpoints

### Keep existing:
- `GET /api/ai/status` — check if AI available
- `GET /api/health` — health check
- WebSocket `/ws/:sessionId` — real-time updates

### New — Leaderboard:
- `GET /api/leaderboard` — get all entries (public)
- `GET /api/leaderboard/:id` — get single entry with full AI analysis (public)
- `POST /api/leaderboard/benchmark` — submit URL for benchmarking (**IP rate-limited, 2/day**)
  - Validates URL, normalizes to domain
  - Checks IP rate limit (2 per 24h, in-memory store)
  - Checks duplicate (same domain benchmarked <24h ago → return existing)
  - Queues benchmark job (collector → scorer → analyzer)
  - Returns job ID + WebSocket session for real-time progress
  - On completion: upserts entry in leaderboard
- `POST /api/leaderboard/compare` — AI comparison of 2 entries (IP rate-limited, 5/day)
- `GET /api/leaderboard/:id/pdf` — export analysis as PDF (public)

### New — Queue (for HN traffic resilience):
- `GET /api/queue/status` — current queue depth + estimated wait time
- Queue backed by in-memory job queue (BullMQ + Redis if available, falls back to simple in-memory queue)
- Max 3 concurrent benchmarks (Playwright browser instances)
- Jobs older than 10 minutes are killed

### Remove:
- `POST /api/test/run` — deterministic test run
- `POST /api/test/ai-run` — generic AI test (replaced by benchmark-specific)
- `GET /api/reports/history` — replaced by leaderboard
- `POST /api/reports/compare` — replaced by leaderboard compare

## Seeding Script
`server/scripts/seed-leaderboard.js` — benchmarks sites to populate initial data.

**Site selection is strategic for HN launch** — every seed site should make the reader
feel something: surprise, validation, curiosity, or outrage. Boring data = no engagement.

| Category | Sites | Why these |
|----------|-------|-----------|
| Search | google.com, bing.com, duckduckgo.com | The classic head-to-head. Google should dominate. |
| News | cnn.com, bbc.com, nytimes.com | News sites are notoriously slow — expect Ds and Fs. Controversial. |
| Social | reddit.com, x.com | Reddit's new React app vs old — HN has opinions. |
| Video | youtube.com | Massive, complex — interesting AI analysis. |
| Dev Tools | github.com, stackoverflow.com, linear.app, vercel.com | **HN's home turf.** These are the sites they use daily. Judgments here will spark debate. |
| AI | chat.openai.com, claude.ai, perplexity.ai | AI companies' own sites — are they fast? Ironic if not. |
| Infra / Dev | fly.io, supabase.com, stripe.com, cloudflare.com | Companies that sell performance/infra — do they eat their own dogfood? |
| E-Commerce | amazon.com, shopify.com | The retail giants. |
| HN Classic | news.ycombinator.com | **Must include.** HN will love seeing their own site scored. It's famously minimal — should score very high. |
| Reference | wikipedia.org | The SSR poster child. Should ace it. |

**~25 sites total.** The goal is that when someone sees the leaderboard for the first time,
at least 3-4 results surprise them enough to click through or leave a comment.

## Frontend Components

### Remove:
- `ConfigPanel.jsx` — test selection UI
- `ExecutionPanel.jsx` — generic test progress
- `HistoryPanel.jsx` — replaced by leaderboard

### Keep:
- Toast system — keep as-is
- WebSocket hooks — reuse for real-time streaming

### Build from scratch with 21st.dev MCP:
All components below are created via `21st_magic_component_builder` with the design system above.

| Component | 21st.dev Build Prompt Focus | Priority |
|-----------|---------------------------|----------|
| `HeroSection.jsx` | Animated gradient mesh bg, large URL input with glow, recent-sites ticker | P0 |
| `LeaderboardTable.jsx` | Data-dense sortable table, favicon cells, metric dots, row actions | P0 |
| `BenchmarkProgress.jsx` | Two-phase progress (collector → AI), streaming text, cost ticker | P0 |
| `SiteDetailDrawer.jsx` | Bottom drawer overlay, vitals grid, AI markdown, recommendations | P0 |
| `CompareView.jsx` | Side-by-side layout, comparison bar charts, AI narrative stream | P1 |
| `GradeBadge.jsx` | Colored letter pill (A+ through F) | P0 |
| `ScoreArc.jsx` | Animated circular gauge, 0-100 | P0 |
| `MetricDot.jsx` | Tiny colored status dot | P0 |
| `CategoryPill.jsx` | Subtle category label pill | P0 |
| `CostTicker.jsx` | Live $ cost display | P1 |
| `StreamingText.jsx` | Monospace AI reasoning stream with cursor | P0 |
| `FaviconCell.jsx` | Favicon + domain, graceful fallback | P0 |

**21st.dev MCP Workflow for each component:**
1. `21st_magic_component_inspiration` — find reference patterns / similar components
2. `21st_magic_component_builder` — build with design system context + specific requirements
3. `21st_magic_component_refiner` — polish for consistency, animation smoothness, edge cases

## Grounded Benchmarking Architecture

### The Problem with Pure Agentic Measurement
When an AI agent freely explores a site with 15 tools, the "search space" is enormous.
Run 1 might focus on network requests, Run 2 on JS bundles, Run 3 on images — producing
wildly different scores and analyses each time. A leaderboard requires **consistency**.

### Solution: Deterministic Collection → Constrained AI Reasoning

The pipeline is split into two distinct phases:

```
Phase 1: DETERMINISTIC DATA COLLECTION (no AI, always identical)
  ├── measure_performance (Core Web Vitals + Navigation Timing)
  ├── get_network_requests (full request waterfall)
  ├── evaluate_js: fixed scripts (bundle sizes, rendering strategy, image audit, etc.)
  ├── screenshot (above-the-fold visual snapshot)
  └── check_security_headers (CDN/caching header analysis)

Phase 2: CONSTRAINED AI REASONING (read-only, structured output)
  ├── Receives: all Phase 1 data as pre-collected context
  ├── Tools available: NONE (or read-only: screenshot, evaluate_js for follow-up only)
  ├── Job: explain WHY the numbers are what they are
  └── Output: structured JSON matching a fixed schema
```

### Phase 1: Deterministic Collector (`server/benchmark/collector.js`)

A new module that runs a **fixed sequence** of Playwright operations — no AI, no variance.
Collects the same data points every single time, for every site.

**Fixed evaluation scripts** (run via `evaluate_js` in a set order):
1. **Bundle analysis**: `performance.getEntriesByType('resource')` → total JS size, CSS size, image size, font size, third-party vs first-party breakdown
2. **Rendering strategy detection**: check for `__NEXT_DATA__`, `__NUXT__`, hydration markers, SSR indicators, meta generator tags
3. **Image audit**: all `<img>` elements → dimensions, lazy loading, format (webp/avif/png/jpg), missing width/height
4. **Font loading**: `document.fonts.status`, number of font families, FOUT/FOIT indicators
5. **Third-party script inventory**: all `<script>` elements → src domain, async/defer attributes, blocking vs non-blocking
6. **DOM complexity**: total node count, max depth, `<iframe>` count
7. **Caching analysis**: parse `cache-control`, `etag`, `expires` from network response headers

**Multiple runs + averaging**: Run the metric collection **3 times** and take the **median**
for each vital. This smooths out network jitter and gives stable, reproducible scores.

**Output**: A `CollectionResult` object with a fixed, typed shape:
```json
{
  "vitals": { "lcp": { "values": [1200, 1180, 1250], "median": 1200, "rating": "good" }, ... },
  "resources": { "totalSize": 1420000, "jsSize": 680000, "cssSize": 95000, ... },
  "rendering": { "strategy": "SSR", "framework": "Next.js", "hydration": true },
  "images": [{ "src": "...", "format": "jpg", "lazy": false, "sizeKb": 240 }],
  "thirdParty": [{ "domain": "analytics.google.com", "scripts": 3, "blocking": 1 }],
  "dom": { "nodeCount": 1842, "maxDepth": 18, "iframes": 2 },
  "caching": { "immutableAssets": 14, "noCacheAssets": 3, "cdnDetected": "Cloudflare" },
  "screenshot": "base64..."
}
```

### Phase 2: Constrained AI Analyst

The AI agent receives the `CollectionResult` as its **entire context** — it does NOT browse.
Its job is pure reasoning over fixed data.

**Tool restrictions for Phase 2**:
- **Removed**: `navigate`, `click`, `type_text`, `fill_form`, `inject_payload`, `wait_for` — the agent cannot interact with the page
- **Available (read-only follow-up only)**: `screenshot` (specific element), `evaluate_js` (clarifying queries) — limited to 3 follow-up tool calls max
- **Required**: `report_findings` (new tool, replaces `report_bug`, enforces structured output schema)

**New `report_findings` tool** forces structured output:
```json
{
  "summary": "One-paragraph performance verdict",
  "overallScore": 0-100,
  "grade": "A+/A/B+/B/C+/C/D/F",
  "keyFindings": [
    { "area": "LCP", "verdict": "good|needs-improvement|poor", "explanation": "...", "impact": "high|medium|low" }
  ],
  "architectureAnalysis": {
    "renderingStrategy": "SSR/CSR/SSG/ISR + why this matters",
    "bundleEfficiency": "analysis of JS/CSS sizes",
    "cdnAndCaching": "analysis of edge delivery",
    "imageOptimization": "analysis of image strategy",
    "thirdPartyImpact": "analysis of third-party script cost"
  },
  "topRecommendations": [
    { "action": "what to do", "impact": "expected improvement", "effort": "low|medium|high" }
  ]
}
```

**Constrained prompt for the AI analyst**:
- "You are a performance analyst. You will receive pre-collected metrics and resource data for a website. Your job is to EXPLAIN the numbers, not collect new ones."
- "Analyze architecture choices, identify bottlenecks, and provide actionable recommendations."
- "You MUST call report_findings exactly once with your complete analysis."
- "You may use up to 3 follow-up tool calls (screenshot or evaluate_js) if you need to clarify something specific, but the pre-collected data should be sufficient for most sites."
- MAX_TURNS reduced from 15 → **5** for the analysis phase (prevents meandering)

### Why This Works
| Concern | Old approach | New approach |
|---------|-------------|--------------|
| Score consistency | AI decides what to measure → varies | Fixed collector → identical every time |
| Analysis quality | AI explores freely → shallow & random | AI reasons over complete data → deep & focused |
| Cost | 15 turns of tool calls + API | 3 collector runs (no AI) + ~2-3 AI turns |
| Speed | Slow (AI deliberation per tool call) | Fast (parallel deterministic collection, short AI phase) |
| Comparability | Different data points per site | Same data points for every site → fair comparison |

### Scoring Formula (deterministic, no AI involved)

The `overallScore` in the leaderboard is computed by `perf-scoring.js`, NOT by the AI:

```
Score = weighted average of individual vital scores (0-100 each)

Weights:
  LCP:  30%  (largest visual element)
  FCP:  15%  (first paint)
  CLS:  15%  (visual stability)
  TTFB: 15%  (server speed)
  INP:  15%  (interactivity)
  TBT:  10%  (thread blocking)

Per-vital score: linear interpolation between thresholds
  100 = at or below "good" threshold
   50 = at "needs-improvement" boundary
    0 = at or above "poor" threshold
```

The AI's `overallScore` in `report_findings` is stored separately as `aiScore` — it's
the AI's subjective assessment, shown alongside the deterministic score but NOT used for
leaderboard ranking. The leaderboard always ranks by the deterministic formula.

## AI Agent Enhancement

### New Prompt: `BENCHMARK_ANALYST_PROMPT`
Replaces the old generic prompts for the benchmark flow. Focused on:
- Explaining WHY metrics are what they are (not measuring them)
- Analyzing: rendering strategy, bundle efficiency, CDN/caching, image optimization, third-party impact, font loading
- Producing structured output via `report_findings` tool (enforced schema)
- Limited to 5 turns max, 3 follow-up tool calls max

### New Prompt: `COMPARISON_ANALYST_PROMPT`
For the "Compare 2 sites" feature. Receives both sites' `CollectionResult` objects:
- Structured side-by-side analysis
- Explains architectural differences that cause performance gaps
- Actionable recommendations for the slower site
- Output via `report_comparison` tool (enforced schema)

### Tool Set Changes
| Tool | Collector Phase | Analyst Phase | Compare Phase |
|------|:-:|:-:|:-:|
| navigate | ✓ (internal) | ✗ | ✗ |
| click | ✗ | ✗ | ✗ |
| type_text | ✗ | ✗ | ✗ |
| screenshot | ✓ | ✓ (follow-up) | ✗ |
| extract_page_info | ✓ | ✗ | ✗ |
| evaluate_js | ✓ (fixed scripts) | ✓ (follow-up) | ✗ |
| get_network_requests | ✓ | ✗ | ✗ |
| measure_performance | ✓ | ✗ | ✗ |
| check_security_headers | ✓ | ✗ | ✗ |
| report_findings | ✗ | ✓ (required) | ✗ |
| report_comparison | ✗ | ✗ | ✓ (required) |
| fill_form | ✗ | ✗ | ✗ |
| wait_for | ✗ | ✗ | ✗ |
| get_console_logs | ✓ | ✗ | ✗ |
| check_accessibility | ✗ | ✗ | ✗ |
| inject_payload | ✗ | ✗ | ✗ |
| report_bug | ✗ | ✗ | ✗ |

## Build Order (MVP-scoped for speed to launch)

### Phase A: Core Pipeline (backend, no UI)
1. Create branch `feature/benchmark-leaderboard`
2. `server/benchmark/collector.js` — deterministic data collection (fixed Playwright scripts, 3-run median)
3. `server/utils/perf-scoring.js` — deterministic scoring formula
4. `server/agent/prompts.js` — add `BENCHMARK_ANALYST_PROMPT`
5. `server/agent/tools.js` — add `report_findings` tool with enforced schema
6. `server/benchmark/analyzer.js` — thin wrapper: passes CollectionResult to constrained AI
7. **Test the pipeline end-to-end on 3 sites from CLI** — verify score consistency across runs

### Phase B: API + Infrastructure
8. `server/benchmark/queue.js` — simple in-memory job queue (concurrency limit 3, max depth 20)
9. `server/middleware/rate-limit.js` — IP-based rate limiting (in-memory Map, 2 benchmarks + 5 compares per 24h)
10. New API endpoints in `server/index.js` (leaderboard CRUD, benchmark, compare, queue status)
11. `server/scripts/seed-leaderboard.js` — seeder script
12. **Run seeder on ~15 carefully chosen sites** (see reduced list below)

### Phase C: Frontend (21st.dev MCP)
13. Remove old panels (ConfigPanel, ExecutionPanel, HistoryPanel)
14. Build shared components: GradeBadge, MetricDot, ScoreArc, CategoryPill, FaviconCell, StreamingText
15. Build HeroSection + LeaderboardTable (the landing experience — most critical)
16. Build BenchmarkProgress (real-time streaming)
17. Build SiteDetailDrawer
18. Wire in App.jsx with shareable routes (`/site/:domain`)
19. **Full visual review + 21st.dev refiner pass on every component**

### Phase D: Launch Prep
20. `/how-it-works` methodology page (simple, one-page, explains the pipeline)
21. GitHub README: architecture diagram, screenshots, self-hosting instructions, "How it works"
22. OG image / social preview (screenshot of the leaderboard with provocative data)
23. Mobile responsiveness pass
24. Deploy to VPS (see Deployment section)
25. Smoke test: benchmark 2 new sites live, verify queue, rate limiting, WebSocket streaming
26. **Write the Show HN post** (see template in HN section)

### What's CUT from v1 (add post-launch based on traction)
- ~~Google OAuth~~ → IP rate limiting instead
- ~~CompareView~~ → Add as v1.1 ("we just shipped AI comparisons" = second HN post)
- ~~PDF export~~ → Nice to have, not launch-critical
- ~~Benchmark history per domain~~ → Just show latest
- ~~User profiles / attribution~~ → Needs auth, post-launch
- ~~COMPARISON_ANALYST_PROMPT~~ → Follows CompareView, post-launch

**Rationale**: Every feature cut is 0.5-1 day saved. The compare feature alone is probably
2 days (new prompt, new tool, new AI flow, new frontend view, new API endpoint). That's 2
days closer to posting on HN. The comparison feature is a GREAT v1.1 — it gives you a
reason to post again: "We added AI-powered site comparisons to [Name]".

### Reduced Seed List (v1 — 15 sites, quality over quantity)

Pick the sites that will generate the most interesting AI analyses and HN discussion:

| Site | Why it's in v1 |
|------|---------------|
| google.com | The gold standard. Should score ~95+. |
| news.ycombinator.com | **Mandatory.** HN's own site. Minimal HTML, no JS frameworks. Should ace it. |
| github.com | HN's daily driver. Complex SPA — interesting analysis. |
| reddit.com | Controversial — heavy React app, HN has strong opinions. |
| cnn.com | The "how bad can it get" example. Ad-heavy, slow. |
| wikipedia.org | SSR poster child. Should score very high. |
| stripe.com | Dev-beloved brand. Beautiful site — is it fast? |
| claude.ai | Meta — an AI tool's site, benchmarked by AI. |
| chat.openai.com | Direct competitor to claude.ai. Comparison bait. |
| vercel.com | Performance infra company — do they practice what they preach? |
| linear.app | HN darling for design quality. Is it also fast? |
| amazon.com | Everyone knows it, interesting complexity. |
| nytimes.com | Paywall + ads + heavy — counterpoint to wikipedia. |
| fly.io | Infra company, dev audience overlap with HN. |
| x.com | The former Twitter. Everyone has opinions. |

**15 sites × ~45 sec each = ~11 minutes to seed.** Manageable.

## Deployment

> **Missing from previous plan versions. Critical for launch.**

**Playwright needs a real server** — it launches headless Chromium. Cannot run on serverless
(Vercel/Netlify/Cloudflare Workers). Needs a VPS with at least 2GB RAM.

**Options (pick one):**
| Platform | Cost | Playwright support | Notes |
|----------|------|:-:|-------|
| **Railway** | ~$5/mo | ✓ | Easy deploy from GitHub, good free tier, Docker support |
| **Fly.io** | ~$5/mo | ✓ | Edge compute, good for perf tool credibility |
| **Render** | ~$7/mo | ✓ | Simple, reliable, free tier available |
| **DigitalOcean Droplet** | $6/mo | ✓ | Full control, predictable pricing |

**Recommendation**: Railway or Fly.io — both have GitHub deploy integration and are
well-known in the HN community (credibility boost if hosted on infra HN readers respect).

**Dockerfile needed**: Playwright requires specific system deps (Chromium, fonts).
Use `mcr.microsoft.com/playwright:v1.52.0-noble` as base image.

**Environment variables**:
- `ANTHROPIC_API_KEY` — for Claude API
- `NODE_ENV=production`
- `PORT` — server port

## Tech Stack
- React 19, Tailwind CSS 4, Recharts, Vite (frontend)
- Node.js, Express, WebSocket, Playwright (backend)
- Claude API via @anthropic-ai/sdk (AI agent — analyst phase only)
- Deployed on Railway/Fly.io with Docker (Playwright base image)

## Design Direction
- **21st.dev Magic MCP is the primary design tool** — every component goes through the inspiration → build → refine pipeline
- Dark theme: #0D0D0D bg, #E8FF47 accent, #141414 cards, #2A2A2A borders
- Performance-focused color coding: #4ECDC4 (good), #F5A623 (needs-improvement), #FF2D2D (poor)
- Clean, data-dense table design — think Linear's table aesthetic
- Show both deterministic score (primary ranking) and AI score (secondary insight) per site
- **No generic UI library vibes** — this should feel like a premium product, not a Bootstrap template

---

## Naming

"PlaywrightValidator" is a terrible name for a public-facing product. It sounds like a
testing tool, not a performance leaderboard. For the HN launch, the project needs a name
that is:
- Short (1-2 words)
- Evocative of speed/performance
- Memorable
- Available as a domain (check before committing)

**Candidates** (pick before building):
- **Vitals.dev** — direct, developer-friendly, references Core Web Vitals
- **SpeedRank** — clear what it does
- **PerfBoard** — performance + leaderboard
- **WebPulse** — health/vitals metaphor
- **Beacon** — lighthouse alternative metaphor (Lighthouse → Beacon)

Pick one. The name appears in the hero section, page title, and HN post title.

---

## HN Virality Analysis — Honest Assessment

### What HN cares about (and how this maps)

| HN trigger | Does this project hit it? | Notes |
|------------|:---:|-------|
| Novel technical approach | **YES** | Deterministic Playwright collection + AI reasoning is genuinely new. Nobody else does this. Lighthouse scores numbers. PageSpeed gives generic tips. This explains WHY. |
| Open source | **MUST** | HN strongly favors open source Show HN posts. MIT license, public repo, clean README. |
| Instant demo | **PARTIALLY** | The leaderboard with seed data is instant. Benchmarking a new site takes time — need to manage expectations with the real-time stream. |
| Beautiful / polished | **DEPENDS ON EXECUTION** | This is where 21st.dev MCP earns its keep. If the UI looks like a weekend project, it's dead on arrival. If it looks like a Linear/Vercel-quality product, people will share it for the aesthetics alone. |
| Opinionated / provocative data | **YES** | "CNN scores 23/100 because of 47 render-blocking third-party scripts" will generate comments. |
| Developer-relevant | **YES** | Performance is something every web developer cares about. |
| AI that's actually useful (not a wrapper) | **YES** | The AI isn't just summarizing — it's correlating signals across network, rendering, and bundle data to produce architectural analysis. This is the "GPT wrapper" objection pre-empted. |

### What could kill it

1. **"Just use Lighthouse"** — the #1 comment you'll get. Pre-empt this in the Show HN post:
   - Lighthouse gives you numbers. This explains why.
   - Lighthouse doesn't compare two sites architecturally.
   - Lighthouse doesn't tell you "your LCP is bad because you're loading 3 render-blocking Google Fonts synchronously while your competitor uses font-display: swap with a single variable font."
   - Include a specific example in the post showing an AI analysis that Lighthouse could never produce.

2. **"The scores aren't reliable"** — the grounded architecture (deterministic collection, 3-run median, transparent formula) directly addresses this. Show the methodology. Show that the same site scores within ±2 points across runs.

3. **"It's slow"** — if benchmarking a new URL takes >60 seconds, the demo falls flat. The real-time streaming of progress is critical — it turns waiting into entertainment. The AI reasoning stream is the trick: people will READ it while they wait.

4. **"The UI is ugly / generic"** — fatal. This is why the 21st.dev MCP pipeline matters. Every component needs to feel handcrafted. The bar is: would a designer at Linear or Vercel think this looks professional?

5. **"It costs money to run"** — showing AI cost transparency ($0.008 per analysis with Haiku) is actually a *feature*. HN respects this. Also makes people realize they could self-host it cheaply.

### The Show HN post structure

```
Show HN: [Name] — AI explains why websites are fast or slow, not just the scores

I built an open-source performance benchmarking tool that goes beyond Lighthouse.

It uses Playwright to deterministically collect Core Web Vitals (3-run median for
consistency), then feeds the raw data to Claude to produce architectural analysis.

Not just "your LCP is 3.2s" but "your LCP is 3.2s because your hero image is a
240KB non-lazy JPEG served from origin while competitors use a 45KB WebP on
Cloudflare's CDN with immutable cache headers."

Some findings from the initial benchmarks:
- news.ycombinator.com scores 97/100 — the power of zero JavaScript frameworks
- [news site] scores [low] — [specific AI finding about ad scripts]
- [AI company]'s own site scores [ironic number] — [specific finding]

The key architectural decision: metrics are collected deterministically (no AI
variance), but the analysis is where Claude shines — correlating network data,
bundle sizes, rendering strategies, and third-party impact into explanations
a senior performance engineer would give.

Try it: [URL]
Code: [GitHub URL]
Stack: Playwright + Claude API + React. ~$0.008 per analysis.
```

**Post timing**: Tuesday or Wednesday, 9-10am ET. Avoid Mondays (backlog) and Fridays (low engagement).

**Key phrasing choices**:
- "I built" not "we built" — solo builder narrative plays better on HN
- Lead with the insight, not the product — "AI explains why" not "AI-powered leaderboard"
- Include the cost — HN respects transparency and will mentally calculate "I could run this"
- The architecture paragraph is for the technical readers who scroll past the demo
- Keep it SHORT — long Show HN posts get skimmed. Under 200 words.

### Specific features that drive HN engagement

1. **Shareable URLs** — `/site/google.com` linkable directly from HN comments. When someone says "how does X score?" another user can paste the link.
2. **news.ycombinator.com in the leaderboard** — mandatory. HN readers seeing their own site scored (and winning) creates emotional engagement.
3. **Cost transparency** — "$0.008 per analysis" shown on every result. HN respects this deeply.
4. **Methodology page** — `/how-it-works` explaining the deterministic pipeline + AI reasoning split. HN rewards technical depth. This page alone could generate a second wave of upvotes.
5. **"Benchmark your site" is zero-friction** — no sign-up, no auth, just paste and go. The moment of curiosity ("how does MY site score?") converts immediately.
6. **The AI analysis reads like a senior engineer's review** — this is the "wow" moment. If the analysis is generic ("consider optimizing images"), it fails. If it's specific ("your 3 Google Fonts load synchronously in the <head> adding 400ms to FCP — switch to font-display: swap and preload the primary weight"), people screenshot it and share.

### Risks to manage

- **HN hug of death** — the benchmark endpoint will get hammered. The queue + "position in queue" UI + rate limiting are non-negotiable. Test with `wrk` or `ab` before launch. The LEADERBOARD page must stay fast even if benchmarking is queued.
- **"Just use Lighthouse" comments** — pre-empt in the post itself. The architectural analysis paragraph is the defense. Also: be ready to reply in comments with a specific example comparison.
- **Controversial results** — if a well-known company's site scores badly, their engineers might show up in comments. The transparent methodology (3-run median, published scoring formula, open-source collector code) is the defense. Never be defensive — say "the methodology is open, PRs welcome."
- **AI hallucinations in analysis** — if the AI says a site uses Next.js when it actually uses Nuxt, credibility dies. The constrained architecture (AI reasons over COLLECTED data, not hallucinated data) mitigates this, but spot-check every seed site's analysis manually before launch.

### Pre-launch checklist

- [ ] Name chosen and domain secured
- [ ] GitHub repo public with clean README + screenshots + architecture diagram
- [ ] Self-hosting instructions in README (docker-compose one-liner ideal)
- [ ] Demo URL live and stable on Railway/Fly.io
- [ ] 15 seed sites benchmarked — **manually review every AI analysis for accuracy**
- [ ] `/how-it-works` methodology page
- [ ] Rate limiting and queue system tested under load
- [ ] Mobile responsive (HN readers open links on phone)
- [ ] Leaderboard page loads in <3s (performance tool must be fast — test this)
- [ ] Open Graph image (screenshot of leaderboard with interesting scores)
- [ ] Error states are graceful (queue full, rate limited, site unreachable, timeout)
- [ ] Show HN post drafted and reviewed
- [ ] Have 2 hours free after posting to reply to every comment quickly

---

## The Real Stakes — Honest Assessment

This project's purpose is to demonstrate technical depth and product taste for a Microsoft
role. A viral HN post is the vehicle. Here's what matters for THAT goal specifically:

### What a Microsoft hiring manager sees when they look at this

1. **GitHub repo quality** — clean commit history, good README, architecture docs, not a mess of "fix bug" commits. They WILL look at the code. The deterministic/AI split architecture shows systems thinking.

2. **Technical depth** — Playwright browser automation + Claude API tool use + real-time WebSocket streaming + performance engineering domain knowledge. This is not a todo app. This is the kind of project that makes an interviewer say "tell me about this."

3. **Product sense** — a beautiful UI, thoughtful UX (zero-friction benchmarking, real-time progress that's interesting to watch), and a clear value proposition shows you can ship, not just code.

4. **Scale thinking** — queue system, rate limiting, concurrent browser instance management, median-of-3 for statistical reliability. These are the details that signal senior engineering.

5. **AI integration that's NOT a wrapper** — the deterministic collection + constrained AI reasoning architecture is a genuinely good design. It shows you understand AI's strengths (reasoning) and weaknesses (consistency) and designed around them. This is exactly what Microsoft wants in the AI era.

### What could go wrong (with the career goal)

- **Shipping too late** — a perfect plan that never ships is worthless. The MVP scope cuts above are designed to get this live in days, not weeks. Don't add features. Ship.
- **Mediocre UI** — if it looks like a hackathon project, the "product taste" signal is negative. The 21st.dev MCP pipeline is insurance against this.
- **Broken on launch day** — if the demo URL is down when someone clicks through from HN, or it crashes under load, the impression is "this person can't deploy." Test. Monitor. Be ready to SSH in and restart.
- **Not engaging with HN comments** — half the virality is in the comments. Reply to every question. Be humble about limitations. Accept valid criticism. This shows communication skills, which Microsoft cares about.

### The ideal outcome

HN post hits front page → 200+ upvotes → 100+ comments debating site scores →
people benchmark their own sites and share results → the GitHub repo gets 500+ stars →
you put this on your resume with a link → Microsoft interviewer has already seen it
or clicks through and is impressed → interview conversation starts from a position of
demonstrated competence instead of "tell me about a time when..."

That's the play. Now ship it.
