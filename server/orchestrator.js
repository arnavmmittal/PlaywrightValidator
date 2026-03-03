const { chromium } = require('playwright');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Test info mapping
const TEST_INFO = {
  nav_depth: { label: 'URL depth crawl (2-3 levels)', category: 'Navigation & Routing' },
  nav_back_fwd: { label: 'Forward / Back navigation', category: 'Navigation & Routing' },
  nav_broken: { label: 'Broken link detection', category: 'Navigation & Routing' },
  form_fill: { label: 'Form auto-fill & submit', category: 'Forms & Interaction' },
  form_validation: { label: 'Form validation checks', category: 'Forms & Interaction' },
  cmd_execute: { label: 'Command execution', category: 'Forms & Interaction' },
  search_prompts: { label: 'Prompt injection tests', category: 'Search & Prompts' },
  search_history: { label: 'Search history verification', category: 'Search & Prompts' },
  search_delete: { label: 'History deletion & confirm', category: 'Search & Prompts' },
  store_browse: { label: 'App/plugin store browsing', category: 'App Store & Plugins' },
  store_install: { label: 'Agent/plugin install flow', category: 'App Store & Plugins' },
  store_search: { label: 'Store search & filtering', category: 'App Store & Plugins' },
  sec_xss: { label: 'XSS injection attempts', category: 'Security & Malicious Input' },
  sec_sqli: { label: 'SQL injection probes', category: 'Security & Malicious Input' },
  sec_overflow: { label: 'Input overflow & fuzzing', category: 'Security & Malicious Input' },
  src_js: { label: 'JS instrumentation check', category: 'View Source & Code Audit' },
  src_meta: { label: 'Meta tag & SEO audit', category: 'View Source & Code Audit' },
  src_console: { label: 'Console error capture', category: 'View Source & Code Audit' },
  perf_vitals: { label: 'Core Web Vitals', category: 'Performance & Vitals' },
  perf_load: { label: 'Page load time profiling', category: 'Performance & Vitals' },
  perf_stress: { label: 'Load / stress testing', category: 'Performance & Vitals' },
  exp_random: { label: 'Random click exploration', category: 'Exploratory & Ad-Hoc' },
  exp_responsive: { label: 'Responsive breakpoint test', category: 'Exploratory & Ad-Hoc' },
  exp_a11y: { label: 'Accessibility quick scan', category: 'Exploratory & Ad-Hoc' },
};

class TestOrchestrator {
  constructor(sessionId, config, broadcast) {
    this.sessionId = sessionId;
    this.config = config;
    this.broadcast = broadcast;
    this.bugs = [];
    this.vitals = null;
    this.sourceAudit = {
      thirdPartyScripts: 0,
      analyticsProviders: [],
      inlineEventHandlers: 0,
      consoleErrors: 0,
      missingMetaTags: [],
      totalDomNodes: 0,
    };
    this.screenshotDir = path.join(__dirname, '../screenshots', sessionId);

    // Create screenshot directory if needed
    if (config.options?.screenshots) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  async run() {
    const { url, tests, options } = this.config;
    const startTime = Date.now();

    this.broadcast({ type: 'browser_launched', browser: 'Chromium' });

    const browser = await chromium.launch({
      headless: options.headless !== false
    });

    try {
      const context = await browser.newContext({
        viewport: options.viewport || { width: 1280, height: 720 },
        userAgent: options.userAgent || undefined,
      });

      const page = await context.newPage();

      // Capture console errors globally
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
          this.broadcast({ type: 'log', text: `Console error: ${msg.text().slice(0, 100)}`, color: '#FF6B35' });
        }
      });

      page.on('pageerror', error => {
        consoleErrors.push(error.message);
      });

      // Handle dialogs (for XSS detection)
      page.on('dialog', async dialog => {
        this.broadcast({ type: 'log', text: `Dialog detected: ${dialog.message()}`, color: '#FF6B35' });
        await dialog.dismiss();
      });

