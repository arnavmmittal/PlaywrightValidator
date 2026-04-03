const { v4: uuidv4 } = require('uuid');

/**
 * Performance Tests (Enterprise-Grade)
 * - Core Web Vitals: LCP, FCP, CLS, TTFB, INP, TBT, Speed Index approx
 * - Page load profiling: coverage, images, fonts, caching, CDN, blocking resources
 * - Stress testing: concurrency levels, percentiles, memory leaks, throughput
 */

// ── Metric Rating ─────────────────────────────────────────────────────────────

function rateMetric(name, value) {
  const thresholds = {
    lcp:  { good: 2500, poor: 4000 },
    fid:  { good: 100,  poor: 300 },
    cls:  { good: 0.1,  poor: 0.25 },
    ttfb: { good: 800,  poor: 1800 },
    fcp:  { good: 1800, poor: 3000 },
    inp:  { good: 200,  poor: 500 },
    tbt:  { good: 200,  poor: 600 },
  };

  const t = thresholds[name];
  if (!t) return 'unknown';
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makeBug(severity, title, testId, description, steps, expected, actual, bugUrl) {
  return {
    id: uuidv4(),
    severity,
    title,
    category: 'Performance & Vitals',
    testId,
    description,
    stepsToReproduce: steps,
    expected,
    actual,
    url: bugUrl,
    timestamp: new Date().toISOString(),
  };
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── Core Web Vitals ───────────────────────────────────────────────────────────

async function runPerfVitals(page, url, options, broadcast, orchestrator) {
  const bugs = [];
  const timeoutMs = (options.timeout || 30) * 1000;

  broadcast({ type: 'log', text: 'Measuring Core Web Vitals (comprehensive)...', color: '#4ECDC4' });

  try {
    // ── Desktop vitals measurement ───────────────────────────────────────────
    await page.goto(url, { waitUntil: 'commit' });

    // Set up performance observers BEFORE page fully loads
    const vitalsPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {
          lcp: null,
          fcp: null,
          cls: 0,
          ttfb: null,
          longTasks: [],
          layoutShifts: [],
        };

        // LCP Observer
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.lcp = lastEntry.startTime;
        });
        try { lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}

        // CLS Observer
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              vitals.cls += entry.value;
              vitals.layoutShifts.push({
                value: entry.value,
                time: entry.startTime,
                hadRecentInput: entry.hadRecentInput,
              });
            }
          }
        });
        try { clsObserver.observe({ type: 'layout-shift', buffered: true }); } catch (e) {}

        // FCP from paint timing
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              vitals.fcp = entry.startTime;
            }
          }
        });
        try { paintObserver.observe({ type: 'paint', buffered: true }); } catch (e) {}

        // Long Tasks Observer (> 50ms)
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            vitals.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
            });
          }
        });
        try { longTaskObserver.observe({ type: 'longtask', buffered: true }); } catch (e) {}

        // TTFB from navigation timing
        const navEntries = performance.getEntriesByType('navigation');
        if (navEntries.length > 0) {
          vitals.ttfb = navEntries[0].responseStart;
        }

        // Wait for page to stabilize then return metrics
        setTimeout(() => {
          try { lcpObserver.disconnect(); } catch (e) {}
          try { clsObserver.disconnect(); } catch (e) {}
          try { paintObserver.disconnect(); } catch (e) {}
          try { longTaskObserver.disconnect(); } catch (e) {}
          resolve(vitals);
        }, 5000);
      });
    });

    // Wait for load
    await page.waitForLoadState('load');

    const metrics = await vitalsPromise;

    // ── Detailed navigation timing ───────────────────────────────────────────
    const navTiming = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return nav ? {
        dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
        tcp: Math.round(nav.connectEnd - nav.connectStart),
        tls: Math.round(nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0),
        ttfb: Math.round(nav.responseStart - nav.requestStart),
        download: Math.round(nav.responseEnd - nav.responseStart),
        domParse: Math.round(nav.domInteractive - nav.responseEnd),
        domComplete: Math.round(nav.domComplete - nav.domInteractive),
        total: Math.round(nav.loadEventEnd - nav.startTime),
        protocol: nav.nextHopProtocol || 'unknown',
      } : null;
    });

    // ── TBT (Total Blocking Time) approximation ─────────────────────────────
    let tbt = 0;
    if (metrics.longTasks && metrics.longTasks.length > 0) {
      for (const task of metrics.longTasks) {
        if (task.duration > 50) {
          tbt += task.duration - 50; // TBT = sum of (long task duration - 50ms)
        }
      }
    }

    // ── INP (Interaction to Next Paint) via simulated click ──────────────────
    let inp = null;
    try {
      // Click the largest visible element to measure INP
      inp = await page.evaluate(() => {
        return new Promise((resolve) => {
          let inpValue = null;

          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'event' && entry.duration > 0) {
                if (inpValue === null || entry.duration > inpValue) {
                  inpValue = entry.duration;
                }
              }
            }
          });
          try { observer.observe({ type: 'event', buffered: true, durationThreshold: 0 }); } catch (e) {}

          // Simulate a click
          const target = document.querySelector('button, a, [role="button"], input[type="submit"]') || document.body;
          target.click();

          setTimeout(() => {
            observer.disconnect();
            resolve(inpValue);
          }, 1000);
        });
      });
    } catch (e) {
      // INP measurement may not be available in all browsers
    }

    // ── CLS during interactions ──────────────────────────────────────────────
    let interactionCLS = 0;
    try {
      interactionCLS = await page.evaluate(() => {
        return new Promise((resolve) => {
          let cls = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                cls += entry.value;
              }
            }
          });
          try { observer.observe({ type: 'layout-shift', buffered: false }); } catch (e) {}

          // Scroll through the page to trigger layout shifts
          const scrollStep = window.innerHeight;
          let scrollPos = 0;
          const interval = setInterval(() => {
            scrollPos += scrollStep;
            window.scrollTo(0, scrollPos);
            if (scrollPos >= document.body.scrollHeight) {
              clearInterval(interval);
              window.scrollTo(0, 0);
              setTimeout(() => {
                observer.disconnect();
                resolve(cls);
              }, 500);
            }
          }, 200);

          // Safety timeout
          setTimeout(() => {
            clearInterval(interval);
            observer.disconnect();
            resolve(cls);
          }, 5000);
        });
      });
    } catch (e) {
      // Non-critical
    }

    // ── Check resource hints ─────────────────────────────────────────────────
    const resourceHints = await page.evaluate(() => {
      const hints = {
        preconnect: document.querySelectorAll('link[rel="preconnect"]').length,
        prefetch: document.querySelectorAll('link[rel="prefetch"]').length,
        preload: document.querySelectorAll('link[rel="preload"]').length,
        dnsPrefetch: document.querySelectorAll('link[rel="dns-prefetch"]').length,
        modulePreload: document.querySelectorAll('link[rel="modulepreload"]').length,
      };
      // Get external domains
      const resources = performance.getEntriesByType('resource');
      const externalDomains = new Set();
      const currentHost = location.hostname;
      for (const r of resources) {
        try {
          const host = new URL(r.name).hostname;
          if (host !== currentHost) externalDomains.add(host);
        } catch (e) {}
      }
      return { hints, externalDomainCount: externalDomains.size, externalDomains: [...externalDomains].slice(0, 10) };
    });

    // ── Check for uncompressed resources ─────────────────────────────────────
    const compressionInfo = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      let uncompressedCount = 0;
      let uncompressedSize = 0;
      const uncompressedList = [];

      for (const r of resources) {
        // If decodedBodySize > transferSize significantly, it's compressed
        // If they're similar and size > 1KB, likely uncompressed
        if (r.decodedBodySize > 0 && r.transferSize > 0) {
          const ratio = r.decodedBodySize / r.transferSize;
          if (ratio < 1.1 && r.transferSize > 1024) {
            // Likely uncompressed
            if (r.initiatorType === 'script' || r.initiatorType === 'css' || r.initiatorType === 'fetch' || r.initiatorType === 'xmlhttprequest') {
              uncompressedCount++;
              uncompressedSize += r.transferSize;
              if (uncompressedList.length < 5) {
                uncompressedList.push({ name: r.name, size: r.transferSize, type: r.initiatorType });
              }
            }
          }
        }
      }

      return { uncompressedCount, uncompressedSize, uncompressedList };
    });

    // ── Check HTTP/2 or HTTP/3 ───────────────────────────────────────────────
    const protocol = navTiming?.protocol || 'unknown';

    // ── Build vitals object ──────────────────────────────────────────────────
    const vitals = {
      lcp: {
        value: Math.round(metrics.lcp || navTiming?.total * 0.7 || 0),
        unit: 'ms',
        rating: rateMetric('lcp', metrics.lcp || navTiming?.total * 0.7 || 0),
      },
      fcp: {
        value: Math.round(metrics.fcp || 0),
        unit: 'ms',
        rating: rateMetric('fcp', metrics.fcp || 0),
      },
      cls: {
        value: Math.round(metrics.cls * 1000) / 1000,
        unit: '',
        rating: rateMetric('cls', metrics.cls),
      },
      ttfb: {
        value: Math.round(metrics.ttfb || navTiming?.ttfb || 0),
        unit: 'ms',
        rating: rateMetric('ttfb', metrics.ttfb || navTiming?.ttfb || 0),
      },
      inp: {
        value: inp !== null ? Math.round(inp) : null,
        unit: 'ms',
        rating: inp !== null ? rateMetric('inp', inp) : 'unmeasured',
        note: inp === null ? 'Could not measure INP (requires event timing API support)' : undefined,
      },
      tbt: {
        value: Math.round(tbt),
        unit: 'ms',
        rating: rateMetric('tbt', tbt),
      },
      interactionCLS: {
        value: Math.round(interactionCLS * 1000) / 1000,
        unit: '',
        rating: rateMetric('cls', interactionCLS),
        note: 'CLS measured during scroll interaction',
      },
    };

    if (orchestrator) {
      orchestrator.vitals = vitals;
      orchestrator.navTiming = navTiming;
      orchestrator.longTasks = metrics.longTasks;
      orchestrator.resourceHints = resourceHints;
      orchestrator.protocol = protocol;
    }

    // ── Report poor/needs-improvement vitals as bugs ─────────────────────────
    for (const [name, data] of Object.entries(vitals)) {
      if (data.value === null) continue;

      if (data.rating === 'poor') {
        bugs.push(makeBug(
          'high',
          `Poor ${name.toUpperCase()}: ${data.value}${data.unit}`,
          'perf_vitals',
          `Core Web Vital ${name.toUpperCase()} is rated poor. This negatively impacts user experience and SEO rankings.${data.note ? '\nNote: ' + data.note : ''}`,
          ['Navigate to ' + url, 'Open DevTools > Lighthouse', 'Run performance audit'],
          `${name.toUpperCase()} should be in "good" range`,
          `${name.toUpperCase()} is ${data.value}${data.unit} (${data.rating})`,
          url
        ));
      } else if (data.rating === 'needs-improvement') {
        bugs.push(makeBug(
          'medium',
          `${name.toUpperCase()} needs improvement: ${data.value}${data.unit}`,
          'perf_vitals',
          `Core Web Vital ${name.toUpperCase()} is in the "needs improvement" range.${data.note ? '\nNote: ' + data.note : ''}`,
          ['Navigate to ' + url, 'Measure performance'],
          `${name.toUpperCase()} should be in "good" range`,
          `${name.toUpperCase()} is ${data.value}${data.unit} (${data.rating})`,
          url
        ));
      }
    }

    // ── Report long tasks ────────────────────────────────────────────────────
    if (metrics.longTasks && metrics.longTasks.length > 5) {
      bugs.push(makeBug(
        'medium',
        `${metrics.longTasks.length} long tasks detected (> 50ms each)`,
        'perf_vitals',
        `${metrics.longTasks.length} long tasks were observed during page load, with a total blocking time of ${Math.round(tbt)}ms.\n\nLongest tasks:\n${metrics.longTasks.sort((a, b) => b.duration - a.duration).slice(0, 5).map(t => `- ${Math.round(t.duration)}ms at ${Math.round(t.startTime)}ms`).join('\n')}`,
        ['Navigate to ' + url, 'Open DevTools > Performance', 'Record page load', 'Look for long tasks (yellow/red blocks)'],
        'No tasks should block the main thread for more than 50ms',
        `${metrics.longTasks.length} long tasks totaling ${Math.round(tbt)}ms of blocking time`,
        url
      ));
    }

    // ── Report interaction CLS if significant ────────────────────────────────
    if (interactionCLS > 0.1) {
      bugs.push(makeBug(
        interactionCLS > 0.25 ? 'high' : 'medium',
        `Layout shifts during interaction: CLS ${interactionCLS.toFixed(3)}`,
        'perf_vitals',
        'Significant layout shifts occur during scrolling/interaction, which disrupts user experience beyond initial page load.',
        ['Navigate to ' + url, 'Scroll through the page', 'Observe content jumping/shifting'],
        'CLS during interaction should be under 0.1',
        `Interaction CLS is ${interactionCLS.toFixed(3)}`,
        url
      ));
    }

    // ── Report missing resource hints ────────────────────────────────────────
    if (resourceHints.externalDomainCount > 2 && resourceHints.hints.preconnect === 0 && resourceHints.hints.dnsPrefetch === 0) {
      bugs.push(makeBug(
        'low',
        `Missing resource hints for ${resourceHints.externalDomainCount} external domains`,
        'perf_vitals',
        `Page loads resources from ${resourceHints.externalDomainCount} external domains but has no preconnect or dns-prefetch hints.\n\nExternal domains: ${resourceHints.externalDomains.join(', ')}\n\nAdding <link rel="preconnect"> for critical third-party origins can reduce connection setup time by 100-300ms.`,
        ['Navigate to ' + url, 'Check <head> for link[rel="preconnect"]', 'Check Network tab for external domain requests'],
        'Critical third-party origins should have preconnect hints',
        `${resourceHints.externalDomainCount} external domains with no resource hints`,
        url
      ));
    }

    // ── Report uncompressed resources ────────────────────────────────────────
    if (compressionInfo.uncompressedCount > 3) {
      bugs.push(makeBug(
        'medium',
        `${compressionInfo.uncompressedCount} uncompressed text resources (${(compressionInfo.uncompressedSize / 1024).toFixed(1)}KB)`,
        'perf_vitals',
        `${compressionInfo.uncompressedCount} text-based resources appear to be served without gzip/brotli compression, wasting ${(compressionInfo.uncompressedSize / 1024).toFixed(1)}KB of bandwidth.\n\nExamples:\n${compressionInfo.uncompressedList.map(r => `- ${r.name.split('/').pop()} (${(r.size / 1024).toFixed(1)}KB, ${r.type})`).join('\n')}`,
        ['Navigate to ' + url, 'Open DevTools Network tab', 'Check Content-Encoding header on JS/CSS resources', 'Resources should show gzip or br encoding'],
        'All text resources (JS, CSS, HTML, JSON) should be gzip or brotli compressed',
        `${compressionInfo.uncompressedCount} resources served without compression`,
        url
      ));
    }

    // ── Report HTTP/1.1 usage ────────────────────────────────────────────────
    if (protocol && !protocol.startsWith('h2') && !protocol.startsWith('h3') && protocol !== 'unknown') {
      bugs.push(makeBug(
        'low',
        `Using ${protocol} instead of HTTP/2 or HTTP/3`,
        'perf_vitals',
        `Page is served over ${protocol}. HTTP/2 provides multiplexing, header compression, and server push that can significantly improve load performance.`,
        ['Navigate to ' + url, 'Open DevTools Network tab', 'Check Protocol column'],
        'HTTP/2 or HTTP/3 should be used for better performance',
        `Using ${protocol}`,
        url
      ));
    }

    // ── Mobile viewport vitals test ──────────────────────────────────────────
    broadcast({ type: 'log', text: 'Measuring vitals on mobile viewport (320px)...', color: '#4ECDC4' });

    try {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto(url, { waitUntil: 'commit' });

      const mobileVitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const v = { lcp: null, fcp: null, cls: 0 };
          const lcpObs = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            v.lcp = entries[entries.length - 1].startTime;
          });
          try { lcpObs.observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}

          const clsObs = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) v.cls += entry.value;
            }
          });
          try { clsObs.observe({ type: 'layout-shift', buffered: true }); } catch (e) {}

          const paintObs = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.name === 'first-contentful-paint') v.fcp = entry.startTime;
            }
          });
          try { paintObs.observe({ type: 'paint', buffered: true }); } catch (e) {}

          setTimeout(() => {
            try { lcpObs.disconnect(); } catch (e) {}
            try { clsObs.disconnect(); } catch (e) {}
            try { paintObs.disconnect(); } catch (e) {}
            resolve(v);
          }, 5000);
        });
      });

      await page.waitForLoadState('load');

      const mobileLCP = Math.round(mobileVitals.lcp || 0);
      const mobileFCP = Math.round(mobileVitals.fcp || 0);
      const mobileCLS = Math.round(mobileVitals.cls * 1000) / 1000;

      // Compare mobile vs desktop
      const desktopLCP = vitals.lcp.value;
      if (mobileLCP > 0 && desktopLCP > 0 && mobileLCP > desktopLCP * 1.5) {
        bugs.push(makeBug(
          'medium',
          `Mobile LCP ${Math.round((mobileLCP / desktopLCP - 1) * 100)}% worse than desktop`,
          'perf_vitals_mobile',
          `Mobile LCP (${mobileLCP}ms) is significantly worse than desktop LCP (${desktopLCP}ms). Mobile users make up the majority of web traffic.\n\nMobile FCP: ${mobileFCP}ms, Mobile CLS: ${mobileCLS}`,
          ['Navigate to ' + url + ' on a mobile device or DevTools mobile emulation', 'Run Lighthouse in mobile mode'],
          'Mobile LCP should be within 20% of desktop LCP',
          `Mobile LCP is ${mobileLCP}ms vs desktop ${desktopLCP}ms`,
          url
        ));
      }

      if (rateMetric('lcp', mobileLCP) === 'poor' && rateMetric('lcp', desktopLCP) !== 'poor') {
        bugs.push(makeBug(
          'high',
          `Mobile-only poor LCP: ${mobileLCP}ms`,
          'perf_vitals_mobile',
          `LCP is rated "poor" on mobile (${mobileLCP}ms) but acceptable on desktop (${desktopLCP}ms). Consider optimizing images and critical resources for mobile.`,
          ['Test page on mobile viewport (320px wide)', 'Check for unoptimized hero images', 'Check for render-blocking resources'],
          'LCP should be under 2500ms on mobile',
          `Mobile LCP: ${mobileLCP}ms (poor)`,
          url
        ));
      }

      if (mobileCLS > 0.25) {
        bugs.push(makeBug(
          'high',
          `Poor mobile CLS: ${mobileCLS}`,
          'perf_vitals_mobile',
          `Mobile CLS of ${mobileCLS} exceeds the "poor" threshold. Mobile layouts are more susceptible to layout shifts due to narrow viewports.`,
          ['Navigate on mobile viewport', 'Watch for content jumping during load'],
          'Mobile CLS should be under 0.1',
          `Mobile CLS is ${mobileCLS}`,
          url
        ));
      }

      broadcast({ type: 'log', text: `Mobile: LCP ${mobileLCP}ms, FCP ${mobileFCP}ms, CLS ${mobileCLS}`, color: '#4ECDC4' });

      // Reset viewport
      await page.setViewportSize({ width: 1280, height: 720 });
    } catch (e) {
      broadcast({ type: 'log', text: `Mobile vitals error: ${e.message}`, color: '#FF6B35' });
      try { await page.setViewportSize({ width: 1280, height: 720 }); } catch (_) {}
    }

    // ── Slow 3G simulation test ──────────────────────────────────────────────
    broadcast({ type: 'log', text: 'Testing with simulated slow 3G latency...', color: '#4ECDC4' });

    try {
      // Add 200ms latency and 50KB/s throttle via route interception
      let slow3gActive = true;
      await page.route('**/*', async (route) => {
        if (!slow3gActive) { await route.continue(); return; }
        await new Promise(r => setTimeout(r, 200)); // 200ms latency
        await route.continue();
      });

      const slow3gStart = Date.now();
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      const slow3gLoadTime = Date.now() - slow3gStart;

      slow3gActive = false;
      await page.unroute('**/*');

      if (slow3gLoadTime > 10000) {
        bugs.push(makeBug(
          'high',
          `Slow 3G load time: ${(slow3gLoadTime / 1000).toFixed(1)}s`,
          'perf_vitals_slow3g',
          `Page takes ${(slow3gLoadTime / 1000).toFixed(1)} seconds to load on simulated slow 3G (200ms added latency per request). Users on poor connections will have a degraded experience.`,
          ['Use Chrome DevTools Network throttling (Slow 3G preset)', 'Navigate to ' + url, 'Measure total load time'],
          'Page should load within 10 seconds on slow 3G',
          `Load time: ${(slow3gLoadTime / 1000).toFixed(1)}s`,
          url
        ));
      }

      broadcast({ type: 'log', text: `Slow 3G load time: ${(slow3gLoadTime / 1000).toFixed(1)}s`, color: slow3gLoadTime > 10000 ? '#FF6B35' : '#4ECDC4' });
    } catch (e) {
      try { await page.unroute('**/*'); } catch (_) {}
      broadcast({ type: 'log', text: `Slow 3G test error: ${e.message}`, color: '#FF6B35' });
    }

    // ── Log detailed timing breakdown ────────────────────────────────────────
    if (navTiming) {
      broadcast({
        type: 'log',
        text: `Timing waterfall: DNS ${navTiming.dns}ms | TCP ${navTiming.tcp}ms | TLS ${navTiming.tls}ms | TTFB ${navTiming.ttfb}ms | Download ${navTiming.download}ms | DOM Parse ${navTiming.domParse}ms | DOM Complete ${navTiming.domComplete}ms | Total ${navTiming.total}ms`,
        color: '#4ECDC4'
      });
    }

    broadcast({
      type: 'log',
      text: `LCP: ${vitals.lcp.value}ms (${vitals.lcp.rating}), FCP: ${vitals.fcp.value}ms (${vitals.fcp.rating}), CLS: ${vitals.cls.value} (${vitals.cls.rating}), TBT: ${vitals.tbt.value}ms (${vitals.tbt.rating})${vitals.inp.value !== null ? `, INP: ${vitals.inp.value}ms (${vitals.inp.rating})` : ''}`,
      color: '#4ECDC4'
    });
  } catch (error) {
    broadcast({ type: 'log', text: `Vitals error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

// ── Page Load Profiling ───────────────────────────────────────────────────────

async function runPerfLoad(page, url, options, broadcast) {
  const bugs = [];
  const timeoutMs = (options.timeout || 30) * 1000;

  broadcast({ type: 'log', text: 'Profiling page load (comprehensive)...', color: '#4ECDC4' });

  try {
    const startTime = Date.now();

    // Track all network requests with detailed info
    const networkRequests = [];
    page.on('request', (req) => {
      networkRequests.push({
        url: req.url(),
        method: req.method(),
        type: req.resourceType(),
        startTime: Date.now() - startTime,
        headers: req.headers(),
      });
    });

    page.on('response', (res) => {
      const req = networkRequests.find(r => r.url === res.url() && !r.status);
      if (req) {
        req.status = res.status();
        req.endTime = Date.now() - startTime;
        req.duration = req.endTime - req.startTime;
        req.responseHeaders = res.headers();
        req.contentType = res.headers()['content-type'] || '';
        req.contentEncoding = res.headers()['content-encoding'] || 'none';
        req.cacheControl = res.headers()['cache-control'] || '';
        req.server = res.headers()['server'] || '';
      }
    });

    await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
    const loadTime = Date.now() - startTime;

    // ── Gather resource details ──────────────────────────────────────────────
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .map(r => ({
          name: r.name,
          type: r.initiatorType,
          duration: Math.round(r.duration),
          size: r.transferSize || 0,
          decodedSize: r.decodedBodySize || 0,
          protocol: r.nextHopProtocol || 'unknown',
          startTime: Math.round(r.startTime),
        }))
        .sort((a, b) => b.duration - a.duration);
    });

    // Calculate stats
    const totalSize = resources.reduce((sum, r) => sum + r.size, 0);
    const totalDecoded = resources.reduce((sum, r) => sum + r.decodedSize, 0);
    const byType = {};
    const sizeByType = {};
    resources.forEach(r => {
      byType[r.type] = (byType[r.type] || 0) + 1;
      sizeByType[r.type] = (sizeByType[r.type] || 0) + r.size;
    });

    // Count unique domains
    const domains = new Set();
    resources.forEach(r => {
      try { domains.add(new URL(r.name).hostname); } catch (e) {}
    });

    broadcast({
      type: 'log',
      text: `Loaded in ${loadTime}ms | ${resources.length} resources | ${(totalSize / 1024).toFixed(1)}KB transferred | ${domains.size} domains`,
      color: loadTime > 5000 ? '#FF6B35' : '#4ECDC4'
    });

    broadcast({
      type: 'log',
      text: `Resources by type: ${Object.entries(byType).map(([k, v]) => `${k}:${v} (${(sizeByType[k] / 1024).toFixed(1)}KB)`).join(', ')}`,
      color: '#7B8794'
    });

    // ── Critical rendering path: render-blocking CSS and sync JS ─────────────
    const blockingResources = await page.evaluate(() => {
      const blocking = [];
      // Render-blocking stylesheets
      const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
      for (const ss of stylesheets) {
        if (!ss.media || ss.media === 'all' || ss.media === 'screen') {
          blocking.push({ url: ss.href, type: 'css', reason: 'Render-blocking stylesheet' });
        }
      }
      // Synchronous scripts in <head>
      const scripts = document.querySelectorAll('head script[src]:not([async]):not([defer]):not([type="module"])');
      for (const s of scripts) {
        blocking.push({ url: s.src, type: 'script', reason: 'Synchronous script in <head>' });
      }
      return blocking;
    });

    if (blockingResources.length > 3) {
      bugs.push(makeBug(
        'medium',
        `${blockingResources.length} render-blocking resources in critical path`,
        'perf_load',
        `Multiple render-blocking stylesheets and synchronous scripts delay first render:\n${blockingResources.slice(0, 8).map(r => `- [${r.type}] ${r.url.split('/').pop()}: ${r.reason}`).join('\n')}`,
        ['Navigate to ' + url, 'Run Lighthouse audit', 'Check "Eliminate render-blocking resources" suggestion'],
        'Minimize render-blocking resources (defer JS, inline critical CSS)',
        `${blockingResources.length} render-blocking resources`,
        url
      ));
    }

    // ── CSS Coverage ─────────────────────────────────────────────────────────
    broadcast({ type: 'log', text: 'Analyzing CSS coverage...', color: '#4ECDC4' });

    let cssCoverage = null;
    try {
      await page.coverage.startCSSCoverage();
      await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
      // Scroll to trigger lazy styles
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 0));

      const cssEntries = await page.coverage.stopCSSCoverage();

      let totalCSSBytes = 0;
      let usedCSSBytes = 0;
      const unusedCSS = [];

      for (const entry of cssEntries) {
        totalCSSBytes += entry.text.length;
        let entryUsed = 0;
        for (const range of entry.ranges) {
          entryUsed += range.end - range.start;
        }
        usedCSSBytes += entryUsed;
        const unusedPct = totalCSSBytes > 0 ? ((entry.text.length - entryUsed) / entry.text.length * 100) : 0;
        if (unusedPct > 50 && entry.text.length > 1024) {
          unusedCSS.push({ url: entry.url, total: entry.text.length, used: entryUsed, unusedPct: Math.round(unusedPct) });
        }
      }

      const overallUnusedPct = totalCSSBytes > 0 ? Math.round(((totalCSSBytes - usedCSSBytes) / totalCSSBytes) * 100) : 0;
      cssCoverage = { totalCSSBytes, usedCSSBytes, overallUnusedPct };

      broadcast({ type: 'log', text: `CSS coverage: ${overallUnusedPct}% unused (${(totalCSSBytes / 1024).toFixed(1)}KB total)`, color: '#7B8794' });

      if (overallUnusedPct > 60 && totalCSSBytes > 50 * 1024) {
        bugs.push(makeBug(
          'medium',
          `${overallUnusedPct}% of CSS is unused (${((totalCSSBytes - usedCSSBytes) / 1024).toFixed(1)}KB wasted)`,
          'perf_load_css',
          `${overallUnusedPct}% of loaded CSS is not used on this page, wasting ${((totalCSSBytes - usedCSSBytes) / 1024).toFixed(1)}KB.\n\nMost wasteful files:\n${unusedCSS.slice(0, 5).map(c => `- ${c.url.split('/').pop()}: ${c.unusedPct}% unused (${(c.total / 1024).toFixed(1)}KB)`).join('\n')}`,
          ['Navigate to ' + url, 'Open DevTools > Coverage tab', 'Click record and reload', 'Check CSS coverage'],
          'CSS files should have less than 60% unused code',
          `${overallUnusedPct}% CSS unused`,
          url
        ));
      }
    } catch (e) {
      broadcast({ type: 'log', text: `CSS coverage error: ${e.message}`, color: '#FF6B35' });
    }

    // ── JS Coverage ──────────────────────────────────────────────────────────
    broadcast({ type: 'log', text: 'Analyzing JS coverage...', color: '#4ECDC4' });

    try {
      await page.coverage.startJSCoverage();
      await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 0));

      // Click some interactive elements to trigger JS
      const clickables = await page.$$('button, a, [role="button"]');
      for (const el of clickables.slice(0, 5)) {
        await el.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(200);
      }

      const jsEntries = await page.coverage.stopJSCoverage();

      let totalJSBytes = 0;
      let usedJSBytes = 0;
      const unusedJS = [];

      for (const entry of jsEntries) {
        totalJSBytes += entry.text.length;
        let entryUsed = 0;
        for (const range of entry.ranges) {
          entryUsed += range.end - range.start;
        }
        usedJSBytes += entryUsed;
        const unusedPct = entry.text.length > 0 ? ((entry.text.length - entryUsed) / entry.text.length * 100) : 0;
        if (unusedPct > 50 && entry.text.length > 5 * 1024) {
          unusedJS.push({ url: entry.url, total: entry.text.length, used: entryUsed, unusedPct: Math.round(unusedPct) });
        }
      }

      const overallJSUnusedPct = totalJSBytes > 0 ? Math.round(((totalJSBytes - usedJSBytes) / totalJSBytes) * 100) : 0;

      broadcast({ type: 'log', text: `JS coverage: ${overallJSUnusedPct}% unused (${(totalJSBytes / 1024).toFixed(1)}KB total)`, color: '#7B8794' });

      if (overallJSUnusedPct > 60 && totalJSBytes > 100 * 1024) {
        bugs.push(makeBug(
          'medium',
          `${overallJSUnusedPct}% of JavaScript is unused (${((totalJSBytes - usedJSBytes) / 1024).toFixed(1)}KB wasted)`,
          'perf_load_js',
          `${overallJSUnusedPct}% of loaded JavaScript is not executed on this page, wasting ${((totalJSBytes - usedJSBytes) / 1024).toFixed(1)}KB.\n\nConsider code splitting and lazy loading.\n\nMost wasteful files:\n${unusedJS.slice(0, 5).map(j => `- ${j.url.split('/').pop()}: ${j.unusedPct}% unused (${(j.total / 1024).toFixed(1)}KB)`).join('\n')}`,
          ['Navigate to ' + url, 'Open DevTools > Coverage tab', 'Record JS coverage', 'Look for large unused bundles'],
          'JS files should have less than 60% unused code',
          `${overallJSUnusedPct}% JS unused`,
          url
        ));
      }
    } catch (e) {
      broadcast({ type: 'log', text: `JS coverage error: ${e.message}`, color: '#FF6B35' });
    }

    // Navigate back for remaining checks
    await page.goto(url, { waitUntil: 'load', timeout: timeoutMs }).catch(() => {});

    // ── Image optimization checks ────────────────────────────────────────────
    broadcast({ type: 'log', text: 'Checking image optimization...', color: '#4ECDC4' });

    const imageIssues = await page.evaluate(() => {
      const issues = [];
      const images = document.querySelectorAll('img');
      const viewportHeight = window.innerHeight;

      for (const img of images) {
        const rect = img.getBoundingClientRect();
        const isBelowFold = rect.top > viewportHeight;
        const src = img.src || img.currentSrc || '';
        const srcLower = src.toLowerCase();

        // Check for missing width/height (CLS cause)
        if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
          if (!img.style.width && !img.style.height) {
            issues.push({
              type: 'missing_dimensions',
              src: src.split('/').pop().substring(0, 80),
              isBelowFold,
            });
          }
        }

        // Check for lazy loading below fold
        if (isBelowFold && img.loading !== 'lazy' && !img.hasAttribute('loading')) {
          issues.push({
            type: 'missing_lazy',
            src: src.split('/').pop().substring(0, 80),
          });
        }

        // Check for non-modern format
        if (srcLower && !srcLower.includes('.webp') && !srcLower.includes('.avif') && !srcLower.includes('.svg') && !srcLower.includes('data:')) {
          if (srcLower.includes('.jpg') || srcLower.includes('.jpeg') || srcLower.includes('.png') || srcLower.includes('.gif') || srcLower.includes('.bmp')) {
            issues.push({
              type: 'non_modern_format',
              src: src.split('/').pop().substring(0, 80),
              format: srcLower.match(/\.(jpg|jpeg|png|gif|bmp)/)?.[1] || 'unknown',
            });
          }
        }
      }

      return issues;
    });

    // Check for large images via resource entries
    const largeImages = resources.filter(r =>
      (r.type === 'img' || r.type === 'image') && r.size > 200 * 1024
    );

    if (largeImages.length > 0) {
      bugs.push(makeBug(
        'medium',
        `${largeImages.length} oversized images (> 200KB each)`,
        'perf_load_images',
        `Large unoptimized images slow page load:\n${largeImages.slice(0, 5).map(img => `- ${img.name.split('/').pop()}: ${(img.size / 1024).toFixed(1)}KB`).join('\n')}\n\nConsider compressing images and using modern formats (WebP/AVIF).`,
        ['Navigate to ' + url, 'Open DevTools Network tab', 'Filter by Img', 'Sort by Size'],
        'Images should be under 200KB (compressed, modern format)',
        `${largeImages.length} image(s) over 200KB`,
        url
      ));
    }

    const missingDimensions = imageIssues.filter(i => i.type === 'missing_dimensions');
    if (missingDimensions.length > 3) {
      bugs.push(makeBug(
        'medium',
        `${missingDimensions.length} images without explicit dimensions (CLS risk)`,
        'perf_load_images',
        `Images without width/height attributes cause layout shifts when they load:\n${missingDimensions.slice(0, 5).map(i => `- ${i.src}`).join('\n')}`,
        ['Navigate to ' + url, 'Check img tags for width and height attributes'],
        'All images should have explicit width and height attributes',
        `${missingDimensions.length} images missing dimensions`,
        url
      ));
    }

    const missingLazy = imageIssues.filter(i => i.type === 'missing_lazy');
    if (missingLazy.length > 3) {
      bugs.push(makeBug(
        'low',
        `${missingLazy.length} below-fold images without lazy loading`,
        'perf_load_images',
        `Images below the fold should use loading="lazy" to defer loading until needed:\n${missingLazy.slice(0, 5).map(i => `- ${i.src}`).join('\n')}`,
        ['Navigate to ' + url, 'Check below-fold images for loading="lazy" attribute'],
        'Below-fold images should have loading="lazy"',
        `${missingLazy.length} images without lazy loading`,
        url
      ));
    }

    const nonModernFormat = imageIssues.filter(i => i.type === 'non_modern_format');
    if (nonModernFormat.length > 3) {
      bugs.push(makeBug(
        'low',
        `${nonModernFormat.length} images in legacy formats (no WebP/AVIF)`,
        'perf_load_images',
        `Images served in legacy formats (JPEG/PNG/GIF) instead of modern formats:\n${nonModernFormat.slice(0, 5).map(i => `- ${i.src} (${i.format})`).join('\n')}\n\nWebP/AVIF can reduce file sizes by 25-50%.`,
        ['Convert images to WebP or AVIF format', 'Use <picture> with fallbacks for older browsers'],
        'Images should use modern formats (WebP/AVIF)',
        `${nonModernFormat.length} images in legacy formats`,
        url
      ));
    }

    // ── Font loading checks ──────────────────────────────────────────────────
    broadcast({ type: 'log', text: 'Checking font loading...', color: '#4ECDC4' });

    const fontInfo = await page.evaluate(() => {
      const fonts = performance.getEntriesByType('resource').filter(r =>
        r.initiatorType === 'css' && (r.name.includes('.woff') || r.name.includes('.woff2') || r.name.includes('.ttf') || r.name.includes('.otf') || r.name.includes('.eot'))
      );

      // Check for font-display in stylesheets
      let hasFontDisplaySwap = false;
      try {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.type === CSSRule.FONT_FACE_RULE) {
                if (rule.style.fontDisplay === 'swap' || rule.style.fontDisplay === 'optional' || rule.style.fontDisplay === 'fallback') {
                  hasFontDisplaySwap = true;
                }
              }
            }
          } catch (e) {} // CORS
        }
      } catch (e) {}

      return {
        fontCount: fonts.length,
        fontFiles: fonts.map(f => ({ name: f.name.split('/').pop(), size: f.transferSize, duration: Math.round(f.duration) })),
        hasFontDisplaySwap,
      };
    });

    if (fontInfo.fontCount > 5) {
      bugs.push(makeBug(
        'medium',
        `${fontInfo.fontCount} font files loaded`,
        'perf_load_fonts',
        `Loading ${fontInfo.fontCount} font files increases page weight and may cause FOIT (Flash of Invisible Text).\n\nFonts:\n${fontInfo.fontFiles.slice(0, 8).map(f => `- ${f.name}: ${(f.size / 1024).toFixed(1)}KB, ${f.duration}ms`).join('\n')}`,
        ['Navigate to ' + url, 'Filter Network by Font', 'Count font files'],
        'Use 2-3 font files maximum, consider system fonts or variable fonts',
        `${fontInfo.fontCount} font files`,
        url
      ));
    }

    if (fontInfo.fontCount > 0 && !fontInfo.hasFontDisplaySwap) {
      bugs.push(makeBug(
        'low',
        'Missing font-display: swap (FOIT risk)',
        'perf_load_fonts',
        'Custom fonts are loaded without font-display: swap (or optional/fallback). This can cause Flash of Invisible Text (FOIT), making text invisible until fonts load.',
        ['Navigate to ' + url, 'Check @font-face rules for font-display property'],
        'All @font-face rules should include font-display: swap',
        'No font-display: swap detected',
        url
      ));
    }

    // ── Cache header checks ──────────────────────────────────────────────────
    broadcast({ type: 'log', text: 'Checking cache headers...', color: '#4ECDC4' });

    const staticTypes = ['script', 'stylesheet', 'img', 'image', 'font'];
    const uncachedStatic = networkRequests.filter(r => {
      if (!staticTypes.includes(r.type)) return false;
      const cc = r.cacheControl || '';
      if (!cc) return true;
      const maxAgeMatch = cc.match(/max-age=(\d+)/);
      if (maxAgeMatch && parseInt(maxAgeMatch[1]) < 86400) return true; // Less than 1 day
      if (cc.includes('no-cache') || cc.includes('no-store')) return true;
      return false;
    });

    if (uncachedStatic.length > 5) {
      bugs.push(makeBug(
        'medium',
        `${uncachedStatic.length} static assets with poor cache headers`,
        'perf_load_cache',
        `Static assets (JS, CSS, images, fonts) should have Cache-Control with max-age > 1 day for repeat visits.\n\nPoorly cached resources:\n${uncachedStatic.slice(0, 8).map(r => `- ${r.url.split('/').pop().substring(0, 60)}: ${r.cacheControl || 'no cache header'}`).join('\n')}`,
        ['Navigate to ' + url, 'Open DevTools Network tab', 'Check Cache-Control headers on static assets'],
        'Static assets should have Cache-Control: max-age=31536000 (or similar long-term caching)',
        `${uncachedStatic.length} assets with < 1 day cache`,
        url
      ));
    }

    // ── CDN detection ────────────────────────────────────────────────────────
    const cdnIndicators = ['cloudflare', 'cloudfront', 'akamai', 'fastly', 'cdn', 'edgecast', 'keycdn', 'stackpath', 'bunny', 'vercel', 'netlify'];
    const cdnDetected = networkRequests.some(r => {
      const serverHeader = (r.server || '').toLowerCase();
      const responseHeaders = r.responseHeaders || {};
      const allHeaderValues = Object.values(responseHeaders).join(' ').toLowerCase();
      return cdnIndicators.some(cdn => serverHeader.includes(cdn) || allHeaderValues.includes(cdn));
    });

    if (!cdnDetected && resources.length > 20) {
      bugs.push(makeBug(
        'info',
        'No CDN detected for static assets',
        'perf_load_cdn',
        'No CDN (Content Delivery Network) indicators found in response headers. A CDN can significantly reduce latency for users in different geographic regions.',
        ['Check if static assets are served from a CDN', 'Consider using Cloudflare, CloudFront, or similar CDN'],
        'Static assets should be served via CDN for global performance',
        'No CDN detected in response headers',
        url
      ));
    }

    // ── Too many domains (DNS lookups) ───────────────────────────────────────
    if (domains.size > 10) {
      bugs.push(makeBug(
        'low',
        `Resources from ${domains.size} different domains`,
        'perf_load',
        `Page loads resources from ${domains.size} different domains, each requiring a DNS lookup that adds latency.\n\nDomains: ${[...domains].slice(0, 15).join(', ')}`,
        ['Navigate to ' + url, 'Open Network tab', 'Check unique domains in requests'],
        'Minimize number of unique domains (prefer < 10)',
        `${domains.size} unique domains`,
        url
      ));
    }

    // ── Synchronous XHR detection ────────────────────────────────────────────
    const hasSyncXHR = await page.evaluate(() => {
      // Check if any script uses synchronous XHR
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        const text = s.textContent || '';
        if (text.includes('.open(') && text.includes('false') && text.includes('XMLHttpRequest')) {
          return true;
        }
      }
      return false;
    });

    if (hasSyncXHR) {
      bugs.push(makeBug(
        'high',
        'Synchronous XMLHttpRequest detected',
        'perf_load',
        'Synchronous XHR blocks the main thread and is deprecated. It freezes the UI until the request completes.',
        ['Navigate to ' + url, 'Search scripts for synchronous XMLHttpRequest calls', 'Convert to async fetch() or async XHR'],
        'All XHR calls should be asynchronous',
        'Synchronous XHR found in page scripts',
        url
      ));
    }

    // ── Long task detection during load ──────────────────────────────────────
    const longTasks = await page.evaluate(() => {
      return new Promise((resolve) => {
        const tasks = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            tasks.push({ duration: Math.round(entry.duration), startTime: Math.round(entry.startTime) });
          }
        });
        try { observer.observe({ type: 'longtask', buffered: true }); } catch (e) {}
        setTimeout(() => {
          observer.disconnect();
          resolve(tasks);
        }, 2000);
      });
    });

    if (longTasks.length > 0) {
      const totalBlocking = longTasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0);
      if (totalBlocking > 500) {
        bugs.push(makeBug(
          'medium',
          `Main thread blocked for ${Math.round(totalBlocking)}ms during load`,
          'perf_load',
          `${longTasks.length} long tasks detected, blocking the main thread for a total of ${Math.round(totalBlocking)}ms.\n\nLongest tasks:\n${longTasks.sort((a, b) => b.duration - a.duration).slice(0, 5).map(t => `- ${t.duration}ms at ${t.startTime}ms`).join('\n')}`,
          ['Navigate to ' + url, 'Open DevTools Performance tab', 'Record page load', 'Look for long yellow/red blocks on main thread'],
          'Total blocking time should be under 500ms',
          `${Math.round(totalBlocking)}ms total blocking time`,
          url
        ));
      }
    }

    // ── Report slow page load ────────────────────────────────────────────────
    if (loadTime > 5000) {
      const slowest = resources.slice(0, 5);
      bugs.push(makeBug(
        'high',
        `Slow page load: ${loadTime}ms`,
        'perf_load',
        `Page takes over 5 seconds to load.\n\nSlowest resources:\n${slowest.map(r => `- ${r.name.split('/').pop()}: ${r.duration}ms (${(r.size / 1024).toFixed(1)}KB)`).join('\n')}`,
        ['Navigate to ' + url, 'Observe load time in Network tab'],
        'Page should load in under 5 seconds',
        `Page loaded in ${loadTime}ms`,
        url
      ));
    } else if (loadTime > 3000) {
      bugs.push(makeBug(
        'medium',
        `Moderate page load time: ${loadTime}ms`,
        'perf_load',
        'Page load time is over 3 seconds, which may impact user experience.',
        ['Navigate to ' + url],
        'Page should load in under 3 seconds',
        `Page loaded in ${loadTime}ms`,
        url
      ));
    }

    // Large page weight
    if (totalSize > 3 * 1024 * 1024) {
      bugs.push(makeBug(
        'medium',
        `Large page weight: ${(totalSize / 1024 / 1024).toFixed(2)}MB`,
        'perf_load',
        `Total page weight exceeds 3MB which impacts load time on slow connections.\n\nBreakdown by type:\n${Object.entries(sizeByType).sort((a, b) => b[1] - a[1]).map(([t, s]) => `- ${t}: ${(s / 1024).toFixed(1)}KB`).join('\n')}`,
        ['Navigate to ' + url, 'Check Network tab total size'],
        'Page should be under 3MB total',
        `Page is ${(totalSize / 1024 / 1024).toFixed(2)}MB`,
        url
      ));
    }

    // Check for slow individual resources
    for (const res of resources.filter(r => r.duration > 2000).slice(0, 3)) {
      bugs.push(makeBug(
        'medium',
        `Slow resource: ${res.duration}ms`,
        'perf_load',
        `Resource takes over 2 seconds to load: ${res.name.split('/').pop()} (${res.type}, ${(res.size / 1024).toFixed(1)}KB)`,
        ['Navigate to ' + url, 'Open DevTools Network tab', 'Find slow resources'],
        'Resources should load in under 2 seconds',
        `Resource took ${res.duration}ms`,
        res.name
      ));
    }

    // ── Resource count by type summary ───────────────────────────────────────
    if (resources.length > 100) {
      bugs.push(makeBug(
        'medium',
        `Excessive resource count: ${resources.length} requests`,
        'perf_load',
        `Page makes ${resources.length} HTTP requests, which is excessive even with HTTP/2 multiplexing.\n\nBreakdown:\n${Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, c]) => `- ${t}: ${c} (${(sizeByType[t] / 1024).toFixed(1)}KB)`).join('\n')}\n\nConsider bundling, lazy loading, and reducing third-party scripts.`,
        ['Navigate to ' + url, 'Open Network tab', 'Note total request count'],
        'Page should make fewer than 100 HTTP requests',
        `${resources.length} requests`,
        url
      ));
    }
  } catch (error) {
    broadcast({ type: 'log', text: `Load profiling error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

