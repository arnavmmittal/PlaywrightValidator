/**
 * Deterministic Performance Collector
 *
 * Runs a fixed sequence of Playwright operations to collect performance data.
 * No AI, no variance — same data points every time, for every site.
 * Runs 3 times and takes the median for stable, reproducible scores.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const STABILIZE_DELAY_MS = 5000;
const NAV_TIMEOUT_MS = 30000;
const NUM_RUNS = 3;
const SCREENSHOTS_DIR = path.join(__dirname, '../../screenshots');

/**
 * Collect all performance data for a URL.
 * Returns a CollectionResult with deterministic, typed shape.
 *
 * @param {string} url - The URL to benchmark
 * @param {function} [broadcast] - Optional callback for real-time progress updates
 * @returns {Promise<CollectionResult>}
 */
async function collectPerformanceData(url, broadcast = () => {}) {
  broadcast({ type: 'collector_status', phase: 'starting', message: 'Launching browser...' });

  const browser = await chromium.launch({ headless: true });

  try {
    // Run metric collection NUM_RUNS times for median
    const runs = [];
    for (let i = 0; i < NUM_RUNS; i++) {
      broadcast({
        type: 'collector_status',
        phase: 'collecting',
        run: i + 1,
        totalRuns: NUM_RUNS,
        message: `Collecting metrics (run ${i + 1}/${NUM_RUNS})...`
      });
      const runData = await _singleRun(browser, url, broadcast, i === 0);
      runs.push(runData);
    }

    // Compute medians from all runs
    const vitals = _computeMedianVitals(runs);

    // First run has the full resource/rendering/image/etc. data (doesn't change between runs)
    const firstRun = runs[0];

    const result = {
      url,
      domain: _extractDomain(url),
      collectedAt: new Date().toISOString(),
      vitals,
      resources: firstRun.resources,
      rendering: firstRun.rendering,
      images: firstRun.images,
      thirdParty: firstRun.thirdParty,
      dom: firstRun.dom,
      caching: firstRun.caching,
      screenshot: firstRun.screenshot,
      navTiming: firstRun.navTiming,
      consoleErrors: firstRun.consoleErrors,
    };

    broadcast({ type: 'collector_status', phase: 'complete', message: 'Data collection complete.' });
    return result;
  } finally {
    await browser.close();
  }
}

/**
 * Single collection run — navigates to URL and collects all data points.
 * @param {import('playwright').Browser} browser
 * @param {string} url
 * @param {function} broadcast
 * @param {boolean} collectStatic - Only collect static analysis (images, rendering, etc.) on first run
 */