      // Navigate to target
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: (options.timeout || 30) * 1000
        });
        this.broadcast({ type: 'navigated', url });
      } catch (navError) {
        this.broadcast({ type: 'error', message: `Failed to navigate: ${navError.message}` });
        throw navError;
      }

      // Take initial screenshot
      if (options.screenshots) {
        await page.screenshot({ path: path.join(this.screenshotDir, 'initial.png'), fullPage: true });
      }

      const totalTests = tests.length;
      let completed = 0;

      for (const testId of tests) {
        const testInfo = TEST_INFO[testId] || { label: testId, category: 'Unknown' };

        this.broadcast({
          type: 'test_start',
          testId,
          label: testInfo.label,
          category: testInfo.category
        });

        try {
          const testBugs = await this.runTest(testId, page, context, browser, options, consoleErrors);
          this.bugs.push(...testBugs);

          for (const bug of testBugs) {
            this.broadcast({ type: 'bug_found', bug });
          }

          this.broadcast({
            type: 'test_complete',
            testId,
            status: 'done',
            bugsFound: testBugs.length
          });
        } catch (error) {
          this.broadcast({
            type: 'log',
            text: `Test ${testId} failed: ${error.message}`,
            color: '#FF2D2D'
          });

          this.broadcast({
            type: 'test_complete',
            testId,
            status: 'error',
            bugsFound: 0
          });
        }

        completed++;
        this.broadcast({
          type: 'progress',
          percent: Math.round((completed / totalTests) * 100),
          completed,
          total: totalTests
        });
      }

      // Update console errors count
      this.sourceAudit.consoleErrors = consoleErrors.length;

      await context.close();
    } finally {
      await browser.close();
    }

    const report = this.generateReport(startTime);
    this.broadcast({ type: 'complete', report });
    return report;
  }

  async runTest(testId, page, context, browser, options, consoleErrors) {
    // Import test modules dynamically
    const testRunners = {
      // Navigation tests
      nav_depth: async () => {
        const { runNavDepth } = require('./tests/navigation.test');
        return runNavDepth(page, this.config.url, options, this.broadcast);
      },
      nav_back_fwd: async () => {
        const { runNavBackFwd } = require('./tests/navigation.test');
        return runNavBackFwd(page, this.config.url, options, this.broadcast);
      },
      nav_broken: async () => {
        const { runNavBroken } = require('./tests/navigation.test');
        return runNavBroken(page, this.config.url, options, this.broadcast);
      },

      // Source audit tests
      src_js: async () => {
        const { runSrcJs } = require('./tests/source-audit.test');
        return runSrcJs(page, this.config.url, options, this.broadcast, this);
      },
      src_meta: async () => {
        const { runSrcMeta } = require('./tests/source-audit.test');
        return runSrcMeta(page, this.config.url, options, this.broadcast, this);
      },
      src_console: async () => {
        const { runSrcConsole } = require('./tests/source-audit.test');
        return runSrcConsole(page, this.config.url, options, this.broadcast, this, consoleErrors);
      },

      // Performance tests
      perf_vitals: async () => {
        const { runPerfVitals } = require('./tests/performance.test');
        return runPerfVitals(page, this.config.url, options, this.broadcast, this);
      },
      perf_load: async () => {
        const { runPerfLoad } = require('./tests/performance.test');
        return runPerfLoad(page, this.config.url, options, this.broadcast);
      },
      perf_stress: async () => {
        const { runPerfStress } = require('./tests/performance.test');
        return runPerfStress(page, this.config.url, options, this.broadcast, browser);
      },

      // Security tests
      sec_xss: async () => {
        const { runSecXss } = require('./tests/security.test');
        return runSecXss(page, this.config.url, options, this.broadcast);
      },
      sec_sqli: async () => {
        const { runSecSqli } = require('./tests/security.test');
        return runSecSqli(page, this.config.url, options, this.broadcast);
      },
      sec_overflow: async () => {
        const { runSecOverflow } = require('./tests/security.test');
        return runSecOverflow(page, this.config.url, options, this.broadcast);
      },

      // Forms tests
      form_fill: async () => {
        const { runFormFill } = require('./tests/forms.test');
        return runFormFill(page, this.config.url, options, this.broadcast);
      },
      form_validation: async () => {
        const { runFormValidation } = require('./tests/forms.test');
        return runFormValidation(page, this.config.url, options, this.broadcast);
      },
      cmd_execute: async () => {
        const { runCmdExecute } = require('./tests/forms.test');
        return runCmdExecute(page, this.config.url, options, this.broadcast);
      },

      // Search tests
      search_prompts: async () => {
        const { runSearchPrompts } = require('./tests/search.test');
        return runSearchPrompts(page, this.config.url, options, this.broadcast);
      },
      search_history: async () => {
        const { runSearchHistory } = require('./tests/search.test');
        return runSearchHistory(page, this.config.url, options, this.broadcast);
      },
      search_delete: async () => {
        const { runSearchDelete } = require('./tests/search.test');
        return runSearchDelete(page, this.config.url, options, this.broadcast);
      },

      // Marketplace tests
      store_browse: async () => {
        const { runStoreBrowse } = require('./tests/marketplace.test');
        return runStoreBrowse(page, this.config.url, options, this.broadcast);
      },
      store_install: async () => {
        const { runStoreInstall } = require('./tests/marketplace.test');
        return runStoreInstall(page, this.config.url, options, this.broadcast);
      },
      store_search: async () => {
        const { runStoreSearch } = require('./tests/marketplace.test');
        return runStoreSearch(page, this.config.url, options, this.broadcast);
      },

      // Exploratory tests
      exp_random: async () => {
        const { runExpRandom } = require('./tests/exploratory.test');
        return runExpRandom(page, this.config.url, options, this.broadcast);
      },
      exp_responsive: async () => {
        const { runExpResponsive } = require('./tests/exploratory.test');
        return runExpResponsive(page, this.config.url, options, this.broadcast, this.screenshotDir);
      },
      exp_a11y: async () => {
        const { runExpA11y } = require('./tests/exploratory.test');
        return runExpA11y(page, this.config.url, options, this.broadcast);
      },
    };

    if (testRunners[testId]) {
      return await testRunners[testId]();
    }

    // Fallback for unimplemented tests
    this.broadcast({ type: 'log', text: `Running ${testId}...`, color: '#4ECDC4' });
    await new Promise(r => setTimeout(r, 500));
    return [];
  }

  generateReport(startTime) {
    const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const bug of this.bugs) {
      if (summary.hasOwnProperty(bug.severity)) {
        summary[bug.severity]++;
      }
    }

    return {
      sessionId: this.sessionId,
      url: this.config.url,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      testsRun: this.config.tests.length,
      summary,
      vitals: this.vitals || {
        lcp: { value: 0, unit: 'ms', rating: 'unknown' },
        fid: { value: 0, unit: 'ms', rating: 'unknown' },
        cls: { value: 0, unit: '', rating: 'unknown' },
        ttfb: { value: 0, unit: 'ms', rating: 'unknown' },
        fcp: { value: 0, unit: 'ms', rating: 'unknown' },
      },
      sourceAudit: this.sourceAudit,
      bugs: this.bugs,
    };
  }
}

module.exports = { TestOrchestrator };
