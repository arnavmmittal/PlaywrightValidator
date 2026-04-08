# Show HN Draft — Pick your favorite version

---

## Option A: Provocative / Data-Led

**Title:** Show HN: PerfRank – We benchmarked 15 popular sites. Shopify got an F.

**Body:**

PerfRank is a public web performance leaderboard. It benchmarks sites under simulated 4G conditions using Playwright and scores them across Web Vitals + security headers.

Some results surprised us:
- Hacker News: 93/A (minimal DOM, no JS frameworks)
- Google: 82/B (heavy client-side hydration)
- Shopify: 55/F (3.5s LCP, missing security headers)
- CNN: 69/D (massive third-party scripts)

The key design decision: separate data collection from analysis. Phase 1 is pure Playwright — 3 runs, median values, CDP network throttling, zero AI. Phase 2 feeds the data to a constrained Claude agent that must call a structured `report_findings` tool (no free-form hallucination).

Scoring weights: LCP 30%, TTFB 20%, TBT 15%, FCP 15%, Security 15%, CLS 5%. INP is excluded because it requires real user interaction.

Known limitations are documented on the site. This is synthetic testing from a single location — not RUM data. CLS is near-zero in headless browsers. Bot-blocking sites get flagged, not scored.

Try it: [link]
GitHub: [link]

Built with Playwright, React, Node.js, and Claude Haiku. CMU senior project.

---

## Option B: Technical / Architecture-Led

**Title:** Show HN: PerfRank – Deterministic web benchmarks with constrained AI analysis

**Body:**

I built a web performance benchmarking tool that separates data collection from analysis — something Lighthouse combines into one opaque step.

Phase 1: Playwright collects Web Vitals under simulated 4G (CDP Network.emulateNetworkConditions). 3 runs, median values. Deterministic — same site, same score.

Phase 2: A Claude agent analyzes the collected data in a multi-turn loop (up to 5 turns, 3 follow-up tool calls). It's constrained via tool_choice to call report_findings with structured output. It can request additional screenshots or run follow-up JS evaluations, but it cannot fabricate metrics.

Security headers (HSTS, CSP, X-Frame-Options, etc.) are 15% of the score — because a fast site with no HTTPS isn't actually good.

Results are public. HN scores 93/A. Shopify scores 55/F. Submit your own site and see.

Honest about limitations: synthetic only, single location, CLS is meaningless in headless browsers, INP excluded entirely.

Try it: [link]
Source: [link]

---

## Option C: Short / Casual

**Title:** Show HN: PerfRank – Public web performance leaderboard

**Body:**

Built a tool that benchmarks websites using Playwright under simulated 4G, scores them on Web Vitals + security headers, and runs constrained AI analysis to explain why.

HN gets an A. Shopify gets an F. Try your own site.

The AI part is agentic (multi-turn with tools), not a single prompt-and-pray LLM call. It must output structured findings via tool_choice — can't hallucinate scores.

Methodology and known limitations are on the site.

[link] | [github]

---

## Posting Tips

- Post between 8-10am ET on a weekday (Tue/Wed/Thu are best)
- Reply to early comments fast — engagement drives ranking
- If someone asks "how is this different from Lighthouse?" — the answer is: separated collection from analysis, security headers in the score, constrained AI reasoning, and honest about synthetic limitations
- If someone says "CLS is always 0" — agree, explain headless limitation, point to the 5% weight
- If someone finds a bug — fix it live and reply "fixed, thanks" — HN loves responsive maintainers
