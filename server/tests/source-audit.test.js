const { v4: uuidv4 } = require('uuid');

/**
 * Source Audit Tests — Comprehensive
 * - JS instrumentation, vulnerable libraries, deprecated APIs, CSP compliance
 * - Meta tag, SEO, structured data, security headers audit
 * - Console error capture across all levels with categorization
 */

const TRACKER_DOMAINS = [
  // Analytics
  'google-analytics.com', 'googletagmanager.com', 'analytics.google.com',
  'clarity.ms', 'hotjar.com', 'segment.com', 'mixpanel.com',
  'amplitude.com', 'heap.io', 'fullstory.com', 'mouseflow.com',
  'crazyegg.com', 'inspectlet.com', 'plausible.io', 'umami.is',
  'matomo.org', 'piwik.pro', 'countly.com', 'posthog.com',
  // Ads
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'facebook.net', 'fbcdn.net', 'adsrvr.org', 'amazon-adsystem.com',
  'criteo.com', 'outbrain.com', 'taboola.com', 'moat.com',
  'adnxs.com', 'pubmatic.com', 'rubiconproject.com',
  // Social Widgets
  'platform.twitter.com', 'connect.facebook.net', 'platform.linkedin.com',
  'platform.instagram.com', 'widgets.pinterest.com', 'disqus.com',
  // A/B Testing
  'optimizely.com', 'abtasty.com', 'vwo.com', 'launchdarkly.com',
  'split.io', 'statsig.com',
  // Chat Widgets
  'intercom.io', 'drift.com', 'zendesk.com', 'crisp.chat',
  'tawk.to', 'livechatinc.com', 'tidio.co',
  // Error Tracking
  'sentry.io', 'bugsnag.com', 'rollbar.com', 'logrocket.com',
  'datadoghq.com', 'newrelic.com', 'raygun.com',
  // CDN / Fonts
  'cdnjs.cloudflare.com', 'jsdelivr.net', 'unpkg.com',
  'fonts.googleapis.com', 'fonts.gstatic.com', 'use.typekit.net',
];

const SCRIPT_CATEGORIES = {
  analytics: ['google-analytics', 'googletagmanager', 'clarity.ms', 'hotjar', 'segment', 'mixpanel', 'amplitude', 'heap.io', 'fullstory', 'mouseflow', 'crazyegg', 'inspectlet', 'plausible', 'umami', 'matomo', 'piwik', 'countly', 'posthog', 'analytics'],
  ads: ['doubleclick', 'googlesyndication', 'googleadservices', 'facebook.net', 'adsrvr', 'amazon-adsystem', 'criteo', 'outbrain', 'taboola', 'moat', 'adnxs', 'pubmatic', 'rubiconproject'],
  social: ['platform.twitter', 'connect.facebook', 'platform.linkedin', 'platform.instagram', 'widgets.pinterest', 'disqus'],
  abTesting: ['optimizely', 'abtasty', 'vwo.com', 'launchdarkly', 'split.io', 'statsig'],
  chat: ['intercom', 'drift.com', 'zendesk', 'crisp.chat', 'tawk.to', 'livechatinc', 'tidio'],
  errorTracking: ['sentry', 'bugsnag', 'rollbar', 'logrocket', 'datadoghq', 'newrelic', 'raygun'],
  cdn: ['cdnjs.cloudflare', 'jsdelivr', 'unpkg'],
  fonts: ['fonts.googleapis', 'fonts.gstatic', 'typekit'],
};

const VULNERABLE_LIBRARIES = [
  { pattern: /jquery[\/\-.]([0-2]\.\d|3\.[0-4]\.)/, name: 'jQuery < 3.5', severity: 'high' },
  { pattern: /lodash[\/\-.]([0-3]\.\d|4\.(0|1[0-6]|17\.([0-9]|1\d|20)))/, name: 'Lodash < 4.17.21', severity: 'medium' },
  { pattern: /moment[\/\-.]/, name: 'Moment.js (deprecated)', severity: 'low' },
  { pattern: /angular[\/\-.]1\./, name: 'AngularJS 1.x (end-of-life)', severity: 'high' },
  { pattern: /bootstrap[\/\-.]([0-3]\.\d|4\.[0-5]\.)/, name: 'Bootstrap < 4.6', severity: 'low' },
  { pattern: /handlebars[\/\-.]([0-3]\.\d|4\.[0-6]\.)/, name: 'Handlebars < 4.7', severity: 'medium' },
];

