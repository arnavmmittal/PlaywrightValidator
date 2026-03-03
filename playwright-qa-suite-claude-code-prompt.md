# Playwright QA Suite — Full Build Prompt for Claude Code

## Project Overview

Build a **full-stack Playwright-based web testing automation tool** with a React frontend UI. The tool takes any URL as input (default-targeted at `copilot.microsoft.com`), lets the user select test categories via checkboxes, executes real Playwright tests against the target, and generates a comprehensive, shareable bug report.

The project has two halves:
1. **React frontend** — a dark-themed developer dashboard with three panels: Configure → Execution → Report
2. **Node.js backend + Playwright test engine** — an Express API server that orchestrates real Playwright test scripts, streams execution progress via WebSocket, and returns structured bug report JSON

---

## Architecture

```
playwright-qa-suite/
├── package.json
├── server/
│   ├── index.js                  # Express + WebSocket server
│   ├── orchestrator.js           # Test runner coordinator
│   ├── reporters/
│   │   ├── json-reporter.js      # Structured JSON bug report output
│   │   └── pdf-reporter.js       # PDF export using puppeteer or pdfkit
│   └── tests/
│       ├── navigation.test.js    # URL depth crawl, forward/back, broken links
│       ├── forms.test.js         # Form detection, auto-fill, validation
│       ├── search.test.js        # Prompt injection, history verify, history delete
│       ├── marketplace.test.js   # App store browsing, install flows, filtering
│       ├── security.test.js      # XSS, SQLi, overflow/fuzzing
│       ├── source-audit.test.js  # JS instrumentation, meta tags, console errors
│       ├── performance.test.js   # Core Web Vitals, load profiling, stress test
│       └── exploratory.test.js   # Random click, responsive, accessibility
├── client/
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── ConfigPanel.jsx
│   │   │   ├── ExecutionPanel.jsx
│   │   │   ├── ReportPanel.jsx
│   │   │   ├── BugCard.jsx
│   │   │   ├── VitalsCard.jsx
│   │   │   └── SourceAuditCard.jsx
│   │   ├── hooks/
│   │   │   └── useWebSocket.js
│   │   └── utils/
│   │       └── constants.js
│   └── public/
│       └── index.html
└── README.md
```

**Tech stack:**
- **Frontend**: React 18 + Vite, Tailwind CSS (dark theme), lucide-react icons, recharts for vitals charting, WebSocket client for live progress
- **Backend**: Node.js, Express, `ws` (WebSocket), Playwright (chromium)
- **Reports**: pdfkit or @react-pdf/renderer for PDF export
- **No database needed** — results stored in-memory per session

---

## Frontend UI Specification

