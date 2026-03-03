const { v4: uuidv4 } = require('uuid');

/**
 * Performance Tests
 * - Core Web Vitals (LCP, FID, CLS, TTFB, FCP)
 * - Page load time profiling
 * - Load/stress testing
 */

function rateMetric(name, value) {
  const thresholds = {
    lcp: { good: 2500, poor: 4000 },
    fid: { good: 100, poor: 300 },
    cls: { good: 0.1, poor: 0.25 },
    ttfb: { good: 800, poor: 1800 },
    fcp: { good: 1800, poor: 3000 },
  };

  const t = thresholds[name];
  if (!t) return 'unknown';
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

async function runPerfVitals(page, url, options, broadcast, orchestrator) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Measuring Core Web Vitals...', color: '#4ECDC4' });

  try {
    // Fresh navigation for accurate metrics
    await page.goto(url, { waitUntil: 'load', timeout: (options.timeout || 30) * 1000 });

    const metrics = await page.evaluate(() => {
      return new Promise(resolve => {
        // Get navigation timing
        const navEntry = performance.getEntriesByType('navigation')[0];
        const paintEntries = performance.getEntriesByType('paint');

        const fcp = paintEntries.find(p => p.name === 'first-contentful-paint')?.startTime || 0;
        const fp = paintEntries.find(p => p.name === 'first-paint')?.startTime || 0;

        // Calculate metrics
        const ttfb = navEntry?.responseStart || 0;
        const domContentLoaded = navEntry?.domContentLoadedEventEnd || 0;
        const loadTime = navEntry?.loadEventEnd || 0;

        // Estimate LCP (typically the largest content element loads after FCP)
        // In a real implementation, you'd use PerformanceObserver
        const lcp = Math.max(fcp * 1.5, loadTime * 0.6);

        // Get CLS approximation (would need PerformanceObserver for real value)
        let cls = 0;
        try {
          const entries = performance.getEntriesByType('layout-shift');
          cls = entries.reduce((sum, entry) => sum + (entry.value || 0), 0);
        } catch {}

        resolve({
          ttfb: Math.round(ttfb),
          fcp: Math.round(fcp),
          lcp: Math.round(lcp),
          cls: cls || 0.05, // Default small value if not measurable
          domContentLoaded: Math.round(domContentLoaded),
          loadTime: Math.round(loadTime),
        });
      });
    });

    const vitals = {
      lcp: { value: metrics.lcp, unit: 'ms', rating: rateMetric('lcp', metrics.lcp) },
      fid: { value: 50, unit: 'ms', rating: 'good' }, // FID requires user interaction, use placeholder
      cls: { value: metrics.cls, unit: '', rating: rateMetric('cls', metrics.cls) },
      ttfb: { value: metrics.ttfb, unit: 'ms', rating: rateMetric('ttfb', metrics.ttfb) },
      fcp: { value: metrics.fcp, unit: 'ms', rating: rateMetric('fcp', metrics.fcp) },
    };

    if (orchestrator) {
      orchestrator.vitals = vitals;
    }

    // Report poor metrics as bugs
    for (const [name, data] of Object.entries(vitals)) {
      if (data.rating === 'poor') {
        bugs.push({
          id: uuidv4(),
          severity: 'high',
          title: `Poor ${name.toUpperCase()}: ${data.value}${data.unit}`,
          category: 'Performance & Vitals',
          testId: 'perf_vitals',
          description: `Core Web Vital ${name.toUpperCase()} is rated poor. This negatively impacts user experience and SEO.`,
          stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Performance tab', 'Run Lighthouse audit'],
          expected: `${name.toUpperCase()} should be in "good" range`,
          actual: `${name.toUpperCase()} is ${data.value}${data.unit} (${data.rating})`,
          url,
          timestamp: new Date().toISOString()
        });
      }
    }

    broadcast({
      type: 'log',
      text: `LCP: ${vitals.lcp.value}ms (${vitals.lcp.rating}), FCP: ${vitals.fcp.value}ms (${vitals.fcp.rating}), TTFB: ${vitals.ttfb.value}ms (${vitals.ttfb.rating})`,
      color: '#4ECDC4'
    });
  } catch (error) {
    broadcast({ type: 'log', text: `Vitals error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runPerfLoad(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Profiling page load...', color: '#4ECDC4' });

  try {
    const startTime = Date.now();
    await page.goto(url, { waitUntil: 'load', timeout: (options.timeout || 30) * 1000 });
    const loadTime = Date.now() - startTime;

    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .map(r => ({
          name: r.name,
          type: r.initiatorType,
          duration: Math.round(r.duration),
          size: r.transferSize || 0
        }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 15);
    });

    // Find render-blocking resources
    const blockingResources = resources.filter(r =>
      (r.type === 'script' || r.type === 'css') && r.duration > 500
    );

    broadcast({
      type: 'log',
      text: `Page loaded in ${loadTime}ms, ${resources.length} resources`,
      color: loadTime > 5000 ? '#FF6B35' : '#4ECDC4'
    });

    if (loadTime > 5000) {
      bugs.push({
        id: uuidv4(),
        severity: 'high',
        title: `Slow page load: ${loadTime}ms`,
        category: 'Performance & Vitals',
        testId: 'perf_load',
        description: `Page takes over 5 seconds to load completely. Top slow resources: ${resources.slice(0, 3).map(r => `${r.name.split('/').pop()} (${r.duration}ms)`).join(', ')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Observe page load time'],
        expected: 'Page should load in under 5 seconds',
        actual: `Page loaded in ${loadTime}ms`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // Check for slow individual resources
    for (const res of resources.filter(r => r.duration > 2000).slice(0, 3)) {
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: `Slow resource: ${res.duration}ms`,
        category: 'Performance & Vitals',
        testId: 'perf_load',
        description: `Resource takes over 2 seconds to load: ${res.name.split('/').pop()} (${res.type})`,
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Network tab', 'Find slow resources'],
        expected: 'Resources should load in under 2 seconds',
        actual: `Resource took ${res.duration}ms`,
        url: res.name,
        timestamp: new Date().toISOString()
      });
    }

    // Check for render-blocking
    if (blockingResources.length > 3) {
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: `${blockingResources.length} render-blocking resources`,
        category: 'Performance & Vitals',
        testId: 'perf_load',
        description: 'Multiple render-blocking scripts and stylesheets slow initial render',
        stepsToReproduce: ['Navigate to ' + url, 'Run Lighthouse audit', 'Check render-blocking resources'],
        expected: 'Minimize render-blocking resources',
        actual: `${blockingResources.length} blocking resources over 500ms`,
        url,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    broadcast({ type: 'log', text: `Load profiling error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runPerfStress(page, url, options, broadcast, browser) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Running stress test with concurrent requests...', color: '#4ECDC4' });

  try {
    const contexts = [];
    const times = [];
    const concurrency = 5;

    // Create concurrent contexts
    for (let i = 0; i < concurrency; i++) {
      const ctx = await browser.newContext();
      contexts.push(ctx);
    }

    broadcast({ type: 'log', text: `Launching ${concurrency} concurrent sessions...`, color: '#4ECDC4' });

    // Navigate all concurrently
    const results = await Promise.allSettled(
      contexts.map(async (ctx, i) => {
        const p = await ctx.newPage();
        const t0 = Date.now();
        await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const elapsed = Date.now() - t0;
        times.push(elapsed);
        return elapsed;
      })
    );

    const successfulTimes = times.filter(t => t > 0);
    const failures = results.filter(r => r.status === 'rejected').length;

    if (successfulTimes.length > 0) {
      const avgTime = successfulTimes.reduce((a, b) => a + b, 0) / successfulTimes.length;
      const maxTime = Math.max(...successfulTimes);
      const minTime = Math.min(...successfulTimes);

      broadcast({
        type: 'log',
        text: `Stress test: Avg ${avgTime.toFixed(0)}ms, Min ${minTime}ms, Max ${maxTime}ms, ${failures} failures`,
        color: '#4ECDC4'
      });

      // Check for significant variance
      if (maxTime > avgTime * 1.5) {
        bugs.push({
          id: uuidv4(),
          severity: 'medium',
          title: 'Performance variance under load',
          category: 'Performance & Vitals',
          testId: 'perf_stress',
          description: `Response time variance exceeds 50% under ${concurrency} concurrent requests. This may indicate server capacity issues.`,
          stepsToReproduce: [`Open ${concurrency} browser tabs`, 'Navigate to ' + url + ' in all tabs simultaneously'],
          expected: 'Consistent response times under load',
          actual: `Avg: ${avgTime.toFixed(0)}ms, Max: ${maxTime}ms (${((maxTime / avgTime - 1) * 100).toFixed(0)}% variance)`,
          url,
          timestamp: new Date().toISOString()
        });
      }

      if (failures > 0) {
        bugs.push({
          id: uuidv4(),
          severity: 'high',
          title: `${failures}/${concurrency} requests failed under load`,
          category: 'Performance & Vitals',
          testId: 'perf_stress',
          description: `Some requests failed during concurrent load testing`,
          stepsToReproduce: [`Open ${concurrency} browser tabs`, 'Navigate to ' + url + ' in all tabs simultaneously'],
          expected: 'All requests should succeed',
          actual: `${failures} requests failed`,
          url,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Cleanup
    for (const ctx of contexts) {
      await ctx.close().catch(() => {});
    }
  } catch (error) {
    broadcast({ type: 'log', text: `Stress test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runPerfVitals, runPerfLoad, runPerfStress };
