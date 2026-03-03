const { v4: uuidv4 } = require('uuid');

/**
 * Source Audit Tests
 * - JS instrumentation check
 * - Meta tag & SEO audit
 * - Console error capture
 */

const TRACKER_DOMAINS = [
  'google-analytics.com', 'googletagmanager.com', 'clarity.ms',
  'hotjar.com', 'facebook.net', 'doubleclick.net', 'analytics',
  'segment.com', 'mixpanel.com', 'amplitude.com', 'heap.io',
  'fullstory.com', 'mouseflow.com', 'crazyegg.com', 'inspectlet.com'
];

async function runSrcJs(page, url, options, broadcast, orchestrator) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Analyzing JavaScript instrumentation...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const pageOrigin = new URL(url).origin;
    const analysis = await page.evaluate((origin, trackerDomains) => {
      const scripts = Array.from(document.querySelectorAll('script[src]'))
        .map(s => s.src)
        .filter(src => src.startsWith('http'));

      const thirdParty = scripts.filter(src => {
        try {
          return new URL(src).origin !== origin;
        } catch { return true; }
      });

      const trackers = thirdParty.filter(src =>
        trackerDomains.some(domain => src.toLowerCase().includes(domain))
      );

      // Count inline event handlers
      const inlineHandlers = document.querySelectorAll('[onclick], [onload], [onerror], [onmouseover], [onsubmit]').length;

      // Count DOM nodes
      const totalNodes = document.querySelectorAll('*').length;

      return {
        totalScripts: scripts.length,
        thirdPartyCount: thirdParty.length,
        trackerUrls: trackers,
        inlineHandlers,
        totalNodes
      };
    }, pageOrigin, TRACKER_DOMAINS);

    // Identify analytics providers
    const analyticsProviders = [...new Set(
      analysis.trackerUrls.map(src => {
        for (const domain of TRACKER_DOMAINS) {
          if (src.toLowerCase().includes(domain)) {
            return domain.replace('.com', '').replace('.ms', '').replace('.io', '');
          }
        }
        return 'other';
      })
    )];

    // Update orchestrator's sourceAudit
    if (orchestrator) {
      orchestrator.sourceAudit.thirdPartyScripts = analysis.thirdPartyCount;
      orchestrator.sourceAudit.analyticsProviders = analyticsProviders;
      orchestrator.sourceAudit.inlineEventHandlers = analysis.inlineHandlers;
      orchestrator.sourceAudit.totalDomNodes = analysis.totalNodes;
    }

    broadcast({ type: 'log', text: `Found ${analysis.thirdPartyCount} third-party scripts, ${analyticsProviders.length} analytics providers`, color: '#4ECDC4' });

    // Determine severity based on count
    let severity = 'info';
    if (analysis.thirdPartyCount > 40) severity = 'critical';
    else if (analysis.thirdPartyCount > 25) severity = 'high';
    else if (analysis.thirdPartyCount > 10) severity = 'medium';

    if (analysis.thirdPartyCount > 10) {
      bugs.push({
        id: uuidv4(),
        severity,
        title: `Excessive third-party scripts (${analysis.thirdPartyCount})`,
        category: 'View Source & Code Audit',
        testId: 'src_js',
        description: `Page loads ${analysis.thirdPartyCount} third-party scripts which may impact performance and privacy. Analytics providers: ${analyticsProviders.join(', ')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Network tab', 'Filter by JS'],
        expected: 'Fewer than 10 third-party scripts',
        actual: `${analysis.thirdPartyCount} third-party scripts loaded`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    if (analysis.inlineHandlers > 10) {
      bugs.push({
        id: uuidv4(),
        severity: 'low',
        title: `Many inline event handlers (${analysis.inlineHandlers})`,
        category: 'View Source & Code Audit',
        testId: 'src_js',
        description: 'Page uses inline event handlers which is a security and maintainability concern',
        stepsToReproduce: ['Navigate to ' + url, 'Search source for onclick, onload, etc.'],
        expected: 'Event handlers should be attached via JavaScript',
        actual: `${analysis.inlineHandlers} inline handlers found`,
        url,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    broadcast({ type: 'log', text: `JS audit error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runSrcMeta(page, url, options, broadcast, orchestrator) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Auditing meta tags...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const meta = await page.evaluate(() => {
      const getMeta = (selector) => {
        const el = document.querySelector(selector);
        return el?.content || el?.getAttribute('content') || el?.textContent || null;
      };

      return {
        title: document.title || null,
        description: getMeta('meta[name="description"]'),
        viewport: getMeta('meta[name="viewport"]'),
        charset: document.characterSet,
        canonical: document.querySelector('link[rel="canonical"]')?.href || null,
        ogTitle: getMeta('meta[property="og:title"]'),
        ogDescription: getMeta('meta[property="og:description"]'),
        ogImage: getMeta('meta[property="og:image"]'),
        ogUrl: getMeta('meta[property="og:url"]'),
        twitterCard: getMeta('meta[name="twitter:card"]'),
        robots: getMeta('meta[name="robots"]'),
      };
    });

    const missing = [];
    if (!meta.title) missing.push('title');
    if (!meta.description) missing.push('description');
    if (!meta.viewport) missing.push('viewport');
    if (!meta.ogTitle) missing.push('og:title');
    if (!meta.ogDescription) missing.push('og:description');
    if (!meta.ogImage) missing.push('og:image');
    if (!meta.canonical) missing.push('canonical');

    if (orchestrator) {
      orchestrator.sourceAudit.missingMetaTags = missing;
    }

    if (missing.length > 0) {
      const criticalMissing = missing.filter(m => ['title', 'description', 'viewport'].includes(m));
      const severity = criticalMissing.length > 0 ? 'medium' : 'low';

      bugs.push({
        id: uuidv4(),
        severity,
        title: `Missing meta tags: ${missing.join(', ')}`,
        category: 'View Source & Code Audit',
        testId: 'src_meta',
        description: `Page is missing important meta tags for SEO and social sharing. Missing: ${missing.join(', ')}`,
        stepsToReproduce: ['Navigate to ' + url, 'View page source', 'Check <head> for meta tags'],
        expected: 'All essential meta tags should be present',
        actual: `Missing: ${missing.join(', ')}`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    broadcast({
      type: 'log',
      text: `Meta audit: ${missing.length} missing tags`,
      color: missing.length > 3 ? '#FF6B35' : (missing.length > 0 ? '#F5A623' : '#4ECDC4')
    });
  } catch (error) {
    broadcast({ type: 'log', text: `Meta audit error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runSrcConsole(page, url, options, broadcast, orchestrator, existingErrors = []) {
  const bugs = [];
  const consoleErrors = [...existingErrors];

  broadcast({ type: 'log', text: 'Capturing console errors...', color: '#4ECDC4' });

  // Set up listeners for new errors
  const errorHandler = msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  };

  const pageErrorHandler = error => {
    consoleErrors.push(`Uncaught: ${error.message}`);
  };

  page.on('console', errorHandler);
  page.on('pageerror', pageErrorHandler);

  try {
    // Navigate and wait for potential errors
    await page.goto(url, { waitUntil: 'load', timeout: (options.timeout || 30) * 1000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Click around to trigger potential errors
    const clickables = await page.$$('button, a, [role="button"]');
    for (const el of clickables.slice(0, 3)) {
      try {
        await el.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(500);
      } catch {}
    }

    if (orchestrator) {
      orchestrator.sourceAudit.consoleErrors = consoleErrors.length;
    }

    if (consoleErrors.length > 0) {
      bugs.push({
        id: uuidv4(),
        severity: consoleErrors.length > 5 ? 'high' : 'medium',
        title: `${consoleErrors.length} console error(s) detected`,
        category: 'View Source & Code Audit',
        testId: 'src_console',
        description: `JavaScript errors found in console. First few:\n${consoleErrors.slice(0, 5).join('\n')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Console', 'Observe errors'],
        expected: 'No console errors',
        actual: `${consoleErrors.length} errors found`,
        consoleOutput: consoleErrors.slice(0, 10).join('\n'),
        url,
        timestamp: new Date().toISOString()
      });
    }

    broadcast({
      type: 'log',
      text: `Captured ${consoleErrors.length} console errors`,
      color: consoleErrors.length > 0 ? '#FF6B35' : '#4ECDC4'
    });
  } catch (error) {
    broadcast({ type: 'log', text: `Console capture error: ${error.message}`, color: '#FF6B35' });
  } finally {
    page.off('console', errorHandler);
    page.off('pageerror', pageErrorHandler);
  }

  return bugs;
}

module.exports = { runSrcJs, runSrcMeta, runSrcConsole };