async function _singleRun(browser, url, broadcast, collectStatic) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  const networkRequests = [];
  const consoleErrors = [];

  page.on('response', response => {
    networkRequests.push({
      url: response.url(),
      status: response.status(),
      method: response.request().method(),
      resourceType: response.request().resourceType(),
      headers: response.headers(),
    });
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Navigate
  await page.goto(url, { waitUntil: 'commit', timeout: NAV_TIMEOUT_MS });

  // Set up performance observers BEFORE load completes
  const vitalsPromise = page.evaluate((delay) => {
    return new Promise((resolve) => {
      const vitals = { lcp: null, fcp: null, cls: 0, longTasks: [] };

      const lcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) vitals.lcp = entries[entries.length - 1].startTime;
      });
      try { lcpObs.observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}

      const clsObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) vitals.cls += entry.value;
        }
      });
      try { clsObs.observe({ type: 'layout-shift', buffered: true }); } catch {}

      const paintObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') vitals.fcp = entry.startTime;
        }
      });
      try { paintObs.observe({ type: 'paint', buffered: true }); } catch {}

      const ltObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          vitals.longTasks.push({ duration: entry.duration, startTime: entry.startTime });
        }
      });
      try { ltObs.observe({ type: 'longtask', buffered: true }); } catch {}

      // TTFB from navigation timing
      const navEntries = performance.getEntriesByType('navigation');
      vitals.ttfb = navEntries.length > 0 ? navEntries[0].responseStart : null;

      setTimeout(() => {
        try { lcpObs.disconnect(); } catch {}
        try { clsObs.disconnect(); } catch {}
        try { paintObs.disconnect(); } catch {}
        try { ltObs.disconnect(); } catch {}
        resolve(vitals);
      }, delay);
    });
  }, STABILIZE_DELAY_MS);

  await page.waitForLoadState('load').catch(() => {});
  const rawVitals = await vitalsPromise;

  // Compute TBT
  let tbt = 0;
  for (const task of rawVitals.longTasks) {
    if (task.duration > 50) tbt += task.duration - 50;
  }

  // Navigation timing
  const navTiming = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return nav ? {
      dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
      tcp: Math.round(nav.connectEnd - nav.connectStart),
      ttfb: Math.round(nav.responseStart - nav.requestStart),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      loadComplete: Math.round(nav.loadEventEnd - nav.startTime),
      transferSize: nav.transferSize,
      protocol: nav.nextHopProtocol || 'unknown',
    } : null;
  });

  const runData = {
    vitals: {
      lcp: rawVitals.lcp ? Math.round(rawVitals.lcp) : null,
      fcp: rawVitals.fcp ? Math.round(rawVitals.fcp) : null,
      cls: Math.round(rawVitals.cls * 1000) / 1000, // 3 decimal places
      ttfb: rawVitals.ttfb ? Math.round(rawVitals.ttfb) : null,
      tbt: Math.round(tbt),
      inp: null, // INP requires real user interaction, not measurable synthetically
    },
    navTiming,
    consoleErrors: consoleErrors.slice(0, 10),
  };

  // Static analysis — only on first run (doesn't change between runs)
  if (collectStatic) {
    runData.resources = await _collectResources(page, networkRequests);
    runData.rendering = await _detectRendering(page);
    runData.images = await _auditImages(page);
    runData.thirdParty = _analyzeThirdParty(networkRequests, url);
    runData.dom = await _analyzeDom(page);
    runData.caching = _analyzeCaching(networkRequests);
    runData.screenshot = await _takeScreenshot(page, _extractDomain(url));
  }

  await context.close();
  return runData;
}

// ── Static Analysis Functions ────────────────────────────────────────────────

async function _collectResources(page, networkRequests) {
  const resources = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource');
    let jsSize = 0, cssSize = 0, imageSize = 0, fontSize = 0, otherSize = 0;
    let jsCount = 0, cssCount = 0, imageCount = 0, fontCount = 0;

    for (const r of entries) {
      const size = r.transferSize || 0;
      const type = r.initiatorType;
      if (type === 'script') { jsSize += size; jsCount++; }
      else if (type === 'css' || (type === 'link' && r.name.match(/\.css/))) { cssSize += size; cssCount++; }
      else if (type === 'img' || type === 'image') { imageSize += size; imageCount++; }
      else if (type === 'font' || (r.name && r.name.match(/\.(woff2?|ttf|otf|eot)/))) { fontSize += size; fontCount++; }
      else { otherSize += size; }
    }

    return {
      totalSize: jsSize + cssSize + imageSize + fontSize + otherSize,
      totalCount: entries.length,
      jsSize, jsCount,
      cssSize, cssCount,
      imageSize, imageCount,
      fontSize, fontCount,
      otherSize,
    };
  });

  // Add third-party vs first-party breakdown from network requests
  const domain = new URL(networkRequests[0]?.url || 'http://unknown').hostname;
  let firstPartySize = 0, thirdPartySize = 0;
  for (const req of networkRequests) {
    try {
      const reqDomain = new URL(req.url).hostname;
      const size = parseInt(req.headers['content-length'] || '0', 10);
      if (reqDomain === domain || reqDomain.endsWith('.' + domain)) {
        firstPartySize += size;
      } else {
        thirdPartySize += size;
      }
    } catch {}
  }

  return { ...resources, firstPartySize, thirdPartySize };
}

