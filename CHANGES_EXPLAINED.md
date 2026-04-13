# PerfRank Changes — What & Why

This doc explains every change being made so you understand what's happening and can discuss it confidently.

---

## Tier 1: Changes Made

### 1. Google Analytics (GA4)

**What:** A tiny JavaScript snippet from Google that loads on every page visit. It tracks anonymous visitor counts, which pages they view, what buttons they click, and where they came from (HN, Twitter, direct link).

**Why they asked:** If you can't answer "how many people visited your site yesterday?" or "what % of visitors actually ran a benchmark?", it looks like you built something but never thought about whether people use it. Product engineers measure everything.

**How it works:** You get a GA4 "Measurement ID" (like `G-XXXXXXXXXX`) from analytics.google.com. We inject a `<script>` tag that sends page view events to Google. You see the data in a dashboard at analytics.google.com.

**What it costs:** Free.

---

### 2. Microsoft Clarity

**What:** A free JavaScript snippet from Microsoft that records how users interact with your site — mouse movements, clicks, scrolls, rage clicks (when someone clicks the same thing 5+ times out of frustration). It generates heatmaps showing where users focus.

**Why they asked:** The Microsoft person specifically mentioned Clarity — it's Microsoft's own product. Using it shows you know their ecosystem AND that you care about UX beyond just "does it work." It answers questions like "do users scroll to the methodology section?" and "does anyone click the share button?"

**How it works:** You get a project ID from clarity.microsoft.com. We inject their tracking script. It records sessions (anonymized) and generates visual heatmaps.

**What it costs:** Free. (Microsoft uses the data to improve Bing.)

---

### 3. Compression Detection

**What:** When a browser requests a webpage, the server can compress the response using algorithms like gzip or Brotli (like zipping a file). A 500KB page might compress to 120KB, loading 4x faster. We now check the `content-encoding` response header to see if compression is used.

**Why they asked:** It's a concrete, actionable metric. If a site scores poorly on TTFB/FCP, and we can show "this site isn't using compression," that's a specific fix the site owner can make. Lighthouse checks this. WebPageTest checks this. We should too.

**How it works:** When Playwright loads a page, we already capture response headers. We just check if `content-encoding` contains `gzip`, `br` (Brotli), `zstd`, or `deflate`. We also compare the transfer size vs decoded size to calculate the compression ratio.

**Where it shows up:** In the security/infrastructure section of each site's detail drawer, and fed to the analysis agent as additional context.

---

### 4. More Runs + Percentile Reporting (P50/P95)

**What:** Instead of running 3 passes per site and taking the median, we now run 10 passes. We report two numbers:
- **P50 (median):** The "typical" experience. Half of loads are faster, half slower.
- **P95:** The "worst reasonable" experience. 95% of loads are faster than this. This catches intermittent slowness that median hides.

**Why they asked:** 3 runs isn't statistically meaningful. With 3 data points, one outlier skews everything. With 10 runs, we can confidently say "this site's LCP is usually 2.1s but sometimes spikes to 4.8s." That p50/p95 split is how real performance engineering works — it's how Netflix, Google, and Amazon measure their services.

**The tradeoff:** 10 runs takes ~3x longer per benchmark and uses more Railway CPU. We can make this configurable (quick=3, deep=10) if cost is a concern.

**What P50 and P95 mean:**
- Imagine 100 page loads sorted fastest to slowest
- P50 = the 50th load (middle). "Typical user experience"
- P95 = the 95th load. "What the unlucky 5% of users see"
- If p50 and p95 are close → site is consistent
- If p95 is much worse than p50 → site has reliability problems

---

### Summary of Code Changes

| File | What changed |
|------|-------------|
| `client/index.html` | GA4 + Clarity script tags (placeholder IDs) |
| `server/benchmark/collector.js` | 10 runs, p50/p95 computation, compression detection |
| `server/benchmark/queue.js` | 8min timeout, concurrency 2 (heavier benchmarks) |
| `server/agent/prompts.js` | Updated to mention p50/p95 and compression |
| `client/src/components/leaderboard/SiteDetailDrawer.jsx` | p95 display, compression section |
| `client/src/components/leaderboard/BenchmarkProgress.jsx` | Progress shows 10 runs |
| `client/src/components/leaderboard/HowItWorks.jsx` | Updated methodology text |
| `README.md` | Updated pipeline diagram |

---

## Tier 2: Changes Made

### 5. Industry Classification (Category Comparison)

**What:** When you open a site's detail drawer, there's now a "vs [Category] avg" section that compares the site's score, LCP, and TTFB against other sites in the same category (e.g., "vs Dev Tools avg").

**Why they asked:** Raw scores don't mean much without context. An LCP of 3000ms is terrible for a search engine but acceptable for a heavy e-commerce site. Comparing against peers makes scores actionable and is how real performance teams think — "are we beating our competitors?"

**How it works:** The server already categorizes sites (search, news, social, dev-tools, e-commerce, etc.). When the leaderboard loads, it computes per-category averages (avg score, avg LCP, avg TTFB). The drawer then shows your site vs its category with green/red trend arrows and percentage deltas. Only shows when there are 2+ sites in the category.

**Where it shows up:** In the site detail drawer, between the header and the vitals grid.

---

### 6. Run Distribution Scatter Plot

**What:** A collapsible "Run distribution" section in the detail drawer showing a scatter plot for each metric (LCP, FCP, TTFB, TBT, CLS). Each dot is one of the 10 runs, colored by threshold (green=good, yellow=needs improvement, red=poor). Dashed reference lines show p50 and p95.

**Why they asked:** P50 and p95 are summaries — they compress 10 data points into 2 numbers. The scatter plot shows the full picture: are runs clustered tightly (consistent site) or spread all over (unreliable site)? Two sites can have the same p50 but wildly different variance. This is the kind of visualization that makes people share your tool.

**How it works:** The collector already stores the raw `values` array (all 10 sorted runs) per metric. We render a lightweight SVG scatter plot — no chart library, pure math. Each dot is positioned by run index (x) and value (y). P50 gets a teal dashed line, p95 gets a red dashed line.

**What it costs:** Zero — it's client-side rendering of data we already collect.

---

### Summary of Tier 2 Code Changes

| File | What changed |
|------|-------------|
| `server/routes/leaderboard.js` | Computes `categoryStats` (avgScore, avgLcp, avgTtfb per category) |
| `client/src/App.jsx` | Stores + passes `categoryStats` to drawer |
| `client/src/components/leaderboard/SiteDetailDrawer.jsx` | Category comparison UI + scatter plot integration |
| `client/src/components/leaderboard/RunScatter.jsx` | NEW — SVG scatter plot component |
| `CHANGES_EXPLAINED.md` | This file, updated with Tier 2 |

---

## Tier 3: Coming Next

### 7. Competitive Answer: "Why not WebPageTest?"
WebPageTest = private reports for engineers. PerfRank = public leaderboard with industry comparison + structured analysis. Different products.

---

*This doc will be updated as changes are made.*
