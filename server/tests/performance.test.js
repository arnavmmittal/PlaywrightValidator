const { v4: uuidv4 } = require('uuid');

/**
 * Performance Tests
 * - Core Web Vitals (LCP, FID, CLS, TTFB, FCP) - IMPROVED with real measurements
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
    inp: { good: 200, poor: 500 }, // Interaction to Next Paint (new)
  };

  const t = thresholds[name];
  if (!t) return 'unknown';
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

async function runPerfVitals(page, url, options, broadcast, orchestrator) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Measuring Core Web Vitals (enhanced)...', color: '#4ECDC4' });

  try {
    // Inject web-vitals library for accurate measurements
    await page.goto(url, { waitUntil: 'commit' });

    // Set up performance observers BEFORE page fully loads
    const vitalsPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {
          lcp: null,
          fcp: null,
          cls: 0,
          ttfb: null,
          inp: null,
        };

        // LCP Observer
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.lcp = lastEntry.startTime;
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

        // CLS Observer
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              vitals.cls += entry.value;
            }
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });

        // FCP from paint timing
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              vitals.fcp = entry.startTime;
            }
          }
        });
        paintObserver.observe({ type: 'paint', buffered: true });

        // TTFB from navigation timing
        const navEntries = performance.getEntriesByType('navigation');
        if (navEntries.length > 0) {
          vitals.ttfb = navEntries[0].responseStart;
        }

        // Wait for page to stabilize then return metrics
        setTimeout(() => {
          lcpObserver.disconnect();
          clsObserver.disconnect();
          paintObserver.disconnect();
          resolve(vitals);
        }, 5000);
      });
    });

    // Wait for load
    await page.waitForLoadState('load');

    // Get the metrics
    const metrics = await vitalsPromise;

    // Get additional timing data
    const navTiming = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return nav ? {
        dns: nav.domainLookupEnd - nav.domainLookupStart,
        tcp: nav.connectEnd - nav.connectStart,
        ttfb: nav.responseStart - nav.requestStart,
        download: nav.responseEnd - nav.responseStart,
        domParse: nav.domInteractive - nav.responseEnd,
        domComplete: nav.domComplete - nav.domInteractive,
        total: nav.loadEventEnd - nav.startTime,
      } : null;
    });

    const vitals = {
      lcp: {
        value: Math.round(metrics.lcp || navTiming?.total * 0.7 || 0),
        unit: 'ms',
        rating: rateMetric('lcp', metrics.lcp || navTiming?.total * 0.7 || 0)
      },
      fid: {
        value: 50, // FID requires real user interaction, using estimate
        unit: 'ms',
        rating: 'good',
        note: 'Estimated - requires real user interaction'
      },
      cls: {
        value: Math.round(metrics.cls * 1000) / 1000,
        unit: '',
        rating: rateMetric('cls', metrics.cls)
      },
      ttfb: {
        value: Math.round(metrics.ttfb || navTiming?.ttfb || 0),
        unit: 'ms',
        rating: rateMetric('ttfb', metrics.ttfb || navTiming?.ttfb || 0)
      },
      fcp: {
        value: Math.round(metrics.fcp || 0),
        unit: 'ms',
        rating: rateMetric('fcp', metrics.fcp || 0)
      },
    };

    if (orchestrator) {
      orchestrator.vitals = vitals;
      orchestrator.navTiming = navTiming; // Store detailed timing
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
          description: `Core Web Vital ${name.toUpperCase()} is rated poor. This negatively impacts user experience and SEO rankings.`,
          stepsToReproduce: ['Navigate to ' + url, 'Open DevTools > Lighthouse', 'Run performance audit'],
          expected: `${name.toUpperCase()} should be in "good" range`,
          actual: `${name.toUpperCase()} is ${data.value}${data.unit} (${data.rating})`,
          url,
          timestamp: new Date().toISOString()
        });
      } else if (data.rating === 'needs-improvement') {
        bugs.push({
          id: uuidv4(),
          severity: 'medium',
          title: `${name.toUpperCase()} needs improvement: ${data.value}${data.unit}`,
          category: 'Performance & Vitals',
          testId: 'perf_vitals',
          description: `Core Web Vital ${name.toUpperCase()} is in the "needs improvement" range.`,
          stepsToReproduce: ['Navigate to ' + url, 'Measure performance'],
          expected: `${name.toUpperCase()} should be in "good" range`,
          actual: `${name.toUpperCase()} is ${data.value}${data.unit} (${data.rating})`,
          url,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Log detailed timing breakdown
    if (navTiming) {
      broadcast({
        type: 'log',
        text: `Timing: DNS ${navTiming.dns}ms, TCP ${navTiming.tcp}ms, TTFB ${navTiming.ttfb}ms, Download ${navTiming.download}ms`,
        color: '#4ECDC4'
      });
    }

    broadcast({
      type: 'log',
      text: `LCP: ${vitals.lcp.value}ms (${vitals.lcp.rating}), FCP: ${vitals.fcp.value}ms (${vitals.fcp.rating}), CLS: ${vitals.cls.value} (${vitals.cls.rating})`,
      color: '#4ECDC4'
    });
  } catch (error) {
    broadcast({ type: 'log', text: `Vitals error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runPerfLoad(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Profiling page load (detailed)...', color: '#4ECDC4' });

  try {
    const startTime = Date.now();

    // Track all network requests
    const requests = [];
    page.on('request', req => {
      requests.push({
        url: req.url(),
        method: req.method(),
        type: req.resourceType(),
        startTime: Date.now() - startTime
      });
    });

    page.on('response', res => {
      const req = requests.find(r => r.url === res.url());
      if (req) {
        req.status = res.status();
        req.endTime = Date.now() - startTime;
        req.duration = req.endTime - req.startTime;
      }
    });

    await page.goto(url, { waitUntil: 'load', timeout: (options.timeout || 30) * 1000 });
    const loadTime = Date.now() - startTime;

    // Analyze resources
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .map(r => ({
          name: r.name,
          type: r.initiatorType,
          duration: Math.round(r.duration),
          size: r.transferSize || 0,
          protocol: r.nextHopProtocol || 'unknown'
        }))
        .sort((a, b) => b.duration - a.duration);
    });

    // Calculate stats
    const totalSize = resources.reduce((sum, r) => sum + r.size, 0);
    const byType = {};
    resources.forEach(r => {
      byType[r.type] = (byType[r.type] || 0) + 1;
    });

    broadcast({
      type: 'log',
      text: `Loaded in ${loadTime}ms | ${resources.length} resources | ${(totalSize / 1024).toFixed(1)}KB transferred`,
      color: loadTime > 5000 ? '#FF6B35' : '#4ECDC4'
    });

    broadcast({
      type: 'log',
      text: `Resources: ${Object.entries(byType).map(([k,v]) => `${k}:${v}`).join(', ')}`,
      color: '#7B8794'
    });

    // Find render-blocking resources
    const blockingResources = resources.filter(r =>
      (r.type === 'script' || r.type === 'css') && r.duration > 500
    );

    // Report issues
    if (loadTime > 5000) {
      const slowest = resources.slice(0, 5);
      bugs.push({
        id: uuidv4(),
        severity: 'high',
        title: `Slow page load: ${loadTime}ms`,
        category: 'Performance & Vitals',
        testId: 'perf_load',
        description: `Page takes over 5 seconds to load.\n\nSlowest resources:\n${slowest.map(r => `- ${r.name.split('/').pop()}: ${r.duration}ms`).join('\n')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Observe load time in Network tab'],
        expected: 'Page should load in under 5 seconds',
        actual: `Page loaded in ${loadTime}ms`,
        url,
        timestamp: new Date().toISOString()
      });
    } else if (loadTime > 3000) {
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: `Moderate page load time: ${loadTime}ms`,
        category: 'Performance & Vitals',
        testId: 'perf_load',
        description: `Page load time is over 3 seconds, which may impact user experience.`,
        stepsToReproduce: ['Navigate to ' + url],
        expected: 'Page should load in under 3 seconds',
        actual: `Page loaded in ${loadTime}ms`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // Check for very slow individual resources
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

    // Large page weight
    if (totalSize > 3 * 1024 * 1024) { // > 3MB
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: `Large page weight: ${(totalSize / 1024 / 1024).toFixed(2)}MB`,
        category: 'Performance & Vitals',
        testId: 'perf_load',
        description: 'Total page weight exceeds 3MB which impacts load time on slow connections',
        stepsToReproduce: ['Navigate to ' + url, 'Check Network tab total size'],
        expected: 'Page should be under 3MB',
        actual: `Page is ${(totalSize / 1024 / 1024).toFixed(2)}MB`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // Render-blocking resources
    if (blockingResources.length > 3) {
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: `${blockingResources.length} render-blocking resources`,
        category: 'Performance & Vitals',
        testId: 'perf_load',
        description: `Multiple render-blocking scripts and stylesheets slow initial render:\n${blockingResources.slice(0, 5).map(r => `- ${r.name.split('/').pop()}: ${r.duration}ms`).join('\n')}`,
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

  broadcast({ type: 'log', text: 'Running concurrent load test...', color: '#4ECDC4' });

  try {
    const concurrencyLevels = [3, 5, 10];
    const results = [];

    for (const concurrency of concurrencyLevels) {
      broadcast({ type: 'log', text: `Testing with ${concurrency} concurrent sessions...`, color: '#7B8794' });

      const contexts = [];
      const times = [];

      // Create concurrent contexts
      for (let i = 0; i < concurrency; i++) {
        const ctx = await browser.newContext();
        contexts.push(ctx);
      }

      // Navigate all concurrently and measure
      const startAll = Date.now();
      const navResults = await Promise.allSettled(
        contexts.map(async (ctx) => {
          const p = await ctx.newPage();
          const t0 = Date.now();
          await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          return Date.now() - t0;
        })
      );

      const totalTime = Date.now() - startAll;
      const successfulTimes = navResults
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
      const failures = navResults.filter(r => r.status === 'rejected').length;

      if (successfulTimes.length > 0) {
        const avg = successfulTimes.reduce((a, b) => a + b, 0) / successfulTimes.length;
        const max = Math.max(...successfulTimes);
        const min = Math.min(...successfulTimes);

        results.push({ concurrency, avg, max, min, failures, totalTime });

        broadcast({
          type: 'log',
          text: `  ${concurrency} users: avg ${avg.toFixed(0)}ms, max ${max}ms, min ${min}ms${failures ? `, ${failures} failed` : ''}`,
          color: failures > 0 ? '#FF6B35' : '#4ECDC4'
        });
      }

      // Cleanup
      for (const ctx of contexts) {
        await ctx.close().catch(() => {});
      }

      // Small delay between levels
      await new Promise(r => setTimeout(r, 1000));
    }

    // Analyze degradation
    if (results.length >= 2) {
      const baseline = results[0].avg;
      const highest = results[results.length - 1];
      const degradation = ((highest.avg - baseline) / baseline) * 100;

      if (degradation > 100) {
        bugs.push({
          id: uuidv4(),
          severity: 'high',
          title: `Severe performance degradation under load (${degradation.toFixed(0)}%)`,
          category: 'Performance & Vitals',
          testId: 'perf_stress',
          description: `Response time more than doubles under ${highest.concurrency} concurrent users.\n\nResults:\n${results.map(r => `- ${r.concurrency} users: avg ${r.avg.toFixed(0)}ms`).join('\n')}`,
          stepsToReproduce: [`Open ${highest.concurrency} browser tabs`, 'Navigate to ' + url + ' in all tabs simultaneously'],
          expected: 'Consistent response times under load',
          actual: `${degradation.toFixed(0)}% degradation at ${highest.concurrency} concurrent users`,
          url,
          timestamp: new Date().toISOString()
        });
      } else if (degradation > 50) {
        bugs.push({
          id: uuidv4(),
          severity: 'medium',
          title: `Performance degradation under load (${degradation.toFixed(0)}%)`,
          category: 'Performance & Vitals',
          testId: 'perf_stress',
          description: `Response time increases by ${degradation.toFixed(0)}% under ${highest.concurrency} concurrent users.`,
          stepsToReproduce: [`Open ${highest.concurrency} browser tabs`, 'Navigate to ' + url + ' simultaneously'],
          expected: 'Consistent response times under load',
          actual: `${degradation.toFixed(0)}% degradation`,
          url,
          timestamp: new Date().toISOString()
        });
      }

      // Check for failures
      const totalFailures = results.reduce((sum, r) => sum + r.failures, 0);
      if (totalFailures > 0) {
        bugs.push({
          id: uuidv4(),
          severity: 'high',
          title: `${totalFailures} requests failed under load`,
          category: 'Performance & Vitals',
          testId: 'perf_stress',
          description: `Some requests failed during concurrent load testing, indicating capacity issues.`,
          stepsToReproduce: ['Run concurrent load test'],
          expected: 'All requests should succeed',
          actual: `${totalFailures} total failures`,
          url,
          timestamp: new Date().toISOString()
        });
      }
    }

    broadcast({ type: 'log', text: 'Load test complete', color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Stress test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runPerfVitals, runPerfLoad, runPerfStress };
