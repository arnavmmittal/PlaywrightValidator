const { chromium, firefox, webkit } = require('playwright');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Browser map for selection
const BROWSERS = { chromium, firefox, webkit };

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

    // Select browser engine
    const browserName = options.browser || 'chromium';
    const browserType = BROWSERS[browserName] || chromium;

    // Support visible mode with slowMo for demos
    const launchOptions = {
      headless: options.headless !== false,
    };

    // Add slowMo for visible mode to make actions observable
    if (options.headless === false && options.slowMo) {
      launchOptions.slowMo = options.slowMo;
    }

    this.broadcast({
      type: 'browser_launched',
      browser: browserName.charAt(0).toUpperCase() + browserName.slice(1),
      headless: launchOptions.headless
    });

    const browser = await browserType.launch(launchOptions);

    try {
      const context = await browser.newContext({
        viewport: options.viewport || { width: 1280, height: 720 },
        userAgent: options.userAgent || undefined,
      });

      // Global console errors collected across all pages
      const consoleErrors = [];

      const maxRetries = Number(options.retries) || 0;
      const totalTests = tests.length;
      let completed = 0;

      if (options.parallel) {
        // Parallel execution with concurrency limit of 3
        await this._runParallel(tests, context, browser, options, consoleErrors, maxRetries, totalTests, () => ++completed);
      } else {
        // Sequential execution
        await this._runSequential(tests, context, browser, options, consoleErrors, maxRetries, totalTests, () => ++completed);
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

  async _runSequential(tests, context, browser, options, consoleErrors, maxRetries, totalTests, incrementCompleted) {
    const { url } = this.config;

    for (const testId of tests) {
      const testInfo = TEST_INFO[testId] || { label: testId, category: 'Unknown' };

      this.broadcast({
        type: 'test_start',
        testId,
        label: testInfo.label,
        category: testInfo.category
      });

      const page = await this._createFreshPage(context, url, options, consoleErrors);

      try {
        const testBugs = await this._runTestWithRetries(testId, page, context, browser, options, consoleErrors, maxRetries);
        this.bugs.push(...testBugs);

        for (const bug of testBugs) {
          if (options.screenshots && bug.severity !== 'info') {
            try {
              const screenshotPath = path.join(this.screenshotDir, `${bug.id}.png`);
              await page.screenshot({ path: screenshotPath, fullPage: false });
              bug.screenshot = `screenshots/${this.sessionId}/${bug.id}.png`;
              this.broadcast({ type: 'screenshot', bugId: bug.id, path: bug.screenshot });
            } catch (e) {
              // Screenshot failed, continue without it
            }
          }
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
      } finally {
        await page.close().catch(() => {});
      }

      const completed = incrementCompleted();
      this.broadcast({
        type: 'progress',
        percent: Math.round((completed / totalTests) * 100),
        completed,
        total: totalTests
      });
    }
  }

  async _runParallel(tests, context, browser, options, consoleErrors, maxRetries, totalTests, incrementCompleted) {
    const { url } = this.config;
    const concurrencyLimit = 3;

    // Process in batches of concurrencyLimit
    for (let i = 0; i < tests.length; i += concurrencyLimit) {
      const batch = tests.slice(i, i + concurrencyLimit);

      const results = await Promise.allSettled(
        batch.map(async (testId) => {
          const testInfo = TEST_INFO[testId] || { label: testId, category: 'Unknown' };

          this.broadcast({
            type: 'test_start',
            testId,
            label: testInfo.label,
            category: testInfo.category
          });

          const page = await this._createFreshPage(context, url, options, consoleErrors);

          try {
            const testBugs = await this._runTestWithRetries(testId, page, context, browser, options, consoleErrors, maxRetries);

            for (const bug of testBugs) {
              if (options.screenshots && bug.severity !== 'info') {
                try {
                  const screenshotPath = path.join(this.screenshotDir, `${bug.id}.png`);
                  await page.screenshot({ path: screenshotPath, fullPage: false });
                  bug.screenshot = `screenshots/${this.sessionId}/${bug.id}.png`;
                  this.broadcast({ type: 'screenshot', bugId: bug.id, path: bug.screenshot });
                } catch (e) {
                  // Screenshot failed, continue without it
                }
              }
              this.broadcast({ type: 'bug_found', bug });
            }

            this.broadcast({
              type: 'test_complete',
              testId,
              status: 'done',
              bugsFound: testBugs.length
            });

            return testBugs;
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

            return [];
          } finally {
            await page.close().catch(() => {});
          }
        })
      );

      // Collect bugs from settled results
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          this.bugs.push(...result.value);
        }
      }

      // Update progress for the batch
      for (let j = 0; j < batch.length; j++) {
        const completed = incrementCompleted();
        this.broadcast({
          type: 'progress',
          percent: Math.round((completed / totalTests) * 100),
          completed,
          total: totalTests
        });
      }
    }
  }

  /**
   * Create a fresh page from the context, navigate to url, and attach listeners.
   */
  async _createFreshPage(context, url, options, consoleErrors) {
    const page = await context.newPage();

    // Capture console errors
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
      await page.screenshot({ path: path.join(this.screenshotDir, 'initial.png'), fullPage: true }).catch(() => {});
    }

    return page;
  }

  /**
   * Run a test with retry support. Retries up to maxRetries times on failure.
   */
  async _runTestWithRetries(testId, page, context, browser, options, consoleErrors, maxRetries) {
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.broadcast({
            type: 'log',
            text: `Retrying test ${testId} (attempt ${attempt + 1}/${maxRetries + 1})`,
            color: '#FFA500'
          });
        }
        return await this.runTest(testId, page, context, browser, options, consoleErrors);
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          this.broadcast({
            type: 'retry',
            testId,
            attempt: attempt + 1,
            maxRetries,
            error: error.message
          });
        }
      }
    }

    throw lastError;
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

    // Calculate health score (0-100)
    let healthScore = 100;
    healthScore -= summary.critical * 15;
    healthScore -= summary.high * 10;
    healthScore -= summary.medium * 5;
    healthScore -= summary.low * 2;
    // info: -0 each (no deduction)

    // Deduct for poor vitals
    const vitals = this.vitals || {
      lcp: { value: 0, unit: 'ms', rating: 'unknown' },
      fid: { value: 0, unit: 'ms', rating: 'unknown' },
      cls: { value: 0, unit: '', rating: 'unknown' },
      ttfb: { value: 0, unit: 'ms', rating: 'unknown' },
      fcp: { value: 0, unit: 'ms', rating: 'unknown' },
    };

    for (const vital of Object.values(vitals)) {
      if (vital && vital.rating === 'poor') {
        healthScore -= 5;
      } else if (vital && vital.rating === 'needs-improvement') {
        healthScore -= 2;
      }
    }

    // Floor at 0
    healthScore = Math.max(0, healthScore);

    // Calculate grade
    let grade;
    if (healthScore >= 95) grade = 'A+';
    else if (healthScore >= 90) grade = 'A';
    else if (healthScore >= 85) grade = 'B+';
    else if (healthScore >= 80) grade = 'B';
    else if (healthScore >= 75) grade = 'C+';
    else if (healthScore >= 70) grade = 'C';
    else if (healthScore >= 60) grade = 'D';
    else grade = 'F';

    const report = {
      sessionId: this.sessionId,
      url: this.config.url,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      testsRun: this.config.tests.length,
      testsSelected: this.config.tests,
      options: this.config.options,
      summary,
      healthScore,
      grade,
      vitals,
      sourceAudit: this.sourceAudit,
      bugs: this.bugs,
    };

    // Persist report to disk
    this.saveReport(report);

    return report;
  }

  saveReport(report) {
    try {
      const reportsDir = path.join(__dirname, '../reports');
      fs.mkdirSync(reportsDir, { recursive: true });

      // Save individual report
      const reportPath = path.join(reportsDir, `${report.sessionId}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

      // Update history index
      const historyPath = path.join(reportsDir, 'history.json');
      let history = [];
      if (fs.existsSync(historyPath)) {
        try {
          history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        } catch (e) {
          history = [];
        }
      }

      // Add to history (keep last 100)
      history.unshift({
        sessionId: report.sessionId,
        url: report.url,
        timestamp: report.timestamp,
        duration_ms: report.duration_ms,
        testsRun: report.testsRun,
        summary: report.summary,
        healthScore: report.healthScore,
        grade: report.grade,
        totalBugs: report.bugs.length,
      });
      history = history.slice(0, 100);

      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

      this.broadcast({ type: 'log', text: `Report saved: ${report.sessionId}`, color: '#4ECDC4' });
    } catch (e) {
      console.error('Failed to save report:', e.message);
    }
  }
}

// Compare two reports
function compareReports(reportA, reportB) {
  // Build bug identity keys for comparison (using title + location as identity)
  function bugKey(bug) {
    return `${bug.title || ''}::${bug.location || ''}::${bug.severity || ''}`;
  }

  const bugsA = new Map();
  for (const bug of (reportA.bugs || [])) {
    bugsA.set(bugKey(bug), bug);
  }

  const bugsB = new Map();
  for (const bug of (reportB.bugs || [])) {
    bugsB.set(bugKey(bug), bug);
  }

  // Improved: bugs in A not in B (fixed)
  const improved = [];
  for (const [key, bug] of bugsA) {
    if (!bugsB.has(key)) {
      improved.push(bug);
    }
  }

  // Regressed: bugs in B not in A (new)
  const regressed = [];
  for (const [key, bug] of bugsB) {
    if (!bugsA.has(key)) {
      regressed.push(bug);
    }
  }

  // Persistent: bugs in both
  const persistent = [];
  for (const [key, bug] of bugsA) {
    if (bugsB.has(key)) {
      persistent.push(bug);
    }
  }

  // Score delta
  const scoreA = reportA.healthScore ?? null;
  const scoreB = reportB.healthScore ?? null;
  const scoreDelta = (scoreA !== null && scoreB !== null) ? scoreB - scoreA : null;

  // Vitals delta
  const vitalsDelta = {};
  const vitalsA = reportA.vitals || {};
  const vitalsB = reportB.vitals || {};
  const allVitalKeys = new Set([...Object.keys(vitalsA), ...Object.keys(vitalsB)]);

  for (const key of allVitalKeys) {
    const a = vitalsA[key] || {};
    const b = vitalsB[key] || {};
    vitalsDelta[key] = {
      valueA: a.value ?? null,
      valueB: b.value ?? null,
      valueDelta: (a.value != null && b.value != null) ? b.value - a.value : null,
      ratingA: a.rating || 'unknown',
      ratingB: b.rating || 'unknown',
    };
  }

  return {
    improved,
    regressed,
    persistent,
    scoreDelta,
    vitalsDelta,
  };
}

// Load historical report
function loadReport(sessionId) {
  const reportPath = path.join(__dirname, '../reports', `${sessionId}.json`);
  if (fs.existsSync(reportPath)) {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  }
  return null;
}

// Get report history
function getReportHistory() {
  const historyPath = path.join(__dirname, '../reports', 'history.json');
  if (fs.existsSync(historyPath)) {
    return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  }
  return [];
}

module.exports = { TestOrchestrator, loadReport, getReportHistory, compareReports };