const API_KEY_PATTERNS = [
  { pattern: /sk_live_[a-zA-Z0-9]{20,}/, name: 'Stripe live secret key' },
  { pattern: /sk_test_[a-zA-Z0-9]{20,}/, name: 'Stripe test secret key' },
  { pattern: /pk_live_[a-zA-Z0-9]{20,}/, name: 'Stripe live publishable key' },
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key ID' },
  { pattern: /AIza[0-9A-Za-z\-_]{35}/, name: 'Google API Key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub Personal Access Token' },
  { pattern: /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/, name: 'Generic API key' },
  { pattern: /token\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/, name: 'Generic token' },
  { pattern: /auth\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/, name: 'Generic auth credential' },
  { pattern: /firebase[a-zA-Z]*\s*[:=]\s*['"][a-zA-Z0-9\-_.]{20,}['"]/, name: 'Firebase credential' },
];

async function runSrcJs(page, url, options, broadcast, orchestrator) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Analyzing JavaScript instrumentation (comprehensive)...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const pageOrigin = new URL(url).origin;
    const isHTTPS = url.startsWith('https');

    // ─── Core Script Analysis ───
    const analysis = await page.evaluate(({ origin, trackerDomains, scriptCategories }) => {
      const allScriptEls = Array.from(document.querySelectorAll('script'));
      const externalScripts = allScriptEls
        .filter(s => s.src && s.src.startsWith('http'))
        .map(s => ({
          src: s.src,
          async: s.async,
          defer: s.defer,
          type: s.type || 'classic',
          nonce: s.nonce || null,
          inHead: s.closest('head') !== null,
          isModule: s.type === 'module',
        }));

      const inlineScripts = allScriptEls
        .filter(s => !s.src)
        .map(s => ({
          length: (s.textContent || '').length,
          nonce: s.nonce || null,
          hasHash: false, // Would require CSP header parsing
          type: s.type || 'classic',
          isModule: s.type === 'module',
          content: (s.textContent || '').slice(0, 2000),
        }));

      const thirdParty = externalScripts.filter(s => {
        try { return new URL(s.src).origin !== origin; } catch { return true; }
      });

      const trackers = thirdParty.filter(s =>
        trackerDomains.some(domain => s.src.toLowerCase().includes(domain))
      );

      // Categorize third-party scripts
      const categorized = {};
      for (const [category, patterns] of Object.entries(scriptCategories)) {
        categorized[category] = thirdParty.filter(s =>
          patterns.some(p => s.src.toLowerCase().includes(p))
        ).length;
      }

      // Inline event handlers
      const handlerAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onsubmit', 'onchange', 'onfocus', 'onblur', 'onkeydown', 'onkeyup', 'onkeypress', 'onscroll', 'onresize', 'ontouchstart', 'ondrag'];
      const inlineHandlerSelector = handlerAttrs.map(a => `[${a}]`).join(', ');
      const inlineHandlers = document.querySelectorAll(inlineHandlerSelector).length;

      // DOM stats
      const totalNodes = document.querySelectorAll('*').length;

      // Deprecated APIs in inline scripts
      const deprecatedAPIs = [];
      const allInlineCode = inlineScripts.map(s => s.content).join('\n');
      if (/document\.write\s*\(/.test(allInlineCode)) deprecatedAPIs.push('document.write');
      if (/\beval\s*\(/.test(allInlineCode)) deprecatedAPIs.push('eval()');
      if (/\bwith\s*\(/.test(allInlineCode)) deprecatedAPIs.push('with statement');
      if (/__proto__/.test(allInlineCode)) deprecatedAPIs.push('__proto__ access');

      // Sync scripts in head (no async/defer)
      const syncHeadScripts = externalScripts.filter(s => s.inHead && !s.async && !s.defer);

      // HTTP scripts on HTTPS page
      const httpScripts = externalScripts.filter(s => s.src.startsWith('http://'));

      // Module vs classic
      const moduleScripts = allScriptEls.filter(s => s.type === 'module').length;
      const classicScripts = allScriptEls.filter(s => s.type !== 'module').length;

      // Inline scripts without nonce
      const inlineWithoutNonce = inlineScripts.filter(s => !s.nonce);

      // Service Worker
      let hasServiceWorker = false;
      try { hasServiceWorker = !!navigator.serviceWorker; } catch {}

      // Error handler check
      const hasGlobalErrorHandler = typeof window.onerror === 'function' || false;

      // Global variable pollution check
      const defaultGlobals = new Set([
        'undefined', 'NaN', 'Infinity', 'eval', 'isFinite', 'isNaN', 'parseFloat',
        'parseInt', 'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent',
        'Array', 'Boolean', 'Date', 'Error', 'Function', 'JSON', 'Math', 'Number',
        'Object', 'RegExp', 'String', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol',
        'Promise', 'Proxy', 'Reflect', 'ArrayBuffer', 'DataView', 'Float32Array',
        'Float64Array', 'Int8Array', 'Int16Array', 'Int32Array', 'Uint8Array',
        'Uint16Array', 'Uint32Array',
      ]);
      let customGlobals = 0;
      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        const cleanWindow = iframe.contentWindow;
        const cleanKeys = new Set(Object.keys(cleanWindow));
        const currentKeys = Object.keys(window);
        customGlobals = currentKeys.filter(k => !cleanKeys.has(k)).length;
        iframe.remove();
      } catch {
        customGlobals = -1;
      }

      return {
        totalScripts: externalScripts.length,
        inlineScriptCount: inlineScripts.length,
        thirdPartyCount: thirdParty.length,
        thirdPartySrcs: thirdParty.map(s => s.src),
        trackerUrls: trackers.map(s => s.src),
        categorized,
        inlineHandlers,
        totalNodes,
        deprecatedAPIs,
        syncHeadScripts: syncHeadScripts.length,
        syncHeadScriptUrls: syncHeadScripts.map(s => s.src).slice(0, 10),
        httpScripts: httpScripts.map(s => s.src),
        moduleScripts,
        classicScripts,
        inlineWithoutNonce: inlineWithoutNonce.length,
        hasServiceWorker,
        hasGlobalErrorHandler,
        customGlobals,
      };
    }, { origin: pageOrigin, trackerDomains: TRACKER_DOMAINS, scriptCategories: SCRIPT_CATEGORIES });

    // Identify analytics providers
    const analyticsProviders = [...new Set(
      analysis.trackerUrls.map(src => {
        for (const domain of TRACKER_DOMAINS) {
          if (src.toLowerCase().includes(domain)) {
            return domain.replace(/\.(com|ms|io|net|org|pro|chat|to|co)$/, '');
          }
        }
        return 'other';
      })
    )];

    // Update orchestrator
    if (orchestrator) {
      orchestrator.sourceAudit.thirdPartyScripts = analysis.thirdPartyCount;
      orchestrator.sourceAudit.analyticsProviders = analyticsProviders;
      orchestrator.sourceAudit.inlineEventHandlers = analysis.inlineHandlers;
      orchestrator.sourceAudit.totalDomNodes = analysis.totalNodes;
      orchestrator.sourceAudit.scriptCategories = analysis.categorized;
      orchestrator.sourceAudit.deprecatedAPIs = analysis.deprecatedAPIs;
      orchestrator.sourceAudit.syncHeadScripts = analysis.syncHeadScripts;
      orchestrator.sourceAudit.moduleScripts = analysis.moduleScripts;
      orchestrator.sourceAudit.customGlobals = analysis.customGlobals;
    }

    broadcast({ type: 'log', text: `Found ${analysis.thirdPartyCount} third-party scripts, ${analyticsProviders.length} analytics provider(s)`, color: '#4ECDC4' });

    // ─── Bug: Excessive third-party scripts ───
    if (analysis.thirdPartyCount > 10) {
      let severity = 'info';
      if (analysis.thirdPartyCount > 40) severity = 'critical';
      else if (analysis.thirdPartyCount > 25) severity = 'high';
      else if (analysis.thirdPartyCount > 10) severity = 'medium';

      const categoryBreakdown = Object.entries(analysis.categorized)
        .filter(([, count]) => count > 0)
        .map(([cat, count]) => `${cat}: ${count}`)
        .join(', ');

      bugs.push({
        id: uuidv4(),
        severity,
        title: `Excessive third-party scripts (${analysis.thirdPartyCount})`,
        category: 'View Source & Code Audit',
        testId: 'src_js',
        description: `Page loads ${analysis.thirdPartyCount} third-party scripts. Breakdown: ${categoryBreakdown || 'uncategorized'}. Analytics providers: ${analyticsProviders.join(', ') || 'none'}`,
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Network tab', 'Filter by JS'],
        expected: 'Fewer than 10 third-party scripts for optimal performance',
        actual: `${analysis.thirdPartyCount} third-party scripts loaded`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: Inline event handlers ───
    if (analysis.inlineHandlers > 10) {
      bugs.push({
        id: uuidv4(),
        severity: 'low',
        title: `Many inline event handlers (${analysis.inlineHandlers})`,
        category: 'View Source & Code Audit',
        testId: 'src_js',
        description: 'Page uses inline event handlers (onclick, onload, etc.) which is a security and maintainability concern and violates CSP best practices',
        stepsToReproduce: ['Navigate to ' + url, 'Search source for onclick, onload, etc.'],
        expected: 'Event handlers attached via JavaScript, not inline attributes',
        actual: `${analysis.inlineHandlers} inline handlers found`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: Deprecated APIs ───
    if (analysis.deprecatedAPIs.length > 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: `Deprecated JavaScript APIs detected: ${analysis.deprecatedAPIs.join(', ')}`,
        category: 'View Source & Code Audit',
        testId: 'src_js_deprecated',
        description: `Inline scripts use deprecated or dangerous JavaScript APIs: ${analysis.deprecatedAPIs.join(', ')}. These pose security risks and performance issues.`,
        stepsToReproduce: ['Navigate to ' + url, 'View page source', 'Search for deprecated API calls'],
        expected: 'Modern, safe API alternatives should be used',
        actual: `Found: ${analysis.deprecatedAPIs.join(', ')}`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: Synchronous scripts in head ───
    if (analysis.syncHeadScripts > 0) {
      bugs.push({
        id: uuidv4(),
        severity: analysis.syncHeadScripts > 5 ? 'high' : 'medium',
        title: `${analysis.syncHeadScripts} render-blocking script(s) in <head>`,
        category: 'View Source & Code Audit',
        testId: 'src_js_sync',
        description: `${analysis.syncHeadScripts} external script(s) in <head> lack async/defer attributes, blocking page rendering. URLs: ${analysis.syncHeadScriptUrls.slice(0, 5).join(', ')}`,
        stepsToReproduce: ['Navigate to ' + url, 'View source', 'Check <head> for <script> tags without async or defer'],
        expected: 'External scripts in <head> should use async or defer',
        actual: `${analysis.syncHeadScripts} synchronous scripts in <head>`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: HTTP scripts on HTTPS page ───
    if (isHTTPS && analysis.httpScripts.length > 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'high',
        title: `Mixed content: ${analysis.httpScripts.length} HTTP script(s) on HTTPS page`,
        category: 'View Source & Code Audit',
        testId: 'src_js_mixed',
        description: `HTTPS page loads scripts over insecure HTTP: ${analysis.httpScripts.slice(0, 5).join(', ')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Console', 'Look for mixed content warnings'],
        expected: 'All scripts should be loaded over HTTPS',
        actual: `${analysis.httpScripts.length} script(s) loaded via HTTP`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: Excessive global variables ───
    if (analysis.customGlobals > 50) {
      bugs.push({
        id: uuidv4(),
        severity: 'low',
        title: `Excessive global variable pollution (${analysis.customGlobals} custom globals)`,
        category: 'View Source & Code Audit',
        testId: 'src_js_globals',
        description: `Scripts have added ${analysis.customGlobals} properties to the window object beyond browser defaults, risking naming collisions`,
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Console', 'Compare window properties to a clean page'],
        expected: 'Minimal global variable usage; use modules or closures',
        actual: `${analysis.customGlobals} custom global variables detected`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: No global error handler ───
    if (!analysis.hasGlobalErrorHandler) {
      bugs.push({
        id: uuidv4(),
        severity: 'info',
        title: 'No global JavaScript error handler detected',
        category: 'View Source & Code Audit',
        testId: 'src_js_errorhandler',
        description: 'Page does not have a window.onerror or addEventListener("error") handler for catching unhandled JavaScript errors',
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Console', 'Check for window.onerror'],
        expected: 'Global error handler should catch and report unhandled errors',
        actual: 'No global error handler found',
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: Inline scripts without nonce (CSP) ───
    if (analysis.inlineWithoutNonce > 0 && analysis.inlineScriptCount > 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'info',
        title: `${analysis.inlineWithoutNonce} inline script(s) without CSP nonce`,
        category: 'View Source & Code Audit',
        testId: 'src_js_csp',
        description: `${analysis.inlineWithoutNonce} of ${analysis.inlineScriptCount} inline scripts lack a nonce attribute, which may violate Content Security Policy`,
        stepsToReproduce: ['Navigate to ' + url, 'View source', 'Check inline <script> tags for nonce attributes'],
        expected: 'Inline scripts should have nonce attributes for CSP compliance',
        actual: `${analysis.inlineWithoutNonce} inline scripts without nonce`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Check for vulnerable libraries ───
    broadcast({ type: 'log', text: 'Checking for known vulnerable JavaScript libraries...', color: '#4ECDC4' });
    const allScriptUrls = analysis.thirdPartySrcs.join(' ');
    for (const lib of VULNERABLE_LIBRARIES) {
      if (lib.pattern.test(allScriptUrls)) {
        bugs.push({
          id: uuidv4(),
          severity: lib.severity,
          title: `Potentially vulnerable library: ${lib.name}`,
          category: 'View Source & Code Audit',
          testId: 'src_js_vuln',
          description: `The page loads ${lib.name}, which may have known security vulnerabilities`,
          stepsToReproduce: ['Navigate to ' + url, 'Check Network tab for library files'],
          expected: 'Use latest, patched versions of JavaScript libraries',
          actual: `${lib.name} detected`,
          url,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Also check via page.evaluate for library globals
    const libCheck = await page.evaluate(() => {
      const results = [];
      if (window.jQuery) {
        const ver = window.jQuery.fn?.jquery || 'unknown';
        results.push({ name: 'jQuery', version: ver });
      }
      if (window._) {
        const ver = window._.VERSION || 'unknown';
        results.push({ name: 'Lodash/Underscore', version: ver });
      }
      if (window.moment) {
        const ver = window.moment.version || 'unknown';
        results.push({ name: 'Moment.js', version: ver });
      }
      if (window.angular) {
        const ver = window.angular.version?.full || 'unknown';
        results.push({ name: 'AngularJS', version: ver });
      }
      return results;
    }).catch(() => []);

    for (const lib of libCheck) {
      const isVulnerable =
        (lib.name === 'jQuery' && lib.version < '3.5') ||
        (lib.name === 'Moment.js') ||
        (lib.name === 'AngularJS');

      if (isVulnerable) {
        bugs.push({
          id: uuidv4(),
          severity: lib.name === 'Moment.js' ? 'low' : 'high',
          title: `${lib.name} ${lib.version} detected (potentially vulnerable)`,
          category: 'View Source & Code Audit',
          testId: 'src_js_vuln',
          description: `${lib.name} version ${lib.version} is loaded globally. ${lib.name === 'Moment.js' ? 'Moment.js is deprecated; consider alternatives like date-fns or Luxon.' : 'This version may have known vulnerabilities.'}`,
          stepsToReproduce: ['Navigate to ' + url, 'Open Console', `Type window.${lib.name === 'jQuery' ? 'jQuery.fn.jquery' : lib.name.toLowerCase() + '.version'}`],
          expected: 'Latest patched version or modern alternative',
          actual: `${lib.name} ${lib.version}`,
          url,
          timestamp: new Date().toISOString()
        });
      }
    }

    // ─── Check for exposed source maps ───
    broadcast({ type: 'log', text: 'Checking for exposed source maps...', color: '#4ECDC4' });
    try {
      const sourceMapUrls = analysis.thirdPartySrcs
        .filter(src => !src.includes('cdn'))
        .slice(0, 5)
        .map(src => src + '.map');

      for (const mapUrl of sourceMapUrls) {
        try {
          const response = await page.evaluate(async (u) => {
            try {
              const res = await fetch(u, { method: 'HEAD' });
              return { status: res.status, ok: res.ok };
            } catch { return null; }
          }, mapUrl);

          if (response && response.ok) {
            bugs.push({
              id: uuidv4(),
              severity: 'medium',
              title: 'Exposed JavaScript source map file',
              category: 'View Source & Code Audit',
              testId: 'src_js_sourcemap',
              description: `Source map file is publicly accessible: ${mapUrl}. This exposes original source code.`,
              stepsToReproduce: ['Navigate to ' + mapUrl],
              expected: 'Source maps should not be publicly accessible in production',
              actual: 'Source map file returned HTTP 200',
              url,
              timestamp: new Date().toISOString()
            });
            break; // One is enough
          }
        } catch {
          // continue
        }
      }
    } catch {
      // Non-critical
    }

    // ─── Check for exposed API keys ───
    broadcast({ type: 'log', text: 'Scanning for exposed API keys/tokens...', color: '#4ECDC4' });
    try {
      const pageSource = await page.content();
      for (const { pattern, name } of API_KEY_PATTERNS) {
        if (pattern.test(pageSource)) {
          bugs.push({
            id: uuidv4(),
            severity: 'critical',
            title: `Exposed credential: ${name}`,
            category: 'View Source & Code Audit',
            testId: 'src_js_secrets',
            description: `A pattern matching "${name}" was found in the page source. This may expose sensitive credentials.`,
            stepsToReproduce: ['Navigate to ' + url, 'View page source', `Search for pattern: ${pattern.source.slice(0, 30)}`],
            expected: 'API keys and tokens should never be exposed in client-side code',
            actual: `${name} pattern detected in page source`,
            url,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch {
      // Non-critical
    }

    // ─── Check for Service Worker ───
    try {
      const swRegistration = await page.evaluate(async () => {
        if (!navigator.serviceWorker) return null;
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.map(r => r.active?.scriptURL || r.installing?.scriptURL || 'unknown');
      }).catch(() => null);

      if (orchestrator && swRegistration) {
        orchestrator.sourceAudit.serviceWorkers = swRegistration;
      }

      if (swRegistration && swRegistration.length > 0) {
        broadcast({ type: 'log', text: `Service Worker(s) detected: ${swRegistration.join(', ')}`, color: '#4ECDC4' });
      }
    } catch {
      // Non-critical
    }

    // ─── Estimate total JS size ───
    try {
      const jsSize = await page.evaluate(async ({ origin }) => {
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        let totalEstimated = 0;
        for (const s of scripts) {
          try {
            const resp = await fetch(s.src, { method: 'HEAD' });
            const len = parseInt(resp.headers.get('content-length') || '0', 10);
            totalEstimated += len;
          } catch {
            // skip CORS-blocked
          }
        }
        // Add inline script sizes
        const inlineSize = Array.from(document.querySelectorAll('script:not([src])'))
          .reduce((sum, s) => sum + (s.textContent || '').length, 0);
        return { external: totalEstimated, inline: inlineSize, total: totalEstimated + inlineSize };
      }, { origin: pageOrigin }).catch(() => null);

      if (jsSize && jsSize.total > 0) {
        const totalKB = Math.round(jsSize.total / 1024);
        if (orchestrator) {
          orchestrator.sourceAudit.totalJsSize = totalKB;
        }

        if (totalKB > 1000) {
          bugs.push({
            id: uuidv4(),
            severity: totalKB > 3000 ? 'high' : 'medium',
            title: `Large total JavaScript size: ${totalKB} KB`,
            category: 'View Source & Code Audit',
            testId: 'src_js_size',
            description: `Total JavaScript on the page is approximately ${totalKB} KB (external: ${Math.round(jsSize.external / 1024)} KB, inline: ${Math.round(jsSize.inline / 1024)} KB). This impacts load time and parse cost.`,
            stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Network tab', 'Filter by JS and check total size'],
            expected: 'Total JS under 500 KB for optimal performance',
            actual: `~${totalKB} KB of JavaScript`,
            url,
            timestamp: new Date().toISOString()
          });
        }

        broadcast({ type: 'log', text: `Total JS size: ~${totalKB} KB`, color: '#4ECDC4' });
      }
    } catch {
      // Non-critical
    }

    broadcast({ type: 'log', text: `JS audit complete — ${bugs.length} issue(s) found`, color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `JS audit error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runSrcMeta(page, url, options, broadcast, orchestrator) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Auditing meta tags and SEO (comprehensive)...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    // ─── Comprehensive Meta & SEO Analysis ───
    const meta = await page.evaluate(() => {
      const getMeta = (selector) => {
        const el = document.querySelector(selector);
        return el?.content || el?.getAttribute('content') || el?.textContent || null;
      };

      const getMetaAll = (selector) => {
        return Array.from(document.querySelectorAll(selector)).map(el =>
          el.content || el.getAttribute('content') || el.textContent || null
        );
      };

      const getLink = (rel) => {
        const el = document.querySelector(`link[rel="${rel}"]`);
        return el?.href || el?.getAttribute('href') || null;
      };

      // Heading hierarchy
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
        level: parseInt(h.tagName.slice(1)),
        text: h.textContent.trim().slice(0, 100),
      }));

      const h1Count = headings.filter(h => h.level === 1).length;
      const headingLevels = headings.map(h => h.level);
      const skippedLevels = [];
      for (let i = 1; i < headingLevels.length; i++) {
        const diff = headingLevels[i] - headingLevels[i - 1];
        if (diff > 1) {
          skippedLevels.push(`H${headingLevels[i - 1]} -> H${headingLevels[i]}`);
        }
      }

      // Structured data
      const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => {
        try { return JSON.parse(s.textContent); } catch { return null; }
      }).filter(Boolean);

      const hasMicrodata = document.querySelector('[itemscope]') !== null;
      const hasRdfa = document.querySelector('[typeof], [property]:not(meta[property])') !== null;

      // Favicons
      const favicons = Array.from(document.querySelectorAll('link[rel*="icon"]')).map(l => ({
        rel: l.rel,
        href: l.href,
        type: l.type || null,
        sizes: l.sizes?.toString() || null,
      }));
      const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');

      // Duplicate meta tags
      const allMetas = Array.from(document.querySelectorAll('meta[name], meta[property]'));
      const metaCounts = {};
      allMetas.forEach(m => {
        const key = m.name || m.getAttribute('property');
        metaCounts[key] = (metaCounts[key] || 0) + 1;
      });
      const duplicates = Object.entries(metaCounts).filter(([, count]) => count > 1).map(([name]) => name);

      return {
        // Basic
        title: document.title || null,
        titleLength: (document.title || '').length,
        description: getMeta('meta[name="description"]'),
        descriptionLength: (getMeta('meta[name="description"]') || '').length,
        viewport: getMeta('meta[name="viewport"]'),
        charset: document.characterSet,
        // Canonical
        canonical: getLink('canonical'),
        currentUrl: window.location.href,
        // Open Graph
        ogTitle: getMeta('meta[property="og:title"]'),
        ogDescription: getMeta('meta[property="og:description"]'),
        ogImage: getMeta('meta[property="og:image"]'),
        ogUrl: getMeta('meta[property="og:url"]'),
        ogType: getMeta('meta[property="og:type"]'),
        ogSiteName: getMeta('meta[property="og:site_name"]'),
        ogLocale: getMeta('meta[property="og:locale"]'),
        // Twitter
        twitterCard: getMeta('meta[name="twitter:card"]'),
        twitterSite: getMeta('meta[name="twitter:site"]'),
        twitterCreator: getMeta('meta[name="twitter:creator"]'),
        twitterImage: getMeta('meta[name="twitter:image"]'),
        // Robots
        robots: getMeta('meta[name="robots"]'),
        googlebot: getMeta('meta[name="googlebot"]'),
        // i18n
        hreflang: Array.from(document.querySelectorAll('link[hreflang]')).map(l => ({
          lang: l.hreflang, href: l.href
        })),
        htmlLang: document.documentElement.lang || null,
        // Manifest & Theme
        manifest: getLink('manifest'),
        themeColor: getMeta('meta[name="theme-color"]'),
        // Mobile
        appleMobileWebAppCapable: getMeta('meta[name="apple-mobile-web-app-capable"]'),
        mobileWebAppCapable: getMeta('meta[name="mobile-web-app-capable"]'),
        // Headings
        h1Count,
        skippedLevels,
        headings: headings.slice(0, 20),
        // Structured Data
        jsonLdSchemas: jsonLd.map(d => d['@type'] || 'unknown'),
        hasMicrodata,
        hasRdfa,
        structuredDataCount: jsonLd.length + (hasMicrodata ? 1 : 0) + (hasRdfa ? 1 : 0),
        // Favicons
        faviconCount: favicons.length,
        hasAppleTouchIcon: !!appleTouchIcon,
        // Duplicates
        duplicateMetaTags: duplicates,
      };
    });

    // ─── Missing Essential Meta Tags ───
    const missing = [];
    if (!meta.title) missing.push('title');
    if (!meta.description) missing.push('description');
    if (!meta.viewport) missing.push('viewport');
    if (!meta.ogTitle) missing.push('og:title');
    if (!meta.ogDescription) missing.push('og:description');
    if (!meta.ogImage) missing.push('og:image');
    if (!meta.ogUrl) missing.push('og:url');
    if (!meta.ogType) missing.push('og:type');
    if (!meta.ogSiteName) missing.push('og:site_name');
    if (!meta.canonical) missing.push('canonical');
    if (!meta.twitterCard) missing.push('twitter:card');
    if (!meta.twitterSite) missing.push('twitter:site');

    if (orchestrator) {
      orchestrator.sourceAudit.missingMetaTags = missing;
      orchestrator.sourceAudit.structuredData = meta.jsonLdSchemas;
      orchestrator.sourceAudit.headingHierarchy = { h1Count: meta.h1Count, skipped: meta.skippedLevels };
    }

    if (missing.length > 0) {
      const criticalMissing = missing.filter(m => ['title', 'description', 'viewport'].includes(m));
      const severity = criticalMissing.length > 0 ? 'medium' : 'low';

      bugs.push({
        id: uuidv4(),
        severity,
        title: `Missing ${missing.length} meta tag(s): ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '...' : ''}`,
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

    // ─── Title Length Check ───
    if (meta.title) {
      if (meta.titleLength < 30) {
        bugs.push({
          id: uuidv4(),
          severity: 'low',
          title: `Page title too short (${meta.titleLength} chars)`,
          category: 'View Source & Code Audit',
          testId: 'src_meta_title',
          description: `Title "${meta.title}" is only ${meta.titleLength} characters. Short titles may not be descriptive enough for SEO.`,
          stepsToReproduce: ['Navigate to ' + url, 'Check document.title'],
          expected: 'Title should be 30-60 characters',
          actual: `${meta.titleLength} characters`,
          url,
          timestamp: new Date().toISOString()
        });
      } else if (meta.titleLength > 60) {
        bugs.push({
          id: uuidv4(),
          severity: 'low',
          title: `Page title too long (${meta.titleLength} chars)`,
          category: 'View Source & Code Audit',
          testId: 'src_meta_title',
          description: `Title is ${meta.titleLength} characters. Long titles get truncated in search results.`,
          stepsToReproduce: ['Navigate to ' + url, 'Check document.title'],
          expected: 'Title should be 30-60 characters',
          actual: `${meta.titleLength} characters`,
          url,
          timestamp: new Date().toISOString()
        });
      }
    }

    // ─── Description Length Check ───
    if (meta.description) {
      if (meta.descriptionLength < 70) {
        bugs.push({
          id: uuidv4(),
          severity: 'low',
          title: `Meta description too short (${meta.descriptionLength} chars)`,
          category: 'View Source & Code Audit',
          testId: 'src_meta_desc',
          description: `Meta description is only ${meta.descriptionLength} characters. Short descriptions miss SEO opportunities.`,
          stepsToReproduce: ['Navigate to ' + url, 'Check meta[name="description"]'],
          expected: 'Description should be 70-160 characters',
          actual: `${meta.descriptionLength} characters`,
          url,
          timestamp: new Date().toISOString()
        });
      } else if (meta.descriptionLength > 160) {
        bugs.push({
          id: uuidv4(),
          severity: 'low',
          title: `Meta description too long (${meta.descriptionLength} chars)`,
          category: 'View Source & Code Audit',
          testId: 'src_meta_desc',
          description: `Meta description is ${meta.descriptionLength} characters. Long descriptions get truncated in search results.`,
          stepsToReproduce: ['Navigate to ' + url, 'Check meta[name="description"]'],
          expected: 'Description should be 70-160 characters',
          actual: `${meta.descriptionLength} characters`,
          url,
          timestamp: new Date().toISOString()
        });
      }
    }

    // ─── Heading Hierarchy ───
    if (meta.h1Count === 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: 'No H1 heading found on page',
        category: 'View Source & Code Audit',
        testId: 'src_meta_headings',
        description: 'Page does not contain an H1 heading, which is important for SEO and document structure',
        stepsToReproduce: ['Navigate to ' + url, 'Search for <h1> in source'],
        expected: 'Page should have exactly one H1 heading',
        actual: 'No H1 heading found',
        url,
        timestamp: new Date().toISOString()
      });
    } else if (meta.h1Count > 1) {
      bugs.push({
        id: uuidv4(),
        severity: 'low',
        title: `Multiple H1 headings (${meta.h1Count})`,
        category: 'View Source & Code Audit',
        testId: 'src_meta_headings',
        description: `Page has ${meta.h1Count} H1 headings. Best practice is one H1 per page.`,
        stepsToReproduce: ['Navigate to ' + url, 'Search for <h1> in source'],
        expected: 'Exactly one H1 heading per page',
        actual: `${meta.h1Count} H1 headings`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    if (meta.skippedLevels.length > 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'low',
        title: `Skipped heading levels: ${meta.skippedLevels.join(', ')}`,
        category: 'View Source & Code Audit',
        testId: 'src_meta_headings',
        description: `Heading hierarchy has gaps: ${meta.skippedLevels.join(', ')}. This hurts accessibility and SEO.`,
        stepsToReproduce: ['Navigate to ' + url, 'Inspect heading hierarchy'],
        expected: 'Sequential heading levels without gaps (H1 > H2 > H3)',
        actual: `Skipped: ${meta.skippedLevels.join(', ')}`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Canonical URL Validation ───
    if (meta.canonical) {
      const isAbsolute = meta.canonical.startsWith('http');
      const matchesCurrent = meta.canonical === meta.currentUrl ||
        meta.canonical === meta.currentUrl.replace(/\/$/, '') ||
        meta.canonical + '/' === meta.currentUrl;

      if (!isAbsolute) {
        bugs.push({
          id: uuidv4(),
          severity: 'medium',
          title: 'Canonical URL is not absolute',
          category: 'View Source & Code Audit',
          testId: 'src_meta_canonical',
          description: `Canonical URL "${meta.canonical}" is relative. Canonical URLs should be absolute.`,
          stepsToReproduce: ['Navigate to ' + url, 'Check link[rel="canonical"]'],
          expected: 'Canonical URL should be an absolute URL (starting with https://)',
          actual: `Relative canonical: ${meta.canonical}`,
          url,
          timestamp: new Date().toISOString()
        });
      }

      if (!matchesCurrent && isAbsolute) {
        bugs.push({
          id: uuidv4(),
          severity: 'info',
          title: 'Canonical URL differs from current URL',
          category: 'View Source & Code Audit',
          testId: 'src_meta_canonical',
          description: `Canonical URL "${meta.canonical}" does not match the current page URL "${meta.currentUrl}". This may be intentional but could affect SEO.`,
          stepsToReproduce: ['Navigate to ' + url, 'Compare canonical to address bar'],
          expected: 'Canonical should match the current URL unless intentional redirect',
          actual: `Canonical: ${meta.canonical}, Current: ${meta.currentUrl}`,
          url,
          timestamp: new Date().toISOString()
        });
      }
    }

    // ─── Robots Meta ───
    if (meta.robots) {
      const robotsLower = meta.robots.toLowerCase();
      if (robotsLower.includes('noindex')) {
        bugs.push({
          id: uuidv4(),
          severity: 'high',
          title: 'Page has noindex directive — will not be indexed',
          category: 'View Source & Code Audit',
          testId: 'src_meta_robots',
          description: `meta robots contains "noindex": "${meta.robots}". This page will not appear in search results.`,
          stepsToReproduce: ['Navigate to ' + url, 'Check meta[name="robots"]'],
          expected: 'Verify noindex is intentional; production pages usually should be indexed',
          actual: `robots: "${meta.robots}"`,
          url,
          timestamp: new Date().toISOString()
        });
      }
    }

    // ─── Structured Data ───
    if (meta.structuredDataCount === 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'info',
        title: 'No structured data (JSON-LD, Microdata, or RDFa)',
        category: 'View Source & Code Audit',
        testId: 'src_meta_structured',
        description: 'Page does not contain any structured data markup. Adding Schema.org markup can improve search result appearance with rich snippets.',
        stepsToReproduce: ['Navigate to ' + url, 'Search source for application/ld+json or itemscope'],
        expected: 'Structured data (JSON-LD preferred) for rich search results',
        actual: 'No structured data found',
        url,
        timestamp: new Date().toISOString()
      });
    } else {
      broadcast({ type: 'log', text: `Structured data found: ${meta.jsonLdSchemas.join(', ') || 'microdata/rdfa'}`, color: '#4ECDC4' });
    }

    // ─── Favicons ───
    if (meta.faviconCount === 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'low',
        title: 'No favicon defined',
        category: 'View Source & Code Audit',
        testId: 'src_meta_favicon',
        description: 'No link[rel="icon"] found. The page may show a default browser icon in tabs and bookmarks.',
        stepsToReproduce: ['Navigate to ' + url, 'Check browser tab for favicon', 'View source for link[rel="icon"]'],
        expected: 'Favicon in multiple formats (.ico, .png, .svg) and apple-touch-icon',
        actual: 'No favicon link tags found',
        url,
        timestamp: new Date().toISOString()
      });
    } else if (!meta.hasAppleTouchIcon) {
      bugs.push({
        id: uuidv4(),
        severity: 'info',
        title: 'Missing apple-touch-icon',
        category: 'View Source & Code Audit',
        testId: 'src_meta_favicon',
        description: 'No apple-touch-icon is defined. iOS devices will use a screenshot when the page is added to the home screen.',
        stepsToReproduce: ['Navigate to ' + url, 'Check for link[rel="apple-touch-icon"]'],
        expected: 'apple-touch-icon should be defined for iOS home screen',
        actual: 'Not found',
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Manifest ───
    if (!meta.manifest) {
      bugs.push({
        id: uuidv4(),
        severity: 'info',
        title: 'No web app manifest found',
        category: 'View Source & Code Audit',
        testId: 'src_meta_manifest',
        description: 'No link[rel="manifest"] found. A manifest is required for PWA support and installability.',
        stepsToReproduce: ['Navigate to ' + url, 'Check for link[rel="manifest"]'],
        expected: 'Web app manifest for PWA features',
        actual: 'No manifest link found',
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Theme Color ───
    if (!meta.themeColor) {
      bugs.push({
        id: uuidv4(),
        severity: 'info',
        title: 'No theme-color meta tag',
        category: 'View Source & Code Audit',
        testId: 'src_meta_theme',
        description: 'No meta[name="theme-color"] found. Theme color customizes the browser chrome on mobile.',
        stepsToReproduce: ['Navigate to ' + url, 'Check for meta[name="theme-color"]'],
        expected: 'theme-color meta tag for mobile browser theming',
        actual: 'Not found',
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Duplicate Meta Tags ───
    if (meta.duplicateMetaTags.length > 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'low',
        title: `Duplicate meta tags: ${meta.duplicateMetaTags.join(', ')}`,
        category: 'View Source & Code Audit',
        testId: 'src_meta_duplicate',
        description: `The following meta tags appear more than once: ${meta.duplicateMetaTags.join(', ')}. Only the first occurrence is typically used.`,
        stepsToReproduce: ['Navigate to ' + url, 'View source', 'Search for duplicate meta names'],
        expected: 'Each meta tag should appear only once',
        actual: `Duplicates: ${meta.duplicateMetaTags.join(', ')}`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── HTML lang attribute ───
    if (!meta.htmlLang) {
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: 'Missing lang attribute on <html> element',
        category: 'View Source & Code Audit',
        testId: 'src_meta_lang',
        description: 'The <html> element does not have a lang attribute. This is important for accessibility and SEO.',
        stepsToReproduce: ['Navigate to ' + url, 'Inspect the <html> tag'],
        expected: '<html lang="en"> (or appropriate language code)',
        actual: 'No lang attribute',
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Security Headers Audit ───
    broadcast({ type: 'log', text: 'Auditing security headers...', color: '#4ECDC4' });
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });
      const headers = response ? response.headers() : {};

      const securityHeaders = {
        'content-security-policy': { severity: 'medium', label: 'Content-Security-Policy' },
        'x-frame-options': { severity: 'medium', label: 'X-Frame-Options' },
        'x-content-type-options': { severity: 'low', label: 'X-Content-Type-Options' },
        'strict-transport-security': { severity: 'medium', label: 'Strict-Transport-Security (HSTS)' },
        'referrer-policy': { severity: 'low', label: 'Referrer-Policy' },
        'permissions-policy': { severity: 'low', label: 'Permissions-Policy' },
      };

      const missingSecurityHeaders = [];
      for (const [header, info] of Object.entries(securityHeaders)) {
        if (!headers[header]) {
          missingSecurityHeaders.push(info.label);
        }
      }

      // Check X-Robots-Tag header
      const xRobotsTag = headers['x-robots-tag'];
      if (xRobotsTag && xRobotsTag.includes('noindex')) {
        bugs.push({
          id: uuidv4(),
          severity: 'high',
          title: 'X-Robots-Tag header contains noindex',
          category: 'View Source & Code Audit',
          testId: 'src_meta_xrobots',
          description: `HTTP header X-Robots-Tag: "${xRobotsTag}" will prevent search engine indexing`,
          stepsToReproduce: ['Navigate to ' + url, 'Check response headers for X-Robots-Tag'],
          expected: 'X-Robots-Tag should not contain noindex in production',
          actual: `X-Robots-Tag: ${xRobotsTag}`,
          url,
          timestamp: new Date().toISOString()
        });
      }

      if (missingSecurityHeaders.length > 0) {
        const criticalMissing = missingSecurityHeaders.filter(h =>
          h.includes('Content-Security-Policy') || h.includes('Strict-Transport-Security')
        );

        bugs.push({
          id: uuidv4(),
          severity: criticalMissing.length > 0 ? 'medium' : 'low',
          title: `Missing ${missingSecurityHeaders.length} security header(s)`,
          category: 'View Source & Code Audit',
          testId: 'src_meta_security_headers',
          description: `Missing security headers: ${missingSecurityHeaders.join(', ')}. These headers help protect against common web attacks.`,
          stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Network tab', 'Check response headers'],
          expected: 'All security headers should be present',
          actual: `Missing: ${missingSecurityHeaders.join(', ')}`,
          url,
          timestamp: new Date().toISOString()
        });
      }

      if (orchestrator) {
        orchestrator.sourceAudit.securityHeaders = {
          present: Object.keys(securityHeaders).filter(h => headers[h]),
          missing: missingSecurityHeaders,
        };
      }
    } catch {
      // Headers check non-critical
    }

    broadcast({
      type: 'log',
      text: `Meta audit complete — ${bugs.length} issue(s) found`,
      color: bugs.length > 5 ? '#FF6B35' : (bugs.length > 0 ? '#F5A623' : '#4ECDC4')
    });
  } catch (error) {
    broadcast({ type: 'log', text: `Meta audit error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runSrcConsole(page, url, options, broadcast, orchestrator, existingErrors = []) {
  const bugs = [];
  const timeout = (options.timeout || 30) * 1000;

  // Categorized message storage
  const messages = {
    errors: [...existingErrors],
    warnings: [],
    info: [],
    debug: [],
    networkErrors: [],
    corsErrors: [],
    cspViolations: [],
    deprecations: [],
    mixedContent: [],
    unhandledRejections: [],
  };

  broadcast({ type: 'log', text: 'Capturing console output (all levels, comprehensive)...', color: '#4ECDC4' });

  // ─── Set Up Listeners ───
  const consoleHandler = (msg) => {
    const text = msg.text();
    const type = msg.type();

    if (type === 'error') {
      // Categorize error types
      if (/cors|cross-origin|access-control/i.test(text)) {
        messages.corsErrors.push(text);
      } else if (/content.security.policy|csp|violated/i.test(text)) {
        messages.cspViolations.push(text);
      } else if (/mixed.content|insecure/i.test(text)) {
        messages.mixedContent.push(text);
      } else if (/deprecated|will be removed/i.test(text)) {
        messages.deprecations.push(text);
      } else {
        messages.errors.push(text);
      }
    } else if (type === 'warning') {
      if (/deprecated|will be removed/i.test(text)) {
        messages.deprecations.push(text);
      } else {
        messages.warnings.push(text);
      }
    } else if (type === 'info') {
      messages.info.push(text);
    } else if (type === 'debug') {
      messages.debug.push(text);
    }
  };

  const pageErrorHandler = (error) => {
    messages.errors.push(`Uncaught: ${error.message}`);
  };

  const requestFailedHandler = (request) => {
    const failure = request.failure();
    if (failure) {
      messages.networkErrors.push(`${request.method()} ${request.url()} — ${failure.errorText}`);
    }
  };

  page.on('console', consoleHandler);
  page.on('pageerror', pageErrorHandler);
  page.on('requestfailed', requestFailedHandler);

  try {
    // ─── 1. Navigate and Monitor for 5 seconds ───
    broadcast({ type: 'log', text: 'Loading page and monitoring for 5 seconds...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'load', timeout }).catch(() => {});
    await page.waitForTimeout(5000);

    // ─── 2. Click 10+ Interactive Elements ───
    broadcast({ type: 'log', text: 'Clicking interactive elements to trigger errors...', color: '#4ECDC4' });
    const clickables = await page.$$('button, a, [role="button"], [role="tab"], [role="menuitem"], details summary, [tabindex="0"]');
    let clickCount = 0;
    for (const el of clickables.slice(0, 15)) {
      try {
        const isVisible = await el.isVisible();
        if (!isVisible) continue;

        // Don't click links that navigate away
        const tag = await el.evaluate(e => e.tagName);
        const href = await el.getAttribute('href').catch(() => null);
        if (tag === 'A' && href && !href.startsWith('#') && !href.startsWith('javascript:')) continue;

        await el.click({ timeout: 1000 }).catch(() => {});
        clickCount++;
        await page.waitForTimeout(300);
      } catch {
        // Continue
      }
    }
    broadcast({ type: 'log', text: `Clicked ${clickCount} elements`, color: '#4ECDC4' });

    // ─── 3. Scroll Full Page ───
    broadcast({ type: 'log', text: 'Scrolling full page for lazy-load errors...', color: '#4ECDC4' });
    try {
      await page.evaluate(async () => {
        const scrollHeight = document.body.scrollHeight;
        const viewportHeight = window.innerHeight;
        for (let y = 0; y < scrollHeight; y += viewportHeight) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 300));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(2000);
    } catch {
      // Non-critical
    }

    // ─── 4. Type in Input Fields ───
    broadcast({ type: 'log', text: 'Typing in input fields to trigger validation errors...', color: '#4ECDC4' });
    try {
      const inputs = await page.$$('input[type="text"], input[type="email"], input[type="number"], textarea');
      for (const input of inputs.slice(0, 5)) {
        try {
          const isVisible = await input.isVisible();
          if (!isVisible) continue;
          await input.click();
          await input.fill('test@validation.check');
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);
        } catch {
          // Continue
        }
      }
    } catch {
      // Non-critical
    }

    // ─── 5. Check for unhandled promise rejections ───
    try {
      const rejections = await page.evaluate(() => {
        return new Promise((resolve) => {
          const caught = [];
          const handler = (event) => {
            caught.push(event.reason?.message || String(event.reason));
          };
          window.addEventListener('unhandledrejection', handler);
          setTimeout(() => {
            window.removeEventListener('unhandledrejection', handler);
            resolve(caught);
          }, 2000);
        });
      }).catch(() => []);

      messages.unhandledRejections.push(...rejections);
    } catch {
      // Non-critical
    }

    // ─── Deduplicate and Count ───
    const dedup = (arr) => {
      const counts = {};
      arr.forEach(msg => {
        const key = msg.slice(0, 200);
        counts[key] = (counts[key] || 0) + 1;
      });
      return Object.entries(counts).map(([msg, count]) => count > 1 ? `${msg} (x${count})` : msg);
    };

    const uniqueErrors = dedup(messages.errors);
    const uniqueWarnings = dedup(messages.warnings);
    const uniqueNetworkErrors = dedup(messages.networkErrors);
    const totalMessages = messages.errors.length + messages.warnings.length + messages.info.length + messages.debug.length + messages.networkErrors.length;

    // ─── Update Orchestrator ───
    if (orchestrator) {
      orchestrator.sourceAudit.consoleErrors = messages.errors.length;
      orchestrator.sourceAudit.consoleWarnings = messages.warnings.length;
      orchestrator.sourceAudit.networkErrors = messages.networkErrors.length;
      orchestrator.sourceAudit.corsErrors = messages.corsErrors.length;
      orchestrator.sourceAudit.cspViolations = messages.cspViolations.length;
      orchestrator.sourceAudit.totalConsoleMessages = totalMessages;
    }

    // ─── Bug: Console Errors ───
    if (uniqueErrors.length > 0) {
      bugs.push({
        id: uuidv4(),
        severity: uniqueErrors.length > 10 ? 'high' : (uniqueErrors.length > 3 ? 'medium' : 'low'),
        title: `${messages.errors.length} JavaScript error(s) in console (${uniqueErrors.length} unique)`,
        category: 'View Source & Code Audit',
        testId: 'src_console_errors',
        description: `JavaScript errors found:\n${uniqueErrors.slice(0, 8).join('\n')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Console', 'Filter by errors', 'Interact with the page'],
        expected: 'No console errors',
        actual: `${messages.errors.length} errors (${uniqueErrors.length} unique)`,
        consoleOutput: uniqueErrors.slice(0, 15).join('\n'),
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: Console Warnings ───
    if (uniqueWarnings.length > 5) {
      bugs.push({
        id: uuidv4(),
        severity: 'low',
        title: `${messages.warnings.length} console warning(s)`,
        category: 'View Source & Code Audit',
        testId: 'src_console_warnings',
        description: `Console warnings:\n${uniqueWarnings.slice(0, 5).join('\n')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Console', 'Filter by warnings'],
        expected: 'Minimal console warnings',
        actual: `${messages.warnings.length} warnings`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: Network Failures ───
    if (uniqueNetworkErrors.length > 0) {
      bugs.push({
        id: uuidv4(),
        severity: uniqueNetworkErrors.length > 5 ? 'high' : 'medium',
        title: `${messages.networkErrors.length} failed network request(s)`,
        category: 'View Source & Code Audit',
        testId: 'src_console_network',
        description: `Network failures:\n${uniqueNetworkErrors.slice(0, 8).join('\n')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Network tab', 'Look for red/failed requests'],
        expected: 'All network requests should succeed',
        actual: `${messages.networkErrors.length} failed requests`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: CORS Errors ───
    if (messages.corsErrors.length > 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: `${messages.corsErrors.length} CORS violation(s)`,
        category: 'View Source & Code Audit',
        testId: 'src_console_cors',
        description: `Cross-Origin Resource Sharing errors:\n${dedup(messages.corsErrors).slice(0, 5).join('\n')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Console', 'Look for CORS errors'],
        expected: 'Properly configured CORS headers on API endpoints',
        actual: `${messages.corsErrors.length} CORS violations`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: CSP Violations ───
    if (messages.cspViolations.length > 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: `${messages.cspViolations.length} Content Security Policy violation(s)`,
        category: 'View Source & Code Audit',
        testId: 'src_console_csp',
        description: `CSP violations:\n${dedup(messages.cspViolations).slice(0, 5).join('\n')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Console', 'Filter for CSP'],
        expected: 'No CSP violations — all resources should comply with the policy',
        actual: `${messages.cspViolations.length} CSP violations`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: Mixed Content ───
    if (messages.mixedContent.length > 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'high',
        title: `${messages.mixedContent.length} mixed content warning(s)`,
        category: 'View Source & Code Audit',
        testId: 'src_console_mixed',
        description: `HTTPS page loading insecure resources:\n${dedup(messages.mixedContent).slice(0, 5).join('\n')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Console', 'Look for mixed content warnings'],
        expected: 'All resources loaded over HTTPS',
        actual: `${messages.mixedContent.length} mixed content issues`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: Deprecation Warnings ───
    if (messages.deprecations.length > 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'low',
        title: `${messages.deprecations.length} deprecation warning(s)`,
        category: 'View Source & Code Audit',
        testId: 'src_console_deprecated',
        description: `Deprecated API usage detected:\n${dedup(messages.deprecations).slice(0, 5).join('\n')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Console', 'Filter for deprecation warnings'],
        expected: 'No deprecated API usage',
        actual: `${messages.deprecations.length} deprecation warnings`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: Unhandled Promise Rejections ───
    if (messages.unhandledRejections.length > 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: `${messages.unhandledRejections.length} unhandled promise rejection(s)`,
        category: 'View Source & Code Audit',
        testId: 'src_console_rejections',
        description: `Unhandled promise rejections:\n${messages.unhandledRejections.slice(0, 5).join('\n')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Interact with the page', 'Check console for unhandled rejections'],
        expected: 'All promises should have error handlers',
        actual: `${messages.unhandledRejections.length} unhandled rejections`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    // ─── Bug: Excessive Logging ───
    if (totalMessages > 50) {
      bugs.push({
        id: uuidv4(),
        severity: 'info',
        title: `Excessive console output (${totalMessages} messages)`,
        category: 'View Source & Code Audit',
        testId: 'src_console_verbose',
        description: `Page generates ${totalMessages} console messages (${messages.errors.length} errors, ${messages.warnings.length} warnings, ${messages.info.length} info, ${messages.debug.length} debug). This may indicate verbose logging left in production.`,
        stepsToReproduce: ['Navigate to ' + url, 'Open DevTools Console', 'Count total messages'],
        expected: 'Minimal console output in production',
        actual: `${totalMessages} total messages`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    broadcast({
      type: 'log',
      text: `Console capture complete — ${messages.errors.length} errors, ${messages.warnings.length} warnings, ${messages.networkErrors.length} network failures, ${totalMessages} total messages`,
      color: messages.errors.length > 0 ? '#FF6B35' : '#4ECDC4'
    });
  } catch (error) {
    broadcast({ type: 'log', text: `Console capture error: ${error.message}`, color: '#FF6B35' });
  } finally {
    page.off('console', consoleHandler);
    page.off('pageerror', pageErrorHandler);
    page.off('requestfailed', requestFailedHandler);
  }

  return bugs;
}

module.exports = { runSrcJs, runSrcMeta, runSrcConsole };