Use the following React component as the **exact design reference** for the UI. The production app should match this aesthetic: dark background (#0D0D0D), neon-green accent (#E8FF47), JetBrains Mono for data, Outfit for display text, card-based layout with subtle borders.

### Reference UI Component (use as design source of truth)

```jsx
import { useState, useEffect, useRef } from "react";

const TEST_CATEGORIES = [
  {
    id: "navigation",
    label: "Navigation & Routing",
    icon: "🧭",
    tests: [
      { id: "nav_depth", label: "URL depth crawl (2-3 levels)", desc: "Follows links from target URL up to 3 levels deep" },
      { id: "nav_back_fwd", label: "Forward / Back navigation", desc: "Tests browser history navigation on discovered pages" },
      { id: "nav_broken", label: "Broken link detection", desc: "Checks all links for 404s, redirects, and dead ends" },
    ],
  },
  {
    id: "interaction",
    label: "Forms & Interaction",
    icon: "✍️",
    tests: [
      { id: "form_fill", label: "Form auto-fill & submit", desc: "Detects forms, fills valid data, and submits" },
      { id: "form_validation", label: "Form validation checks", desc: "Tests required fields, email formats, boundary values" },
      { id: "cmd_execute", label: "Command execution", desc: "Tests interactive commands, buttons, and CTAs" },
    ],
  },
  {
    id: "search",
    label: "Search & Prompts",
    icon: "🔍",
    tests: [
      { id: "search_prompts", label: "Prompt injection tests", desc: "Sends varied prompts to search/chat boxes" },
      { id: "search_history", label: "Search history verification", desc: "Checks if search terms appear in history" },
      { id: "search_delete", label: "History deletion & confirm", desc: "Deletes history items and verifies confirmation flow" },
    ],
  },
  {
    id: "marketplace",
    label: "App Store & Plugins",
    icon: "🧩",
    tests: [
      { id: "store_browse", label: "App/plugin store browsing", desc: "Navigates store categories, filters, and listings" },
      { id: "store_install", label: "Agent/plugin install flow", desc: "Tests install, enable, disable, and uninstall" },
      { id: "store_search", label: "Store search & filtering", desc: "Searches for apps/plugins and tests filter combos" },
    ],
  },
  {
    id: "security",
    label: "Security & Malicious Input",
    icon: "🛡️",
    tests: [
      { id: "sec_xss", label: "XSS injection attempts", desc: "Injects script tags and event handlers into inputs" },
      { id: "sec_sqli", label: "SQL injection probes", desc: "Tests common SQL injection patterns" },
      { id: "sec_overflow", label: "Input overflow & fuzzing", desc: "Sends oversized, malformed, and edge-case data" },
    ],
  },
  {
    id: "source",
    label: "View Source & Code Audit",
    icon: "📜",
    tests: [
      { id: "src_js", label: "JS instrumentation check", desc: "Flags excessive tracking scripts, beacons, and analytics" },
      { id: "src_meta", label: "Meta tag & SEO audit", desc: "Checks meta tags, OG tags, and canonical URLs" },
      { id: "src_console", label: "Console error capture", desc: "Captures all console errors, warnings, and logs" },
    ],
  },
  {
    id: "performance",
    label: "Performance & Vitals",
    icon: "⚡",
    tests: [
      { id: "perf_vitals", label: "Core Web Vitals (LCP, FID, CLS)", desc: "Measures Google Core Web Vitals metrics" },
      { id: "perf_load", label: "Page load time profiling", desc: "Profiles full page load waterfall and bottlenecks" },
      { id: "perf_stress", label: "Load / stress testing", desc: "Simulates concurrent users and rapid interactions" },
    ],
  },
  {
    id: "exploratory",
    label: "Exploratory & Ad-Hoc",
    icon: "🔬",
    tests: [
      { id: "exp_random", label: "Random click exploration", desc: "Randomly clicks elements and reports anomalies" },
      { id: "exp_responsive", label: "Responsive breakpoint test", desc: "Tests layout at mobile, tablet, and desktop widths" },
      { id: "exp_a11y", label: "Accessibility quick scan", desc: "Checks ARIA labels, contrast, focus order, alt text" },
    ],
  },
];

const SEVERITY_COLORS = {
  critical: { bg: "#FF2D2D", text: "#fff" },
  high: { bg: "#FF6B35", text: "#fff" },
  medium: { bg: "#F5A623", text: "#1a1a1a" },
  low: { bg: "#4ECDC4", text: "#1a1a1a" },
  info: { bg: "#7B8794", text: "#fff" },
};
```

---

## Panel 1: Configure (the main landing view)

### Layout
- **Top bar (sticky)**: Logo left ("Playwright QA Suite"), three tab buttons right (Configure | Execution | Report) — the active tab has a neon-green border and tinted background
- **URL input section**: Full-width card with monospace input field, neon-green text for the URL, and a "▶ Run N Tests" button that dynamically shows the count of selected tests. Below the URL input: inline checkboxes for "Headless mode", "Capture screenshots", and a small numeric input for "Timeout (sec)"
- **Select All bar**: Shows "Test Suite — X of Y selected" with a Select All / Deselect All toggle button
- **Test category grid**: Responsive CSS grid (auto-fill, minmax 310px). Each category is a card with:
  - Header row: emoji icon, category label, and "N/M" count badge (neon-green when > 0). Clicking the header toggles all tests in that category
  - Body: individual test checkboxes with label + one-line description in muted text

### Behavior
- URL input accepts any valid URL
- "Run" button is disabled (grayed out) when 0 tests are selected
- Select All toggles every test across all categories
- Category header click toggles all tests in that category
- Individual checkboxes toggle independently
- Selected count updates in real-time on both the "Run" button and the "X of Y selected" label

---

## Panel 2: Execution (live test progress)

### Layout
- Centered vertically in the viewport
- Large spinning icon (⟳ with CSS rotation animation) that switches to ✓ when complete
- Status text: "Executing Tests…" → "Generating Report…" → auto-navigate to Report panel
- Target URL shown below in muted monospace
- Full-width progress bar (neon-green gradient fill) with percentage
- Current test name displayed above the progress bar
- Terminal-style log box (dark background, monospace text) that shows:
  - `$ playwright test --config=qa-suite.config.ts`
  - `✓ Browser launched (Chromium 120.0)`
  - `✓ Navigated to {url}`
  - `▸ Running: {test name}` (one line per test, appended in real-time)
  - `✓ All tests complete — analyzing results…`

### Behavior
- Progress bar fills proportionally as each test completes
- Log auto-scrolls to bottom as new lines appear
- WebSocket connection receives real-time updates from the backend:
  ```json
  { "type": "test_start", "testId": "nav_depth", "label": "URL depth crawl (2-3 levels)" }
  { "type": "test_complete", "testId": "nav_depth", "status": "pass", "bugs": [...] }
  { "type": "progress", "percent": 45, "currentTest": "Form auto-fill & submit" }
  { "type": "log", "text": "✓ Found 12 links at depth 1", "color": "#4ECDC4" }
  { "type": "complete", "report": { ... } }
  ```
- On `"complete"` message, auto-transition to Report panel after a 1.5s delay

---

## Panel 3: Report (bug report dashboard)

### Layout
- **Header row**: "Bug Report — {url}" with date, issue count, test count. Right side: Copy, Export PDF, and Share Report buttons
- **Severity summary strip**: Horizontal row of 5 small cards (critical, high, medium, low, info) each showing a color dot, label, and count in large bold monospace text
- **Core Web Vitals card**: Grid of 5 metrics (LCP, FID, CLS, TTFB, FCP) each with:
  - Metric abbreviation label
  - Large numeric value color-coded: green (#4ECDC4) = good, amber (#F5A623) = needs improvement, red (#FF2D2D) = poor
  - Threshold text below (e.g., "threshold < 2.5s")
- **Source Audit Summary card**: Grid of key-value pairs (third-party scripts count, analytics providers, inline event handlers, console errors, missing meta tags, total DOM nodes)
- **Issues list**: Expandable bug cards sorted by severity (critical first). Each card:
  - **Collapsed row**: Severity badge (colored pill), bug title, category tag, expand chevron
  - **Expanded view**: Description paragraph, then two-column layout:
    - Left: "Steps to Reproduce" in a code-style pre block
    - Right: "Expected" (green tint) and "Actual" (orange tint) blocks
  - If screenshots were captured, show them as thumbnails in the expanded view
- **"← Run New Tests" button** at bottom center to return to Configure panel

### Behavior
- Clicking a bug card row toggles its expanded state
- "Copy" button copies the full report as formatted Markdown to clipboard
- "Export PDF" button calls the backend `/api/report/pdf` endpoint and triggers download
- "Share Report" generates a shareable link (or downloads a self-contained HTML file)
- Severity filter chips (optional): click a severity badge in the summary strip to filter the issues list

---

## Backend API Specification

### Endpoints

```
POST /api/test/run
  Body: { url: string, tests: string[], options: { headless: bool, screenshots: bool, timeout: number } }
  Response: { sessionId: string }
  → Kicks off the test run. Client connects to WebSocket with sessionId for live updates.

GET /api/report/:sessionId
  Response: Full JSON report object (see schema below)

GET /api/report/:sessionId/pdf
  Response: PDF file download

GET /api/report/:sessionId/screenshots/:bugId
  Response: Screenshot image file

WebSocket /ws/:sessionId
  → Streams test progress, logs, and final report
```

### Report JSON Schema

```json
{
  "sessionId": "uuid",
  "url": "https://copilot.microsoft.com",
  "timestamp": "ISO-8601",
  "duration_ms": 45000,
  "testsRun": 24,
  "summary": {
    "critical": 1,
    "high": 2,
    "medium": 2,
    "low": 2,
    "info": 1
  },
  "vitals": {
    "lcp": { "value": 4200, "unit": "ms", "rating": "poor" },
    "fid": { "value": 85, "unit": "ms", "rating": "needs-improvement" },
    "cls": { "value": 0.03, "unit": "", "rating": "good" },
    "ttfb": { "value": 620, "unit": "ms", "rating": "needs-improvement" },
    "fcp": { "value": 1800, "unit": "ms", "rating": "needs-improvement" }
  },
  "sourceAudit": {
    "thirdPartyScripts": 47,
    "analyticsProviders": ["Google Analytics", "Clarity", "..."],
    "inlineEventHandlers": 23,
    "consoleErrors": 3,
    "missingMetaTags": ["description", "og:image", "..."],
    "totalDomNodes": 2847
  },
  "bugs": [
    {
      "id": "bug-uuid",
      "severity": "critical",
      "title": "XSS vulnerability in search input",
      "category": "Security",
      "testId": "sec_xss",
      "description": "Unescaped script tags execute in search box...",
      "stepsToReproduce": ["Navigate to search", "Enter payload", "Observe execution"],
      "expected": "Input should be sanitized",
      "actual": "Script executes in page context",
      "screenshot": "screenshots/bug-uuid.png",
      "consoleOutput": "Uncaught...",
      "url": "https://copilot.microsoft.com/search",
      "timestamp": "ISO-8601"
    }
  ]
}
```

---

## Test Implementation Details

Each test file in `server/tests/` exports an async function that receives a Playwright `page` object, the target URL, and options. It returns an array of bug objects.

### 1. navigation.test.js

```
async function runNavigationTests(page, url, options) → Bug[]
```

**nav_depth — URL Depth Crawl (2-3 levels)**
- Navigate to the target URL
- Collect all `<a>` href attributes on the page (same-origin only)
- Visit each link (level 1), collect links on those pages (level 2), and optionally level 3
- For each page visited: check HTTP status, check for JS errors in console, check page title exists
- Flag: any page returning 4xx/5xx, any page with JS console errors, any page with empty `<title>`

**nav_back_fwd — Forward/Back Navigation**
- Navigate to target → click a link → press `page.goBack()` → verify URL matches original → press `page.goForward()` → verify URL matches the link destination
- Do this for 3-5 different links
- Flag: URL mismatch after back/forward, page content not restored, console errors after navigation

**nav_broken — Broken Link Detection**
- Collect all `<a>` hrefs on the target page
- For each link, send a HEAD request (or navigate) and check status code
- Flag: 404, 500, timeout, redirect chains > 3 hops

### 2. forms.test.js

**form_fill — Form Auto-Fill & Submit**
- Use `page.$$('form')` to detect all forms
- For each form, identify input types (text, email, password, textarea, select, checkbox, radio)
- Fill with valid test data using Playwright's `fill()`, `selectOption()`, `check()`
- Submit via submit button click or Enter key
- Flag: form submission errors, unexpected redirects, console errors post-submit

**form_validation — Form Validation Checks**
- For each form: try submitting empty, try invalid email format, try boundary-length strings
- Check for validation messages (HTML5 `validationMessage` or custom error elements)
- Flag: missing validation, validation that can be bypassed, no error messages shown

**cmd_execute — Command/Button Execution**
- Find all `<button>`, `[role="button"]`, `<a>` elements with click handlers
- Click each one (with timeout catch)
- Flag: unresponsive buttons (no DOM change, no network request, no navigation), console errors on click

### 3. search.test.js

**search_prompts — Prompt/Search Box Testing**
- Detect search inputs: `input[type="search"]`, `input[type="text"]`, `textarea`, `[role="searchbox"]`, `[role="textbox"]`
- Send a variety of prompts:
  - Normal queries: "What is the weather today", "Help me write an email"
  - Edge cases: empty string, single character, 10,000 character string
  - Special characters: `<script>alert(1)</script>`, `'; DROP TABLE;--`, unicode, emojis, RTL text
- For each: check that the page doesn't crash, check for error messages, check for proper rendering of response
- Flag: unhandled errors, garbled rendering, blank responses to valid queries

**search_history — Search History Verification**
- Enter a unique search term (e.g., "playwrightQAtest_" + timestamp)
- After submission, look for a history/recent searches UI element
- Check if the search term appears in history
- Flag: term not appearing, history not updating without page reload

**search_delete — History Deletion & Confirmation**
- Find history/recent items in the UI
- Click delete on an item
- Verify a confirmation dialog appears
- Confirm deletion
- Verify the item is removed from the list
- Also test: dismissing the confirmation (item should remain)
- Flag: no confirmation prompt, item deleted on dismiss, item persists after confirmed delete

### 4. marketplace.test.js

**store_browse — App/Plugin Store Browsing**
- Look for navigation elements pointing to a store, marketplace, plugins, or extensions section
- Navigate to it
- Check that category listings load, cards/tiles render with images and titles
- Click into 2-3 different items and verify detail pages load
- Flag: empty listings, broken images, missing titles, 404 on detail pages

**store_install — Agent/Plugin Install Flow**
- On a plugin/agent detail page, find the install/add/enable button
- Click it and observe the response
- Check for success confirmation
- If there's an uninstall/disable option, test that too
- Flag: button unresponsive, no confirmation, errors during install/uninstall

**store_search — Store Search & Filtering**
- Find the store's search input
- Search for common terms ("productivity", "writing", "code")
- Verify results appear and are relevant
- If filter/category dropdowns exist, test each option
- Flag: no results for common terms, filters not working, search returning errors

### 5. security.test.js

**sec_xss — XSS Injection Attempts**
- Target every text input, textarea, and URL parameter on the page
- Inject payloads:
  - `<script>alert('XSS')</script>`
  - `<img src=x onerror=alert('XSS')>`
  - `<svg onload=alert('XSS')>`
  - `javascript:alert('XSS')`
  - Event handler attributes: `" onfocus="alert('XSS')" autofocus="`
- After each injection, check if:
  - A dialog appeared (`page.on('dialog')`)
  - The payload appears unescaped in the DOM
  - Console shows execution
- Flag: any XSS execution, any unescaped reflection of payload in page source

**sec_sqli — SQL Injection Probes**
- Inject into text inputs and URL parameters:
  - `' OR '1'='1`
  - `1; DROP TABLE users;--`
  - `' UNION SELECT null,null,null--`
  - `admin'--`
- Check for: database error messages in response, unusual page behavior, error codes
- Flag: SQL error messages exposed, different behavior with SQL payloads vs normal input

**sec_overflow — Input Overflow & Fuzzing**
- Send to each input:
  - 100,000 character string
  - Null bytes: `\x00`
  - Format string specifiers: `%s%s%s%s%s`
  - Negative numbers in numeric fields
  - Extremely long email addresses
  - Binary data
- Flag: server errors (500), crashes, unhandled exceptions, truncation without warning

### 6. source-audit.test.js

**src_js — JS Instrumentation Check**
- Get page source via `page.content()`
- Parse all `<script>` tags (both inline and external)
- Categorize external scripts by domain (analytics, tracking, ads, social, etc.)
- Count total third-party scripts and identify providers
- Known tracker domains: google-analytics.com, clarity.ms, hotjar.com, facebook.net, doubleclick.net, etc.
- Flag: > 10 third-party scripts (warning), > 25 (high), > 40 (critical). List each provider.

**src_meta — Meta Tag & SEO Audit**
- Check for: `<title>`, `<meta name="description">`, `<meta name="viewport">`, canonical URL
- Check for OG tags: og:title, og:description, og:image, og:url
- Check for Twitter card tags
- Check for structured data (JSON-LD)
- Flag: missing required meta tags, empty meta content, missing OG tags

**src_console — Console Error Capture**
- Attach `page.on('console', ...)` before navigation
- Capture all console messages (log, warn, error, info)
- Also capture `page.on('pageerror', ...)` for uncaught exceptions
- Navigate through 3-5 pages and interact with major features
- Flag: any console errors or uncaught exceptions (with full message and stack trace)

### 7. performance.test.js

**perf_vitals — Core Web Vitals**
- Use Playwright's CDP session to capture performance metrics:
  ```javascript
  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  ```
- Or inject web-vitals library and capture LCP, FID, CLS, TTFB, FCP
- Also use `page.evaluate(() => performance.getEntriesByType('navigation'))` for timing data
- Rate against Google thresholds:
  - LCP: good < 2.5s, needs improvement < 4s, poor >= 4s
  - FID: good < 100ms, needs improvement < 300ms, poor >= 300ms
  - CLS: good < 0.1, needs improvement < 0.25, poor >= 0.25
- Flag: any metric rated "poor", multiple "needs improvement"

**perf_load — Page Load Profiling**
- Measure: DNS lookup, TCP connection, TLS handshake, TTFB, content download, DOM parsing, resource loading
- Use Navigation Timing API via `page.evaluate()`
- Identify largest resources (images, scripts, fonts) and their load times
- Flag: total load time > 5s, any single resource > 2s, render-blocking resources

**perf_stress — Load/Stress Testing**
- Open multiple browser contexts simultaneously (5, 10, 20)
- Each context navigates to the target URL and performs basic interactions
- Measure response times under concurrent load
- Flag: response time degradation > 50%, errors under load, timeouts

### 8. exploratory.test.js

**exp_random — Random Click Exploration**
- Get all clickable elements on the page
- Randomly click 20-30 elements with a short delay between each
- After each click: check for console errors, check for unexpected navigation, check for visual anomalies (element overlap detection)
- Flag: any crash, unhandled errors, unexpected dialogs, broken UI state

**exp_responsive — Responsive Breakpoint Testing**
- Test at viewport widths: 320px (mobile), 768px (tablet), 1024px (small desktop), 1440px (desktop), 1920px (large)
- At each breakpoint: screenshot, check for horizontal overflow (`scrollWidth > clientWidth`), check for overlapping elements, check for text truncation without ellipsis
- Flag: horizontal scroll at any breakpoint, elements overflowing viewport, broken layouts

**exp_a11y — Accessibility Quick Scan**
- Check all `<img>` tags for alt text
- Check all interactive elements for ARIA labels or visible text
- Check color contrast ratios (inject axe-core or similar)
- Check focus order: Tab through the page and verify focus is visible and logical
- Check for skip navigation link
- Flag: missing alt text (count), missing ARIA labels (count), contrast failures, no visible focus indicator

---

## Screenshots

When `options.screenshots` is true:
- Take a full-page screenshot on initial load
- Take a screenshot whenever a bug is detected (capture the state that demonstrates the bug)
- Take screenshots at each responsive breakpoint
- Store in `./screenshots/{sessionId}/` with filenames matching bug IDs
- Include screenshot paths in bug objects

---

## WebSocket Protocol

The server sends JSON messages over WebSocket during test execution:

```javascript
// Connection
ws://localhost:3001/ws/{sessionId}

// Server → Client messages:
{ "type": "connected", "sessionId": "..." }
{ "type": "browser_launched", "browser": "Chromium 120.0" }
{ "type": "navigated", "url": "https://..." }
{ "type": "test_start", "testId": "nav_depth", "label": "URL depth crawl (2-3 levels)", "category": "Navigation & Routing" }
{ "type": "log", "text": "Found 14 links at depth 1", "color": "#4ECDC4" }
{ "type": "log", "text": "⚠ 2 broken links detected", "color": "#FF6B35" }
{ "type": "bug_found", "bug": { ...bugObject } }
{ "type": "test_complete", "testId": "nav_depth", "status": "done", "bugsFound": 2 }
{ "type": "progress", "percent": 33, "completed": 8, "total": 24 }
{ "type": "screenshot", "bugId": "...", "path": "..." }
{ "type": "complete", "report": { ...fullReportJSON } }
{ "type": "error", "message": "Failed to navigate: timeout" }
```

---

## PDF Report Generation

When the user clicks "Export PDF", generate a professional PDF containing:
1. Header: "Playwright QA Suite — Bug Report" with URL and date
2. Executive summary: test count, duration, severity breakdown (as a colored table)
3. Core Web Vitals section with pass/fail indicators
4. Source Audit summary table
5. Full bug list with severity badges, descriptions, steps to reproduce, expected/actual
6. Screenshots embedded where available
7. Footer: page numbers, generation timestamp

Use `pdfkit` or `puppeteer` to render an HTML template to PDF.

---

## Error Handling

- If a page fails to load (timeout, DNS failure), report it as a critical bug and skip remaining tests that require that page
- If a specific test crashes, catch the error, log it, and continue with remaining tests
- If WebSocket disconnects, the frontend should show a reconnection prompt
- All test functions should be wrapped in try/catch and report errors gracefully
- Set a maximum overall timeout (default: 5 minutes) after which the run is terminated and partial results are returned

---

## Configuration Options (from frontend)

```javascript
{
  url: "https://copilot.microsoft.com",    // Any valid URL
  tests: ["nav_depth", "sec_xss", ...],    // Array of test IDs to run
  options: {
    headless: true,                          // Run browser headlessly
    screenshots: true,                       // Capture screenshots on bugs
    timeout: 30,                             // Per-test timeout in seconds
    browserType: "chromium",                 // chromium | firefox | webkit
    viewport: { width: 1280, height: 720 }, // Default viewport
    userAgent: null,                         // Custom user agent (optional)
  }
}
```

---

## Build & Run Instructions

The project should be runnable with:

```bash
# Install dependencies
npm install

# Start the backend server
npm run server
# → Express on http://localhost:3001
# → WebSocket on ws://localhost:3001/ws

# In another terminal, start the frontend
cd client && npm run dev
# → Vite dev server on http://localhost:5173

# Or for production:
npm run build
npm start
# → Serves both API and built frontend on http://localhost:3001
```

---

## Implementation Order

Build in this order to ensure incremental testability:

1. **Scaffold the project**: package.json, folder structure, install dependencies (playwright, express, ws, uuid, pdfkit)
2. **Backend skeleton**: Express server with POST /api/test/run, GET /api/report/:id, WebSocket setup
3. **Orchestrator**: Test runner that accepts config, iterates through selected tests, emits WebSocket events
4. **Navigation tests**: Start here — most straightforward Playwright usage
5. **Source audit tests**: Pure page analysis, no complex interaction
6. **Performance tests**: Uses CDP and Performance API
7. **Security tests**: Input injection patterns
8. **Search & Forms tests**: Interactive element detection and manipulation
9. **Marketplace tests**: Store navigation and interaction
10. **Exploratory tests**: Random/responsive/a11y
11. **Frontend**: React app matching the reference design, wired to WebSocket and API
12. **PDF reporter**: Export functionality
13. **Polish**: Error handling, edge cases, README

---

## Important Implementation Notes

- Use `page.waitForLoadState('networkidle')` or `'domcontentloaded'` appropriately — don't always wait for `networkidle` as some SPAs never reach it
- For Copilot specifically, the page is a React SPA — wait for specific selectors rather than page load events
- Use `page.on('dialog', dialog => dialog.dismiss())` to handle unexpected alerts during security testing (and log them as potential XSS findings)
- For stress testing, use `browser.newContext()` not `browser.newPage()` for proper isolation
- Collect console messages BEFORE navigating: attach listeners first, then `page.goto()`
- Use `{ timeout: options.timeout * 1000 }` on all Playwright actions
- For source audit, use `page.content()` for the full HTML and `page.evaluate()` for runtime DOM inspection — they can differ for SPAs
- Rate-limit requests during broken link checking to avoid getting blocked
- Clean up browser contexts and pages after each test to prevent memory leaks