async function _detectRendering(page) {
  return page.evaluate(() => {
    const indicators = {
      strategy: 'unknown',
      framework: null,
      hydration: false,
      indicators: [],
    };

    // Next.js
    if (window.__NEXT_DATA__) {
      indicators.framework = 'Next.js';
      indicators.indicators.push('__NEXT_DATA__ detected');
      indicators.strategy = window.__NEXT_DATA__.props ? 'SSR' : 'SSG';
      if (document.getElementById('__next')) {
        indicators.hydration = true;
        indicators.indicators.push('React hydration root detected');
      }
    }
    // Nuxt
    else if (window.__NUXT__) {
      indicators.framework = 'Nuxt';
      indicators.indicators.push('__NUXT__ detected');
      indicators.strategy = 'SSR';
      indicators.hydration = true;
    }
    // Gatsby
    else if (document.getElementById('___gatsby')) {
      indicators.framework = 'Gatsby';
      indicators.strategy = 'SSG';
      indicators.hydration = true;
      indicators.indicators.push('___gatsby root detected');
    }
    // React (generic)
    else if (document.querySelector('[data-reactroot]') || document.querySelector('#root[data-reactroot]')) {
      indicators.framework = 'React';
      indicators.strategy = 'CSR';
      indicators.hydration = true;
      indicators.indicators.push('React root detected');
    }
    // Vue (generic)
    else if (document.querySelector('[data-v-]') || document.querySelector('#app[data-v-app]')) {
      indicators.framework = 'Vue';
      indicators.strategy = 'CSR';
      indicators.indicators.push('Vue markers detected');
    }
    // Angular
    else if (document.querySelector('[ng-version]') || document.querySelector('app-root')) {
      indicators.framework = 'Angular';
      indicators.strategy = 'CSR';
      indicators.indicators.push('Angular markers detected');
    }
    // Svelte/SvelteKit
    else if (document.querySelector('[data-sveltekit-hydrate]') || document.querySelector('.s-')) {
      indicators.framework = 'SvelteKit';
      indicators.strategy = 'SSR';
      indicators.hydration = true;
      indicators.indicators.push('SvelteKit markers detected');
    }

    // Meta generator tag
    const generator = document.querySelector('meta[name="generator"]');
    if (generator) {
      indicators.indicators.push(`Generator: ${generator.content}`);
      if (!indicators.framework) {
        const content = generator.content.toLowerCase();
        if (content.includes('wordpress')) indicators.framework = 'WordPress';
        else if (content.includes('hugo')) indicators.framework = 'Hugo';
        else if (content.includes('jekyll')) indicators.framework = 'Jekyll';
        else if (content.includes('astro')) indicators.framework = 'Astro';
      }
    }

    // Check if page has meaningful HTML without JS (SSR indicator)
    const bodyText = document.body?.innerText?.trim() || '';
    if (indicators.strategy === 'unknown') {
      if (bodyText.length > 200) {
        indicators.strategy = 'SSR';
        indicators.indicators.push('Substantial server-rendered HTML content detected');
      } else if (bodyText.length < 50) {
        indicators.strategy = 'CSR';
        indicators.indicators.push('Minimal initial HTML — likely client-rendered');
      } else {
        indicators.strategy = 'Static/Custom';
        indicators.indicators.push('No recognized framework — custom or static build');
      }
    }

    return indicators;
  });
}

async function _auditImages(page) {
  return page.evaluate(() => {
    const images = [];
    document.querySelectorAll('img').forEach(img => {
      if (!img.src || img.src.startsWith('data:')) return;
      const src = img.src;
      const ext = src.split('?')[0].split('.').pop()?.toLowerCase() || 'unknown';
      const format = ['webp', 'avif', 'svg'].includes(ext) ? ext :
                     ['jpg', 'jpeg'].includes(ext) ? 'jpeg' :
                     ['png'].includes(ext) ? 'png' :
                     ['gif'].includes(ext) ? 'gif' : 'unknown';

      images.push({
        src: src.substring(0, 150),
        format,
        lazy: img.loading === 'lazy',
        hasWidthHeight: !!(img.width && img.height),
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayWidth: img.clientWidth,
        displayHeight: img.clientHeight,
      });
    });
    return images.slice(0, 30); // Cap at 30 images
  });
}

function _analyzeThirdParty(networkRequests, pageUrl) {
  const pageDomain = _extractDomain(pageUrl);
  const thirdPartyMap = {};

  for (const req of networkRequests) {
    try {
      const reqDomain = new URL(req.url).hostname;
      if (reqDomain === pageDomain || reqDomain.endsWith('.' + pageDomain)) continue;

      // Group by root domain
      const parts = reqDomain.split('.');
      const rootDomain = parts.length >= 2 ? parts.slice(-2).join('.') : reqDomain;

      if (!thirdPartyMap[rootDomain]) {
        thirdPartyMap[rootDomain] = { domain: rootDomain, requests: 0, scripts: 0, blocking: 0 };
      }
      thirdPartyMap[rootDomain].requests++;
      if (req.resourceType === 'script') {
        thirdPartyMap[rootDomain].scripts++;
      }
    } catch {}
  }

  return Object.values(thirdPartyMap)
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 20);
}

