export const TEST_CATEGORIES = [
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

export const SEVERITY_COLORS = {
  critical: { bg: "#FF2D2D", text: "#fff" },
  high: { bg: "#FF6B35", text: "#fff" },
  medium: { bg: "#F5A623", text: "#1a1a1a" },
  low: { bg: "#4ECDC4", text: "#1a1a1a" },
  info: { bg: "#7B8794", text: "#fff" },
};

export const VITALS_THRESHOLDS = {
  lcp: { good: 2500, label: "threshold < 2.5s" },
  fid: { good: 100, label: "threshold < 100ms" },
  cls: { good: 0.1, label: "threshold < 0.1" },
  ttfb: { good: 800, label: "threshold < 800ms" },
  fcp: { good: 1800, label: "threshold < 1.8s" },
};

export const getTotalTestCount = () => {
  return TEST_CATEGORIES.reduce((sum, cat) => sum + cat.tests.length, 0);
};

export const TEST_PRESETS = [
  {
    id: 'quick_scan',
    label: 'Quick Scan',
    description: 'Fast check of links, security, performance, and accessibility',
    icon: '🚀',
    testIds: ['nav_broken', 'sec_xss', 'perf_vitals', 'exp_a11y'],
  },
  {
    id: 'full_security',
    label: 'Full Security Audit',
    description: 'All security tests plus prompt injection and overflow fuzzing',
    icon: '🔒',
    testIds: ['sec_xss', 'sec_sqli', 'sec_overflow', 'search_prompts'],
  },
  {
    id: 'perf_deep_dive',
    label: 'Performance Deep Dive',
    description: 'All performance tests plus JS instrumentation and console errors',
    icon: '📊',
    testIds: ['perf_vitals', 'perf_load', 'perf_stress', 'src_js', 'src_console'],
  },
  {
    id: 'complete_suite',
    label: 'Complete Suite',
    description: 'Run every test in the suite for full coverage',
    icon: '🎯',
    testIds: TEST_CATEGORIES.flatMap(cat => cat.tests.map(t => t.id)),
  },
];

export const BROWSER_OPTIONS = [
  { id: 'chromium', label: 'Chromium' },
  { id: 'firefox', label: 'Firefox' },
  { id: 'webkit', label: 'WebKit' },
];
