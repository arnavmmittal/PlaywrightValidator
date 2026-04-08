# PerfRank

**Public web performance leaderboard.** Deterministic Playwright benchmarks + constrained AI analysis.

[Live Demo](https://web-production-458a9.up.railway.app) | [How It Works](#how-it-works) | [Architecture](#architecture)

---

## What is this?

PerfRank benchmarks websites under controlled conditions and ranks them on a public leaderboard. Unlike Lighthouse, it separates **data collection** from **analysis** — deterministic metrics first, then constrained AI reasoning.

**Current leaderboard (15 sites):**

| Rank | Site | Score | Grade |
|------|------|-------|-------|
| 1 | news.ycombinator.com | 93 | A |
| 2 | x.com | 92 | A |
| 3 | linear.app | 86 | B+ |
| 4 | google.com | 82 | B |
| 5 | wikipedia.org | 82 | B |
| ... | ... | ... | ... |
| 14 | dev.to | 65 | D |
| 15 | shopify.com | 55 | F |

Submit any URL and benchmark it yourself.

## How It Works

### Two-Phase Pipeline

```
Phase 1: Deterministic Collection          Phase 2: Constrained AI Analysis
┌──────────────────────────────┐          ┌──────────────────────────────┐
│  Playwright + CDP Throttling │          │  Claude (Haiku) + Tools      │
│                              │          │                              │
│  3 runs → median values      │   ───►   │  Up to 5 turns               │
│  Simulated 4G (1.5 Mbps)    │          │  tool_choice: required       │
│  6 Web Vitals + 7 sec hdrs  │          │  Must call report_findings   │
│  Screenshot + DOM analysis   │          │  Can request follow-up data  │
└──────────────────────────────┘          └──────────────────────────────┘
```

**Phase 1** is pure Playwright — no AI, no variance. Same browser, same viewport, same throttled network. Runs 3 times, takes the median.

**Phase 2** feeds the collected data to a Claude agent with 3 tools:
- `report_findings` (required) — structured output with scores, findings, recommendations
- `screenshot` — request additional screenshots of specific elements
- `evaluate_js` — run follow-up JavaScript evaluations

The AI explains *why* scores are what they are. It doesn't generate scores — those are deterministic.

### Scoring

| Metric | Weight | Source |
|--------|--------|--------|
| LCP (Largest Contentful Paint) | 30% | Playwright PerformanceObserver |
| TTFB (Time to First Byte) | 20% | Navigation Timing API |
| TBT (Total Blocking Time) | 15% | Long Task Observer (>50ms) |
| FCP (First Contentful Paint) | 15% | PerformanceObserver |
| Security Headers | 15% | 7 header checks (HSTS, CSP, etc.) |
| CLS (Cumulative Layout Shift) | 5% | LayoutShift Observer |

**INP is excluded** — it requires real user interaction, which synthetic tests can't provide. TBT serves as the interactivity proxy.

**Security headers** check for: HTTPS, HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy.

### Known Limitations

- **Synthetic, not RUM.** Scores reflect simulated 4G conditions from a single server location, not real-user metrics.
- **CLS is near-zero** in headless browsers (no scroll, no ads, no font loading). Weighted at 5%.
- **Bot-blocking sites** (Cloudflare Enterprise, CAPTCHAs) are detected and flagged, not scored.
- **AI analysis is advisory.** Deterministic metrics are the source of truth.
- **No CPU throttling.** Mobile devices with slower processors will see worse real-world TBT.

## Architecture

```
client/                          server/
├── src/                         ├── benchmark/
│   ├── App.jsx                  │   ├── collector.js      ← Playwright + CDP
│   └── components/              │   ├── analyzer.js       ← Claude agent loop
│       └── leaderboard/         │   ├── queue.js          ← Concurrency control
│           ├── LeaderboardTable │   └── leaderboard-store  ← JSON file store
│           ├── SiteDetailDrawer │
│           ├── HeroSection      ├── utils/
│           ├── HowItWorks       │   ├── perf-scoring.js   ← Deterministic scoring
│           └── BenchmarkProgress│   └── security-scoring   ← 7 header checks
│                                │
React + Vite                     ├── routes/
                                 │   └── leaderboard.js    ← API + WebSocket
                                 │
                                 ├── middleware/
                                 │   └── rate-limit.js     ← IP-based, per-day
                                 │
                                 Node.js + Express + WebSocket
```

## Security

- **SSRF protection:** Private IPs, localhost, cloud metadata ranges blocked
- **Rate limiting:** 2 benchmarks per IP per 24 hours
- **AI budget cap:** $5/day global limit (configurable via `AI_DAILY_BUDGET`)
- **Input validation:** URL format, domain validation, JSON body size limits
- **CORS restricted** in production

## Running Locally

```bash
# Clone and install
git clone https://github.com/arnavmmittal/PlaywrightValidator.git
cd PlaywrightValidator
npm install

# Set up environment
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# Development (runs both server + client)
npm run dev

# Production build
npm run build
npm start
```

## Tech Stack

- **Frontend:** React, Vite, Tailwind-style utility CSS, Lucide icons
- **Backend:** Node.js, Express, WebSocket (ws)
- **Browser:** Playwright with Chrome DevTools Protocol
- **AI:** Claude Haiku via Anthropic API (constrained tool use)
- **Deploy:** Railway with Nixpacks

## License

MIT
