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

## Tier 2: Coming Next

### 5. Industry Classification
Compare sites against their industry peers, not just globally. "For an e-commerce site, this LCP is below average."

### 6. Time Series Visualization
Scatter plot of individual runs over time, showing variance and trends.

### 7. Competitive Answer: "Why not WebPageTest?"
WebPageTest = private reports for engineers. PerfRank = public leaderboard with industry comparison + structured analysis. Different products.

---

*This doc will be updated as changes are made.*