async function _analyzeDom(page) {
  return page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    let maxDepth = 0;

    function getDepth(el) {
      let depth = 0;
      let current = el;
      while (current.parentElement) { depth++; current = current.parentElement; }
      return depth;
    }

    // Sample depth from a subset to avoid perf issues on huge DOMs
    const sample = Array.from(allElements).filter((_, i) => i % 10 === 0);
    for (const el of sample) {
      const d = getDepth(el);
      if (d > maxDepth) maxDepth = d;
    }

    return {
      nodeCount: allElements.length,
      maxDepth,
      iframes: document.querySelectorAll('iframe').length,
      scripts: document.querySelectorAll('script').length,
      stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
    };
  });
}

function _analyzeCaching(networkRequests) {
  let immutableAssets = 0;
  let noCacheAssets = 0;
  let cdnDetected = null;

  for (const req of networkRequests) {
    const cc = req.headers['cache-control'] || '';
    if (cc.includes('immutable') || cc.includes('max-age=31536000')) {
      immutableAssets++;
    } else if (cc.includes('no-cache') || cc.includes('no-store') || cc.includes('max-age=0')) {
      noCacheAssets++;
    }

    // CDN detection from common headers
    if (!cdnDetected) {
      const server = (req.headers['server'] || '').toLowerCase();
      const via = (req.headers['via'] || '').toLowerCase();
      const cdn = req.headers['x-cdn'] || req.headers['x-served-by'] || '';

      if (server.includes('cloudflare') || req.headers['cf-ray']) cdnDetected = 'Cloudflare';
      else if (server.includes('cloudfront') || via.includes('cloudfront')) cdnDetected = 'CloudFront';
      else if (server.includes('fastly') || req.headers['x-fastly-request-id']) cdnDetected = 'Fastly';
      else if (server.includes('vercel') || req.headers['x-vercel-id']) cdnDetected = 'Vercel Edge';
      else if (server.includes('netlify')) cdnDetected = 'Netlify';
      else if (via.includes('akamai') || server.includes('akamai')) cdnDetected = 'Akamai';
      else if (cdn) cdnDetected = cdn;
    }
  }

  return { immutableAssets, noCacheAssets, cdnDetected };
}

/**
 * Take a screenshot and save to disk. Returns the filename (not base64).
 * Screenshots are served via /screenshots/:filename by the Express static middleware.
 */
async function _takeScreenshot(page, domain) {
  try {
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
    const filename = `${domain.replace(/[^a-z0-9.-]/gi, '_')}-${Date.now()}.png`;
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, filename), buffer);
    return `/screenshots/${filename}`;
  } catch {
    return null;
  }
}

// ── Median Computation ───────────────────────────────────────────────────────

function _computeMedianVitals(runs) {
  const vitalNames = ['lcp', 'fcp', 'cls', 'ttfb', 'tbt'];
  const result = {};

  for (const name of vitalNames) {
    const values = runs
      .map(r => r.vitals[name])
      .filter(v => v !== null && v !== undefined)
      .sort((a, b) => a - b);

    const median = values.length > 0 ? values[Math.floor(values.length / 2)] : null;

    result[name] = {
      values,
      median,
      rating: median !== null ? _rateMetric(name, median) : 'unknown',
    };
  }

  // INP is null (synthetic measurement limitation)
  result.inp = { values: [], median: null, rating: 'unknown' };

  return result;
}

function _rateMetric(name, value) {
  const thresholds = {
    lcp:  { good: 2500, poor: 4000 },
    fcp:  { good: 1800, poor: 3000 },
    cls:  { good: 0.1,  poor: 0.25 },
    ttfb: { good: 800,  poor: 1800 },
    inp:  { good: 200,  poor: 500 },
    tbt:  { good: 200,  poor: 600 },
  };

  const t = thresholds[name];
  if (!t) return 'unknown';
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

function _extractDomain(url) {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

module.exports = { collectPerformanceData, _rateMetric, _extractDomain };
