# PlaywrightValidator — Technical Briefing

## What It Is

PlaywrightValidator is a web application quality assurance platform that combines **deterministic browser-automated testing** with **autonomous AI-driven testing** to assess any public website across security, performance, accessibility, and UX dimensions.

## How It Works

### Deterministic Mode
Eight test modules (~11,000 lines) run scripted Playwright browser actions against the target URL:

- **Security** — 30+ XSS payloads, 25+ SQLi payloads, HTTP header analysis, CSRF checks
- **Performance** — Core Web Vitals (LCP, FCP, CLS, TTFB, INP, TBT), resource analysis, mobile viewport testing
- **Accessibility** — WCAG 2.1 AA scan, heading hierarchy, ARIA usage, keyboard navigation, color contrast
- **Navigation** — 3-level crawl, broken links, redirect chains, soft 404 detection
- **Forms** — All field types, validation, multi-step wizards, boundary testing
- **Source Audit** — Vulnerable library detection, exposed API keys, SEO meta audit, structured data
- **Search** — Edge cases, autocomplete, rate limiting, history management
- **Marketplace** — Install flows, pagination, detail pages, auth gates

### AI Agent Mode
An autonomous Claude agent receives 15 Playwright browser tools and decides what to test. It observes page structure, reasons about attack surfaces, executes actions, and adapts based on results. Five specialist modes:

| Mode | Focus |
|------|-------|
| Comprehensive | Full-spectrum testing across all domains |
| Security | Penetration testing — injections, headers, auth |
| Performance | Web Vitals, resource optimization, caching |
| Accessibility | WCAG 2.1 AA compliance |
| Exploratory | Edge cases, UX, error handling |

The agent runs 15 reasoning cycles with ~25 tool executions per session, producing findings with evidence and remediation recommendations.

## Architecture

```
React 19 + Tailwind CSS 4    Express + WebSocket    Playwright (Chromium/Firefox/WebKit)
       (Vite)                      |                          |
    Real-time UI  ←──  WS  ──→  API Server  ──→  Browser Automation
                                   |
                              Claude API (AI mode)
                         Tool-use loop with 15 tools
```

## Report Output

Both modes produce a unified report with:
- Health score (0–100) with letter grade (A+ through F)
- Severity-classified findings (critical/high/medium/low/info)
- Evidence and remediation per finding (AI mode)
- Core Web Vitals with pass/warn/fail thresholds
- Source audit metrics
- Exportable as **PDF** (enterprise-grade, 20+ pages) or **Markdown**
- Report comparison showing improved/regressed/persistent issues across runs

## Key Differentiator

Traditional QA tools run the same checks regardless of what the site looks like. The AI agent **adapts** — it discovers input fields, reasons about what payloads to try, follows up on interesting results with mutations, and reports findings with contextual evidence. This is the observe-reason-act loop that defines modern agentic AI systems.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, Recharts, Vite |
| Backend | Node.js, Express, WebSocket |
| Browser | Playwright (Chromium, Firefox, WebKit) |
| AI | Claude API (Anthropic), tool-use agentic loop |
| Reports | PDFKit, custom Markdown generator |

## Quick Start

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...  # for AI mode
npm run dev
```

Open `http://localhost:5173`, configure tests or enable AI mode, and run.