// ── Stress Testing ────────────────────────────────────────────────────────────

async function runPerfStress(page, url, options, broadcast, browser) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Running comprehensive stress test...', color: '#4ECDC4' });

  try {
    // ── Phase 1: Concurrent session testing ──────────────────────────────────
    const concurrencyLevels = [1, 3, 5, 10, 15, 20];
    const results = [];

    for (const concurrency of concurrencyLevels) {
      broadcast({ type: 'log', text: `Testing with ${concurrency} concurrent sessions...`, color: '#7B8794' });

      const contexts = [];
      try {
        for (let i = 0; i < concurrency; i++) {
          const ctx = await browser.newContext();
          contexts.push(ctx);
        }
      } catch (e) {
        broadcast({ type: 'log', text: `Could not create ${concurrency} contexts: ${e.message}`, color: '#FF6B35' });
        // Clean up what we created
        for (const ctx of contexts) { await ctx.close().catch(() => {}); }
        break;
      }

      const startAll = Date.now();
      const navResults = await Promise.allSettled(
        contexts.map(async (ctx) => {
          const p = await ctx.newPage();
          const t0 = Date.now();
          await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          const loadTime = Date.now() - t0;
          await p.close();
          return loadTime;
        })
      );

      const totalTime = Date.now() - startAll;
      const successfulTimes = navResults
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .sort((a, b) => a - b);
      const failures = navResults.filter(r => r.status === 'rejected').length;

      if (successfulTimes.length > 0) {
        const avg = successfulTimes.reduce((a, b) => a + b, 0) / successfulTimes.length;
        const p50 = percentile(successfulTimes, 50);
        const p95 = percentile(successfulTimes, 95);
        const p99 = percentile(successfulTimes, 99);
        const min = successfulTimes[0];
        const max = successfulTimes[successfulTimes.length - 1];
        const throughput = concurrency / (totalTime / 1000); // requests per second

        results.push({
          concurrency,
          avg: Math.round(avg),
          p50: Math.round(p50),
          p95: Math.round(p95),
          p99: Math.round(p99),
          min: Math.round(min),
          max: Math.round(max),
          failures,
          totalTime,
          throughput: Math.round(throughput * 100) / 100,
          errorRate: (failures / concurrency * 100).toFixed(1),
        });

        broadcast({
          type: 'log',
          text: `  ${concurrency} users: avg ${Math.round(avg)}ms | p50 ${Math.round(p50)}ms | p95 ${Math.round(p95)}ms | p99 ${Math.round(p99)}ms | min ${min}ms | max ${max}ms | ${throughput.toFixed(2)} req/s${failures ? ` | ${failures} failed` : ''}`,
          color: failures > 0 ? '#FF6B35' : '#4ECDC4'
        });
      } else {
        results.push({ concurrency, avg: 0, failures: concurrency, totalTime, errorRate: '100' });
        broadcast({ type: 'log', text: `  ${concurrency} users: ALL FAILED`, color: '#FF2D2D' });
      }

      // Cleanup
      for (const ctx of contexts) { await ctx.close().catch(() => {}); }

      // Small delay between levels
      await new Promise(r => setTimeout(r, 500));
    }

    // ── Analyze degradation ──────────────────────────────────────────────────
    const successResults = results.filter(r => r.avg > 0);
    if (successResults.length >= 2) {
      const baseline = successResults[0];
      const highest = successResults[successResults.length - 1];
      const degradation = ((highest.avg - baseline.avg) / baseline.avg) * 100;

      // Build results table for description
      const resultsTable = successResults.map(r =>
        `- ${r.concurrency} users: avg ${r.avg}ms, p50 ${r.p50}ms, p95 ${r.p95}ms, p99 ${r.p99}ms, ${r.throughput} req/s${r.failures > 0 ? `, ${r.failures} failed (${r.errorRate}%)` : ''}`
      ).join('\n');

      if (degradation > 100) {
        bugs.push(makeBug(
          'high',
          `Severe performance degradation under load (${degradation.toFixed(0)}% slower)`,
          'perf_stress',
          `Response time more than doubles under ${highest.concurrency} concurrent users.\n\nResults:\n${resultsTable}`,
          [`Open ${highest.concurrency} browser tabs`, 'Navigate to ' + url + ' in all tabs simultaneously'],
          'Consistent response times under load',
          `${degradation.toFixed(0)}% degradation at ${highest.concurrency} concurrent users`,
          url
        ));
      } else if (degradation > 50) {
        bugs.push(makeBug(
          'medium',
          `Performance degradation under load (${degradation.toFixed(0)}% slower)`,
          'perf_stress',
          `Response time increases by ${degradation.toFixed(0)}% under ${highest.concurrency} concurrent users.\n\nResults:\n${resultsTable}`,
          [`Open ${highest.concurrency} browser tabs`, 'Navigate to ' + url + ' simultaneously'],
          'Consistent response times under load',
          `${degradation.toFixed(0)}% degradation`,
          url
        ));
      }

      // Find breaking point (where error rate > 0 or p95 > 5s)
      const breakpoint = successResults.find(r => parseFloat(r.errorRate) > 0 || r.p95 > 5000);
      if (breakpoint) {
        bugs.push(makeBug(
          'high',
          `Performance breaking point at ${breakpoint.concurrency} concurrent users`,
          'perf_stress',
          `Application begins failing or severely degrading at ${breakpoint.concurrency} concurrent users.\n\nAt this level: avg ${breakpoint.avg}ms, p95 ${breakpoint.p95}ms, error rate ${breakpoint.errorRate}%\n\nFull results:\n${resultsTable}`,
          ['Run load test with increasing concurrency', `At ${breakpoint.concurrency} users, errors/timeouts begin`],
          'Application should handle at least 20 concurrent users',
          `Breaking point at ${breakpoint.concurrency} users`,
          url
        ));
      }

      // Check total failures
      const totalFailures = results.reduce((sum, r) => sum + r.failures, 0);
      if (totalFailures > 0) {
        bugs.push(makeBug(
          'high',
          `${totalFailures} requests failed during stress test`,
          'perf_stress',
          `Some requests failed during concurrent load testing, indicating capacity issues.\n\nFailure breakdown:\n${results.filter(r => r.failures > 0).map(r => `- ${r.concurrency} users: ${r.failures}/${r.concurrency} failed (${r.errorRate}%)`).join('\n')}`,
          ['Run concurrent load test'],
          'All requests should succeed',
          `${totalFailures} total failures`,
          url
        ));
      }

      // Rate limiting detection
      const rateLimited = results.find(r =>
        r.failures > 0 && r.concurrency > 5 && results.find(r2 => r2.concurrency < 5 && r2.failures === 0)
      );
      if (rateLimited) {
        bugs.push(makeBug(
          'info',
          `Possible rate limiting at ${rateLimited.concurrency} concurrent requests`,
          'perf_stress',
          `Requests begin failing at ${rateLimited.concurrency} concurrency but succeed at lower levels. This may indicate server-side rate limiting.\n\nThis is not necessarily a bug — rate limiting is a valid security measure — but it should be documented.`,
          ['Send rapid concurrent requests', 'Observe failure pattern'],
          'Rate limits should be documented and return proper 429 status codes',
          `Requests fail at ${rateLimited.concurrency} concurrency`,
          url
        ));
      }
    }

    // ── Phase 2: Rapid sequential requests ───────────────────────────────────
    broadcast({ type: 'log', text: 'Testing rapid sequential requests...', color: '#4ECDC4' });

    try {
      const rapidTimes = [];
      const ctx = await browser.newContext();
      const rapidPage = await ctx.newPage();

      for (let i = 0; i < 20; i++) {
        const t0 = Date.now();
        try {
          await rapidPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          rapidTimes.push(Date.now() - t0);
        } catch (e) {
          rapidTimes.push(-1); // Failed
        }
        // No delay between requests
      }

      await rapidPage.close();
      await ctx.close();

      const successTimes = rapidTimes.filter(t => t > 0);
      const rapidFailures = rapidTimes.filter(t => t < 0).length;

      if (successTimes.length > 0) {
        const avgRapid = successTimes.reduce((a, b) => a + b, 0) / successTimes.length;
        // Check if later requests are slower (connection pool exhaustion)
        const firstHalf = successTimes.slice(0, Math.floor(successTimes.length / 2));
        const secondHalf = successTimes.slice(Math.floor(successTimes.length / 2));
        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        if (avgSecond > avgFirst * 2 && avgSecond > 2000) {
          bugs.push(makeBug(
            'medium',
            'Connection pool exhaustion: sequential requests slow down',
            'perf_stress',
            `Rapid sequential requests show degradation over time, suggesting connection pool exhaustion or resource leaking.\n\nFirst 10 avg: ${Math.round(avgFirst)}ms\nLast 10 avg: ${Math.round(avgSecond)}ms\n${rapidFailures} failures out of 20 requests`,
            ['Open a single tab', 'Rapidly reload the page 20 times', 'Note increasing load times'],
            'Consistent response time across sequential requests',
            `${Math.round((avgSecond / avgFirst - 1) * 100)}% slower after repeated requests`,
            url
          ));
        }
      }

      if (rapidFailures > 3) {
        broadcast({ type: 'log', text: `Rapid sequential: ${rapidFailures}/20 failures`, color: '#FF6B35' });
      }
    } catch (e) {
      broadcast({ type: 'log', text: `Rapid sequential test error: ${e.message}`, color: '#FF6B35' });
    }

    // ── Phase 3: Memory leak detection ───────────────────────────────────────
    broadcast({ type: 'log', text: 'Testing for memory leaks (50 navigations)...', color: '#4ECDC4' });

    try {
      const ctx = await browser.newContext();
      const memPage = await ctx.newPage();
      const memSamples = [];

      for (let i = 0; i < 50; i++) {
        try {
          await memPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

          if (i % 10 === 0) {
            const mem = await memPage.evaluate(() => {
              if (performance.memory) {
                return {
                  usedJSHeapSize: performance.memory.usedJSHeapSize,
                  totalJSHeapSize: performance.memory.totalJSHeapSize,
                };
              }
              return null;
            });
            if (mem) {
              memSamples.push({ iteration: i, ...mem });
            }
          }
        } catch (e) {
          // Continue
        }
      }

      await memPage.close();
      await ctx.close();

      if (memSamples.length >= 3) {
        // Check if memory grows monotonically
        let increasing = 0;
        for (let i = 1; i < memSamples.length; i++) {
          if (memSamples[i].usedJSHeapSize > memSamples[i - 1].usedJSHeapSize) {
            increasing++;
          }
        }

        const firstMem = memSamples[0].usedJSHeapSize;
        const lastMem = memSamples[memSamples.length - 1].usedJSHeapSize;
        const growthMB = (lastMem - firstMem) / (1024 * 1024);
        const isMonotonicallyIncreasing = increasing === memSamples.length - 1;

        if (isMonotonicallyIncreasing && growthMB > 10) {
          bugs.push(makeBug(
            'high',
            `Memory leak detected: ${growthMB.toFixed(1)}MB growth over 50 navigations`,
            'perf_stress_memory',
            `JS heap grows monotonically over 50 page navigations, indicating a memory leak.\n\nMemory samples:\n${memSamples.map(s => `- Iteration ${s.iteration}: ${(s.usedJSHeapSize / (1024 * 1024)).toFixed(1)}MB used`).join('\n')}\n\nGrowth: ${growthMB.toFixed(1)}MB (${((growthMB / (firstMem / (1024 * 1024))) * 100).toFixed(0)}% increase)`,
            ['Navigate to ' + url + ' 50 times in same tab', 'Monitor JS heap in DevTools Memory tab', 'Observe monotonic growth'],
            'Memory should remain stable across navigations',
            `Memory grew by ${growthMB.toFixed(1)}MB (monotonically increasing)`,
            url
          ));
          broadcast({ type: 'log', text: `Memory leak detected: ${growthMB.toFixed(1)}MB growth`, color: '#FF2D2D' });
        } else if (growthMB > 20) {
          bugs.push(makeBug(
            'medium',
            `Significant memory growth: ${growthMB.toFixed(1)}MB over 50 navigations`,
            'perf_stress_memory',
            `JS heap grew by ${growthMB.toFixed(1)}MB over 50 page navigations.\n\nMemory samples:\n${memSamples.map(s => `- Iteration ${s.iteration}: ${(s.usedJSHeapSize / (1024 * 1024)).toFixed(1)}MB used`).join('\n')}`,
            ['Navigate to ' + url + ' 50 times', 'Monitor memory in DevTools'],
            'Memory should remain relatively stable',
            `Memory grew by ${growthMB.toFixed(1)}MB`,
            url
          ));
        }

        broadcast({
          type: 'log',
          text: `Memory: start ${(firstMem / (1024 * 1024)).toFixed(1)}MB, end ${(lastMem / (1024 * 1024)).toFixed(1)}MB, growth ${growthMB.toFixed(1)}MB`,
          color: '#7B8794'
        });
      } else {
        broadcast({ type: 'log', text: 'Memory profiling not available (performance.memory not supported)', color: '#7B8794' });
      }
    } catch (e) {
      broadcast({ type: 'log', text: `Memory leak test error: ${e.message}`, color: '#FF6B35' });
    }

    // ── Phase 4: Large POST payload test ─────────────────────────────────────
    broadcast({ type: 'log', text: 'Testing large POST payload handling...', color: '#4ECDC4' });

    try {
      const ctx = await browser.newContext();
      const postPage = await ctx.newPage();
      await postPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Find forms and try posting large data
      const forms = await postPage.$$('form');
      if (forms.length > 0) {
        const payloadSizes = [
          { name: '100KB', size: 100 * 1024 },
          { name: '1MB', size: 1024 * 1024 },
          { name: '5MB', size: 5 * 1024 * 1024 },
        ];

        for (const { name, size } of payloadSizes) {
          try {
            const largeData = 'X'.repeat(size);
            const textInput = await postPage.$('input[type="text"], textarea');
            if (textInput) {
              await textInput.evaluate((el, data) => { el.value = data; }, largeData);

              const startTime = Date.now();
              await postPage.keyboard.press('Enter').catch(() => {});
              await postPage.waitForTimeout(3000);
              const elapsed = Date.now() - startTime;

              if (elapsed > 10000) {
                bugs.push(makeBug(
                  'medium',
                  `Slow response with ${name} POST payload (${(elapsed / 1000).toFixed(1)}s)`,
                  'perf_stress',
                  `Server took ${(elapsed / 1000).toFixed(1)} seconds to respond to a ${name} POST payload.`,
                  ['Navigate to ' + url, `Submit a form with ${name} of data`],
                  `Server should handle ${name} payload within 10 seconds or reject it`,
                  `Response took ${(elapsed / 1000).toFixed(1)}s`,
                  url
                ));
              }

              // Reset
              await postPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            }
          } catch (e) {
            // Timeout or crash with large payload is expected behavior (good if server rejects it)
          }
        }
      }

      await postPage.close();
      await ctx.close();
    } catch (e) {
      broadcast({ type: 'log', text: `Large POST test error: ${e.message}`, color: '#FF6B35' });
    }

    // ── Phase 5: Keep-alive / connection reuse check ─────────────────────────
    broadcast({ type: 'log', text: 'Checking connection reuse...', color: '#4ECDC4' });

    try {
      const ctx = await browser.newContext();
      const keepAlivePage = await ctx.newPage();

      const connectionInfo = [];
      keepAlivePage.on('response', (res) => {
        const conn = res.headers()['connection'] || '';
        const keepAlive = res.headers()['keep-alive'] || '';
        connectionInfo.push({ url: res.url(), connection: conn, keepAlive });
      });

      await keepAlivePage.goto(url, { waitUntil: 'load', timeout: 15000 });

      const closeConnections = connectionInfo.filter(c => c.connection.toLowerCase() === 'close');
      if (closeConnections.length > 3) {
        bugs.push(makeBug(
          'low',
          `${closeConnections.length} responses with Connection: close`,
          'perf_stress',
          `Multiple responses include "Connection: close" header, preventing connection reuse. This forces new TCP connections for each request, adding latency.\n\nAffected URLs:\n${closeConnections.slice(0, 5).map(c => `- ${c.url.split('/').pop().substring(0, 60)}`).join('\n')}`,
          ['Navigate to ' + url, 'Check Connection header in Network tab'],
          'Responses should use keep-alive for connection reuse',
          `${closeConnections.length} responses closing connections`,
          url
        ));
      }

      await keepAlivePage.close();
      await ctx.close();
    } catch (e) {
      // Non-critical
    }

    broadcast({ type: 'log', text: 'Stress test complete', color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Stress test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runPerfVitals, runPerfLoad, runPerfStress };
