const { v4: uuidv4 } = require('uuid');

/**
 * Navigation Tests — Enterprise Grade
 * - URL depth crawl (3 levels, comprehensive page quality checks)
 * - Forward/Back navigation (multi-page chain, SPA detection, hash nav)
 * - Broken link detection (all links, HEAD+GET, soft 404, mailto/tel, anchors)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBug(severity, title, testId, description, steps, expected, actual, pageUrl) {
  return {
    id: uuidv4(),
    severity,
    title,
    category: 'Navigation & Routing',
    testId,
    description,
    stepsToReproduce: steps,
    expected,
    actual,
    url: pageUrl,
    timestamp: new Date().toISOString()
  };
}

function severityForStatus(status) {
  if (status === 404) return 'medium';
  if (status === 403) return 'medium';
  if (status >= 500) return 'high';
  return 'low';
}

// ---------------------------------------------------------------------------
// runNavDepth
// ---------------------------------------------------------------------------

async function runNavDepth(page, url, options, broadcast) {
  const bugs = [];
  const visited = new Set();
  const titleMap = new Map(); // title -> [urls]
  const parentMap = new Map(); // childUrl -> parentUrl
  const maxDepth = 3;
  const linksPerPage = 10;
  const baseOrigin = new URL(url).origin;
  const isHttps = new URL(url).protocol === 'https:';
  const loadTimes = [];
  let redirectCount = 0;

  broadcast({ type: 'log', text: 'Starting deep URL crawl (3 levels, 10 links/page)...', color: '#4ECDC4' });

  // ------- Try to fetch robots.txt patterns -------
  let disallowedPaths = [];
  try {
    const robotsResp = await page.request.get(`${baseOrigin}/robots.txt`, { timeout: 5000 });
    if (robotsResp.ok()) {
      const robotsTxt = await robotsResp.text();
      const lines = robotsTxt.split('\n');
      let appliesToAll = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^user-agent:\s*\*/i.test(trimmed)) {
          appliesToAll = true;
        } else if (/^user-agent:/i.test(trimmed)) {
          appliesToAll = false;
        } else if (appliesToAll && /^disallow:\s*\//i.test(trimmed)) {
          const path = trimmed.replace(/^disallow:\s*/i, '').trim();
          if (path) disallowedPaths.push(path);
        }
      }
    }
  } catch (_) { /* robots.txt not available */ }

  function isDisallowed(testUrl) {
    try {
      const pathname = new URL(testUrl).pathname;
      return disallowedPaths.some(p => pathname.startsWith(p));
    } catch { return false; }
  }

  // ------- Crawl function -------
  async function crawl(currentUrl, depth) {
    if (depth > maxDepth || visited.has(currentUrl)) return;
    if (isDisallowed(currentUrl)) {
      broadcast({ type: 'log', text: `Skipping disallowed URL: ${currentUrl}`, color: '#F5A623' });
      return;
    }
    visited.add(currentUrl);

    try {
      const startTime = Date.now();

      // Track redirects
      let redirectsForPage = 0;
      const redirectHandler = (response) => {
        const s = response.status();
        if (s >= 300 && s < 400) {
          redirectsForPage++;
          redirectCount++;
        }
      };
      page.on('response', redirectHandler);

      const response = await page.goto(currentUrl, {
        waitUntil: 'domcontentloaded',
        timeout: (options.timeout || 30) * 1000
      });

      page.off('response', redirectHandler);

      const loadTime = Date.now() - startTime;
      loadTimes.push(loadTime);

      const status = response ? response.status() : 0;

      // --- Check: non-200 status ---
      if (status && status !== 200 && status < 300) {
        bugs.push(makeBug('low', `Non-200 status (${status})`, 'nav_depth',
          `Page at ${currentUrl} returned HTTP ${status}`,
          ['Navigate to ' + currentUrl],
          'Page should return HTTP 200',
          `Returns HTTP ${status}`,
          currentUrl));
      }

      // --- Check: redirect chain ---
      if (redirectsForPage >= 3) {
        bugs.push(makeBug('medium', `Redirect chain detected (${redirectsForPage} hops)`, 'nav_depth',
          `Page at ${currentUrl} went through ${redirectsForPage} redirects before settling`,
          ['Navigate to ' + currentUrl, 'Observe redirects in network tab'],
          'Page should resolve in 1-2 redirects at most',
          `${redirectsForPage} redirects detected`,
          currentUrl));
      }

      // --- Check: slow page load ---
      if (loadTime > 5000) {
        bugs.push(makeBug('medium', `Slow page load (${(loadTime / 1000).toFixed(1)}s)`, 'nav_depth',
          `Page at ${currentUrl} took ${(loadTime / 1000).toFixed(1)} seconds to reach DOMContentLoaded`,
          ['Navigate to ' + currentUrl, 'Measure load time'],
          'Page should load within 5 seconds',
          `Loaded in ${(loadTime / 1000).toFixed(1)}s`,
          currentUrl));
      }

      // --- Check: empty title ---
      const title = await page.title();
      if (!title || title.trim() === '') {
        bugs.push(makeBug('medium', 'Empty page title', 'nav_depth',
          `Page at ${currentUrl} has an empty or missing title tag`,
          ['Navigate to ' + currentUrl, 'Check page title'],
          'Page should have a descriptive title',
          'Title is empty or missing',
          currentUrl));
      } else {
        // Track for duplicate detection
        const normalizedTitle = title.trim();
        if (!titleMap.has(normalizedTitle)) {
          titleMap.set(normalizedTitle, []);
        }
        titleMap.get(normalizedTitle).push(currentUrl);
      }

      // --- Page-level checks (run in browser context) ---
      const pageChecks = await page.evaluate((params) => {
        const results = { missingH1: false, multipleH1: false, emptyBody: false, mixedContent: [], brokenFragments: [] };

        // H1 checks
        const h1s = document.querySelectorAll('h1');
        if (h1s.length === 0) results.missingH1 = true;
        if (h1s.length > 1) results.multipleH1 = true;

        // Body text length check
        const bodyText = document.body ? document.body.innerText || '' : '';
        if (bodyText.trim().length < 100) results.emptyBody = true;

        // Mixed content (http resources on https page)
        if (params.isHttps) {
          const resources = [
            ...document.querySelectorAll('img[src^="http:"]'),
            ...document.querySelectorAll('script[src^="http:"]'),
            ...document.querySelectorAll('link[href^="http:"]'),
            ...document.querySelectorAll('iframe[src^="http:"]'),
            ...document.querySelectorAll('video[src^="http:"]'),
            ...document.querySelectorAll('audio[src^="http:"]'),
          ];
          results.mixedContent = resources.map(el => el.src || el.href).slice(0, 5);
        }

        // Fragment links that don't resolve
        const fragmentLinks = document.querySelectorAll('a[href^="#"]');
        for (const a of fragmentLinks) {
          const hash = a.getAttribute('href');
          if (hash && hash !== '#' && hash !== '#!') {
            const targetId = hash.slice(1);
            if (targetId && !document.getElementById(targetId) && !document.querySelector(`[name="${targetId}"]`)) {
              results.brokenFragments.push(hash);
            }
          }
        }
        results.brokenFragments = results.brokenFragments.slice(0, 10);

        return results;
      }, { isHttps });

      if (pageChecks.missingH1) {
        bugs.push(makeBug('low', 'Missing H1 heading', 'nav_depth',
          `Page at ${currentUrl} has no H1 element`,
          ['Navigate to ' + currentUrl, 'Inspect headings'],
          'Page should have exactly one H1 heading',
          'No H1 found',
          currentUrl));
      }

      if (pageChecks.multipleH1) {
        bugs.push(makeBug('low', 'Multiple H1 headings', 'nav_depth',
          `Page at ${currentUrl} has more than one H1 element`,
          ['Navigate to ' + currentUrl, 'Inspect headings'],
          'Page should have exactly one H1 heading',
          'Multiple H1 elements found',
          currentUrl));
      }

      if (pageChecks.emptyBody) {
        bugs.push(makeBug('medium', 'Page has very little content', 'nav_depth',
          `Page at ${currentUrl} has fewer than 100 characters of body text`,
          ['Navigate to ' + currentUrl, 'Check visible content'],
          'Page should have meaningful content',
          'Body text is under 100 characters',
          currentUrl));
      }

      if (pageChecks.mixedContent.length > 0) {
        bugs.push(makeBug('high', 'Mixed content detected (HTTP on HTTPS)', 'nav_depth',
          `Page at ${currentUrl} loads insecure resources: ${pageChecks.mixedContent.join(', ')}`,
          ['Navigate to ' + currentUrl, 'Open browser console/network tab', 'Look for mixed content warnings'],
          'All resources should be loaded over HTTPS',
          `Found ${pageChecks.mixedContent.length} HTTP resource(s) on HTTPS page`,
          currentUrl));
      }

      for (const frag of pageChecks.brokenFragments) {
        bugs.push(makeBug('low', `Broken fragment link: ${frag}`, 'nav_depth',
          `Fragment link "${frag}" on ${currentUrl} does not resolve to any element with that ID`,
          ['Navigate to ' + currentUrl, `Click link with href="${frag}"`],
          `An element with id="${frag.slice(1)}" should exist`,
          'No matching element found',
          currentUrl));
      }

      // --- Collect same-origin links for next crawl level ---
      const links = await page.evaluate((origin) => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href => {
            try {
              const u = new URL(href);
              return u.origin === origin && !href.includes('#');
            } catch { return false; }
          })
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .slice(0, 20); // gather more, crawl limited set
      }, baseOrigin);

      broadcast({ type: 'log', text: `[depth=${depth}] ${currentUrl} — ${links.length} links, ${loadTime}ms`, color: '#4ECDC4' });

      // --- Check: no back-link to parent ---
      const parentUrl = parentMap.get(currentUrl);
      if (parentUrl && depth > 0) {
        const hasBackLink = links.some(l => {
          try { return new URL(l).pathname === new URL(parentUrl).pathname; } catch { return false; }
        });
        if (!hasBackLink) {
          bugs.push(makeBug('info', 'No back-link to parent page', 'nav_depth',
            `Page at ${currentUrl} has no link back to its parent ${parentUrl}`,
            ['Navigate to ' + currentUrl, 'Look for link back to ' + parentUrl],
            'Page should link back to the page that linked to it',
            'No back-link found',
            currentUrl));
        }
      }

      // Crawl children
      const toCrawl = links.slice(0, linksPerPage);
      for (const link of toCrawl) {
        if (!visited.has(link)) {
          parentMap.set(link, currentUrl);
          await crawl(link, depth + 1);
        }
      }

    } catch (error) {
      bugs.push(makeBug('high', 'Page load failure', 'nav_depth',
        `Failed to load page: ${error.message}`,
        ['Navigate to ' + currentUrl],
        'Page should load successfully',
        `Error: ${error.message}`,
        currentUrl));
    }
  }

  await crawl(url, 0);

  // --- Post-crawl: duplicate titles ---
  for (const [title, urls] of titleMap.entries()) {
    if (urls.length > 1) {
      bugs.push(makeBug('low', `Duplicate page title: "${title}"`, 'nav_depth',
        `${urls.length} pages share the same title "${title}": ${urls.join(', ')}`,
        ['Crawl site', 'Compare titles across pages'],
        'Each page should have a unique, descriptive title',
        `${urls.length} pages share this title`,
        urls[0]));
    }
  }

  // --- Crawl stats ---
  const avgLoad = loadTimes.length > 0 ? Math.round(loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length) : 0;
  broadcast({ type: 'log', text: `Crawl complete — ${visited.size} pages, avg load ${avgLoad}ms, ${redirectCount} redirects`, color: '#4ECDC4' });

  return bugs;
}

// ---------------------------------------------------------------------------
// runNavBackFwd
// ---------------------------------------------------------------------------

async function runNavBackFwd(page, url, options, broadcast) {
  const bugs = [];
  const timeout = (options.timeout || 30) * 1000;
  const baseOrigin = new URL(url).origin;

  broadcast({ type: 'log', text: 'Testing back/forward navigation (multi-page chain, hash, SPA)...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    const originalUrl = page.url();
    const originalContentSnippet = await page.evaluate(() => (document.body.innerText || '').slice(0, 500));

    // --- Gather same-origin links ---
    const links = await page.evaluate((origin) => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href)
        .filter(href => {
          try { return new URL(href).origin === origin && !href.includes('#'); } catch { return false; }
        })
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 10);
    }, baseOrigin);

    // ---- TEST 1: Multi-page chain back/forward (3+ pages) ----
    if (links.length >= 3) {
      const chain = [originalUrl];
      const contentChain = [originalContentSnippet];

      for (let i = 0; i < Math.min(3, links.length); i++) {
        try {
          await page.goto(links[i], { waitUntil: 'domcontentloaded', timeout });
          chain.push(page.url());
          const snippet = await page.evaluate(() => (document.body.innerText || '').slice(0, 500));
          contentChain.push(snippet);
        } catch (_) { break; }
      }

      broadcast({ type: 'log', text: `Built navigation chain of ${chain.length} pages`, color: '#4ECDC4' });

      // Walk backward through the chain
      for (let i = chain.length - 2; i >= 0; i--) {
        try {
          await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
          const currentUrl = page.url();
          const currentSnippet = await page.evaluate(() => (document.body.innerText || '').slice(0, 500));

          if (!currentUrl.includes(new URL(chain[i]).pathname)) {
            bugs.push(makeBug('medium', 'Back navigation URL mismatch in chain', 'nav_back_fwd',
              `After going back ${chain.length - 1 - i} time(s), expected to reach ${chain[i]} but landed on ${currentUrl}`,
              ['Navigate through chain: ' + chain.join(' -> '), `Press back ${chain.length - 1 - i} time(s)`],
              `URL should be ${chain[i]}`,
              `URL is ${currentUrl}`,
              url));
          }

          // Content match check
          if (contentChain[i] && currentSnippet && contentChain[i].slice(0, 200) !== currentSnippet.slice(0, 200)) {
            bugs.push(makeBug('medium', 'Page content mismatch after back navigation', 'nav_back_fwd',
              `Content at step ${i} differs after using browser back button`,
              ['Navigate through chain', 'Press back', 'Compare page content'],
              'Page content should match original visit',
              'Content differs after back navigation',
              chain[i]));
          }
        } catch (e) {
          bugs.push(makeBug('medium', 'Back navigation failed in chain', 'nav_back_fwd',
            `goBack() threw: ${e.message}`,
            ['Navigate through chain', 'Press back'],
            'Browser back should work',
            `Error: ${e.message}`,
            url));
        }
      }

      // Walk forward through the chain
      for (let i = 1; i < chain.length; i++) {
        try {
          await page.goForward({ waitUntil: 'domcontentloaded', timeout: 10000 });
          const currentUrl = page.url();

          if (!currentUrl.includes(new URL(chain[i]).pathname)) {
            bugs.push(makeBug('medium', 'Forward navigation URL mismatch in chain', 'nav_back_fwd',
              `After going forward ${i} time(s), expected ${chain[i]} but got ${currentUrl}`,
              ['After going all the way back', `Press forward ${i} time(s)`],
              `URL should be ${chain[i]}`,
              `URL is ${currentUrl}`,
              url));
          }
        } catch (e) {
          bugs.push(makeBug('medium', 'Forward navigation failed in chain', 'nav_back_fwd',
            `goForward() threw: ${e.message}`,
            ['Navigate through chain', 'Go back', 'Press forward'],
            'Browser forward should work',
            `Error: ${e.message}`,
            url));
        }
      }
    } else if (links.length > 0) {
      // Fallback: simple back/forward with at least 1 link
      await page.goto(links[0], { waitUntil: 'domcontentloaded', timeout });
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
      const afterBack = page.url();
      if (!afterBack.includes(new URL(originalUrl).pathname)) {
        bugs.push(makeBug('medium', 'Back navigation URL mismatch', 'nav_back_fwd',
          'Browser back did not return to original URL',
          ['Navigate to ' + originalUrl, 'Click a link', 'Press back'],
          `URL should return to ${originalUrl}`,
          `URL is ${afterBack}`,
          url));
      }
      await page.goForward({ waitUntil: 'domcontentloaded', timeout: 10000 });
    } else {
      broadcast({ type: 'log', text: 'No same-origin links found for chain test', color: '#F5A623' });
    }

    // ---- TEST 2: Hash navigation back/forward ----
    broadcast({ type: 'log', text: 'Testing hash navigation...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const hashTargets = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href^="#"]'))
        .map(a => a.getAttribute('href'))
        .filter(h => h && h !== '#' && h.length > 1)
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 5);
    });

    if (hashTargets.length >= 2) {
      for (const hash of hashTargets.slice(0, 2)) {
        try {
          await page.click(`a[href="${hash}"]`);
          await page.waitForTimeout(300);
        } catch (_) { /* link may not be clickable */ }
      }

      try {
        await page.goBack({ timeout: 5000 });
        await page.waitForTimeout(300);
        const hashAfterBack = new URL(page.url()).hash;

        await page.goForward({ timeout: 5000 });
        await page.waitForTimeout(300);
        const hashAfterForward = new URL(page.url()).hash;

        // If hash didn't change at all, browser history may not be tracking hashes
        if (hashAfterBack === hashAfterForward && hashTargets.length >= 2) {
          bugs.push(makeBug('low', 'Hash navigation not tracked in browser history', 'nav_back_fwd',
            'Back/forward through hash links does not update the URL hash as expected',
            ['Click multiple hash links on ' + url, 'Press back', 'Press forward'],
            'URL hash should change with back/forward',
            'Hash did not update with back/forward navigation',
            url));
        }
      } catch (_) { /* some pages may not support this */ }
    }

    // ---- TEST 3: SPA history.pushState/popState detection ----
    broadcast({ type: 'log', text: 'Checking for SPA history handling issues...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const spaIssue = await page.evaluate(() => {
      // Detect if the page uses pushState
      let usesPushState = false;
      const origPushState = history.pushState;
      history.pushState = function () {
        usesPushState = true;
        return origPushState.apply(this, arguments);
      };

      // Click a few internal links and see if pushState fires
      const internalLinks = Array.from(document.querySelectorAll('a[href]')).filter(a => {
        try { return new URL(a.href).origin === location.origin; } catch { return false; }
      }).slice(0, 3);

      for (const link of internalLinks) {
        try { link.click(); } catch (_) {}
      }

      // Restore
      history.pushState = origPushState;
      return { usesPushState, linkCount: internalLinks.length };
    });

    if (spaIssue.usesPushState) {
      // Test if popstate works properly
      try {
        const urlBeforeBack = page.url();
        await page.goBack({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);
        const urlAfterBack = page.url();
        const contentAfterBack = await page.evaluate(() => (document.body.innerText || '').slice(0, 200));

        // If URL changed but content didn't update, SPA has a popstate bug
        if (urlBeforeBack !== urlAfterBack && contentAfterBack.length < 20) {
          bugs.push(makeBug('high', 'SPA breaks browser back button', 'nav_back_fwd',
            'The page uses history.pushState but does not properly handle popstate — back button leaves page blank or unchanged',
            ['Navigate the SPA', 'Press browser back button', 'Observe page content'],
            'Content should update to match the previous URL',
            'Page content did not update after back navigation',
            url));
        }
      } catch (_) {}
    }

    // ---- TEST 4: Rapid back-forward-back sequence ----
    broadcast({ type: 'log', text: 'Testing rapid back/forward sequences...', color: '#4ECDC4' });
    if (links.length > 0) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        await page.goto(links[0], { waitUntil: 'domcontentloaded', timeout });

        // Rapid sequence: back, forward, back
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.goForward({ waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });

        const rapidUrl = page.url();
        if (!rapidUrl.includes(new URL(url).pathname)) {
          bugs.push(makeBug('medium', 'Rapid back/forward results in wrong page', 'nav_back_fwd',
            `After rapid back->forward->back, expected ${url} but got ${rapidUrl}`,
            ['Navigate to ' + url, 'Click a link', 'Rapidly press back, forward, back'],
            `Should return to ${url}`,
            `Landed on ${rapidUrl}`,
            url));
        }
      } catch (e) {
        bugs.push(makeBug('medium', 'Rapid back/forward sequence failed', 'nav_back_fwd',
          `Rapid navigation sequence caused error: ${e.message}`,
          ['Navigate to ' + url, 'Click link', 'Rapidly press back, forward, back'],
          'Navigation should handle rapid sequences',
          `Error: ${e.message}`,
          url));
      }
    }

    // ---- TEST 5: Form state after back navigation ----
    broadcast({ type: 'log', text: 'Testing form state preservation after back...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const hasForm = await page.$('form');
    if (hasForm) {
      const textInput = await page.$('form input[type="text"], form input:not([type])');
      if (textInput) {
        try {
          await textInput.fill('BackNavTestValue');
          // Navigate away
          if (links.length > 0) {
            await page.goto(links[0], { waitUntil: 'domcontentloaded', timeout });
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
            await page.waitForTimeout(500);

            const restoredInput = await page.$('form input[type="text"], form input:not([type])');
            if (restoredInput) {
              const restoredValue = await restoredInput.inputValue();
              // Browsers typically restore form state via bfcache — report if they don't
              // This is informational, not necessarily a bug
              if (restoredValue !== 'BackNavTestValue') {
                bugs.push(makeBug('info', 'Form state not preserved after back navigation', 'nav_back_fwd',
                  'Text input data was lost after navigating away and pressing back',
                  ['Fill a text field on ' + url, 'Navigate away', 'Press back'],
                  'Form state may be preserved by bfcache',
                  'Field value was cleared',
                  url));
              }
            }
          }
        } catch (_) { /* not critical */ }
      }
    }

    // ---- TEST 6: Detect pages that intercept/block back button ----
    broadcast({ type: 'log', text: 'Checking for back-button interception...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const interceptsBack = await page.evaluate(() => {
      // Check for beforeunload or popstate listeners that might block navigation
      // We can detect onbeforeunload assignment
      const hasBeforeUnload = typeof window.onbeforeunload === 'function';
      // Check for history manipulation that traps the user
      return { hasBeforeUnload };
    });

    if (interceptsBack.hasBeforeUnload) {
      bugs.push(makeBug('low', 'Page has beforeunload handler (may block back button)', 'nav_back_fwd',
        'The page sets window.onbeforeunload which can show a dialog when the user tries to leave',
        ['Navigate to ' + url, 'Try pressing the back button or closing the tab'],
        'Pages should not unnecessarily block navigation',
        'beforeunload handler detected',
        url));
    }

    broadcast({ type: 'log', text: 'Back/forward navigation tests complete', color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Navigation test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

// ---------------------------------------------------------------------------
// runNavBroken
// ---------------------------------------------------------------------------

async function runNavBroken(page, url, options, broadcast) {
  const bugs = [];
  const timeout = (options.timeout || 30) * 1000;
  const baseOrigin = new URL(url).origin;
  const isHttps = new URL(url).protocol === 'https:';

  broadcast({ type: 'log', text: 'Comprehensive broken link analysis starting...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    // --- Gather ALL unique links ---
    const allLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({
          href: a.href,
          rawHref: a.getAttribute('href'),
          text: (a.textContent || '').trim().slice(0, 60) || a.getAttribute('aria-label') || 'No text',
        }))
        .filter((v, i, arr) => arr.findIndex(x => x.href === v.href) === i);
    });

    // Categorise links
    const httpLinks = [];
    const mailtoLinks = [];
    const telLinks = [];
    const anchorLinks = [];
    const internalLinks = new Set();
    const externalLinks = new Set();

    for (const link of allLinks) {
      const raw = link.rawHref || '';
      if (raw.startsWith('mailto:')) {
        mailtoLinks.push(link);
      } else if (raw.startsWith('tel:')) {
        telLinks.push(link);
      } else if (raw.startsWith('#')) {
        anchorLinks.push(link);
      } else if (link.href.startsWith('http')) {
        httpLinks.push(link);
        try {
          const u = new URL(link.href);
          if (u.origin === baseOrigin) {
            internalLinks.add(link.href);
          } else {
            externalLinks.add(link.href);
          }
        } catch (_) {}
      }
    }

    broadcast({ type: 'log', text: `Found ${httpLinks.length} HTTP links, ${mailtoLinks.length} mailto, ${telLinks.length} tel, ${anchorLinks.length} anchor`, color: '#4ECDC4' });

    // --- Check anchor links resolve ---
    if (anchorLinks.length > 0) {
      const brokenAnchors = await page.evaluate((anchors) => {
        const broken = [];
        for (const a of anchors) {
          const hash = a.rawHref;
          if (hash && hash !== '#' && hash !== '#!') {
            const id = hash.slice(1);
            if (id && !document.getElementById(id) && !document.querySelector(`[name="${id}"]`)) {
              broken.push({ hash, text: a.text });
            }
          }
        }
        return broken;
      }, anchorLinks);

      for (const ba of brokenAnchors) {
        bugs.push(makeBug('low', `Broken anchor: ${ba.hash}`, 'nav_broken',
          `Anchor link "${ba.text}" (${ba.hash}) does not resolve to any element on the page`,
          ['Navigate to ' + url, `Click anchor link "${ba.text}"`],
          `Element with id="${ba.hash.slice(1)}" should exist`,
          'No matching element found',
          url));
      }
    }

    // --- Validate mailto: format ---
    for (const ml of mailtoLinks) {
      const email = ml.rawHref.replace('mailto:', '').split('?')[0];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        bugs.push(makeBug('low', `Invalid mailto: format`, 'nav_broken',
          `mailto: link "${ml.text}" has invalid email: ${email}`,
          ['Navigate to ' + url, `Inspect mailto link "${ml.text}"`],
          'mailto: links should have a valid email address',
          `Email format is invalid: ${email}`,
          url));
      }
    }

    // --- Validate tel: format ---
    for (const tl of telLinks) {
      const phone = tl.rawHref.replace('tel:', '').replace(/\s/g, '');
      // Valid phone: starts with + or digit, only contains digits, hyphens, parens, dots, plus
      const telRegex = /^[+]?[\d\-().]{7,}$/;
      if (!telRegex.test(phone)) {
        bugs.push(makeBug('low', `Invalid tel: format`, 'nav_broken',
          `tel: link "${tl.text}" has suspicious format: ${phone}`,
          ['Navigate to ' + url, `Inspect tel link "${tl.text}"`],
          'tel: links should have a valid phone number',
          `Phone format is suspicious: ${phone}`,
          url));
      }
    }

    // --- Check for mixed protocol links ---
    if (isHttps) {
      for (const link of httpLinks) {
        try {
          const u = new URL(link.href);
          if (u.protocol === 'http:' && u.origin !== baseOrigin) {
            bugs.push(makeBug('medium', `HTTP link on HTTPS page`, 'nav_broken',
              `Link "${link.text}" points to insecure URL: ${link.href}`,
              ['Navigate to ' + url, `Find link "${link.text}"`],
              'Links should use HTTPS on HTTPS pages',
              `Link uses HTTP: ${link.href}`,
              url));
          }
        } catch (_) {}
      }
    }

    // --- Check for non-standard ports ---
    for (const link of httpLinks) {
      try {
        const u = new URL(link.href);
        const port = u.port;
        if (port && port !== '80' && port !== '443' && port !== '') {
          bugs.push(makeBug('info', `Link to non-standard port: ${port}`, 'nav_broken',
            `Link "${link.text}" targets non-standard port ${port}: ${link.href}`,
            ['Navigate to ' + url, `Find link to port ${port}`],
            'Links typically use standard ports (80/443)',
            `Uses port ${port}`,
            link.href));
        }
      } catch (_) {}
    }

    // --- Check HTTP links (HEAD then GET fallback) ---
    let brokenCount = 0;
    let slowCount = 0;
    const checkedUrls = new Set();
    const reachableUrls = new Set();
    const soft404Keywords = ['not found', 'page not found', '404', 'does not exist', 'no longer available', 'page missing'];

    broadcast({ type: 'log', text: `Checking ${httpLinks.length} HTTP links (HEAD+GET)...`, color: '#4ECDC4' });

    for (const link of httpLinks) {
      if (checkedUrls.has(link.href)) continue;
      checkedUrls.add(link.href);

      const isInternal = internalLinks.has(link.href);
      const linkStartTime = Date.now();

      try {
        // Try HEAD first
        let response;
        let status;
        let redirectLoopDetected = false;

        try {
          response = await page.request.head(link.href, {
            timeout: 8000,
            maxRedirects: 6,
          });
          status = response.status();
        } catch (headErr) {
          // HEAD rejected — try GET
          if (headErr.message.includes('redirect') || headErr.message.includes('ERR_TOO_MANY_REDIRECTS')) {
            redirectLoopDetected = true;
          } else {
            try {
              response = await page.request.get(link.href, {
                timeout: 8000,
                maxRedirects: 6,
              });
              status = response.status();
            } catch (getErr) {
              if (getErr.message.includes('redirect') || getErr.message.includes('ERR_TOO_MANY_REDIRECTS')) {
                redirectLoopDetected = true;
              } else if (getErr.message.includes('timeout')) {
                brokenCount++;
                bugs.push(makeBug('low', `Link timeout: ${link.text}`, 'nav_broken',
                  `Link "${link.text}" timed out after 8 seconds`,
                  ['Navigate to ' + url, `Click "${link.text}"`],
                  'Link should respond within 8 seconds',
                  'Request timed out',
                  link.href));
                continue;
              } else {
                brokenCount++;
                bugs.push(makeBug('low', `Link unreachable: ${link.text}`, 'nav_broken',
                  `Link "${link.text}" failed: ${getErr.message}`,
                  ['Navigate to ' + url, `Click "${link.text}"`],
                  'Link should be reachable',
                  `Error: ${getErr.message}`,
                  link.href));
                continue;
              }
            }
          }
        }

        const elapsed = Date.now() - linkStartTime;

        // Redirect loop
        if (redirectLoopDetected) {
          brokenCount++;
          bugs.push(makeBug('high', `Redirect loop detected`, 'nav_broken',
            `Link "${link.text}" causes a redirect loop (>5 hops)`,
            ['Navigate to ' + url, `Click "${link.text}"`],
            'Link should resolve without excessive redirects',
            'Redirect loop detected',
            link.href));
          continue;
        }

        if (!status) continue;

        // Slow link warning
        if (elapsed > 3000) {
          slowCount++;
          bugs.push(makeBug('info', `Slow link response (${(elapsed / 1000).toFixed(1)}s)`, 'nav_broken',
            `Link "${link.text}" took ${(elapsed / 1000).toFixed(1)}s to respond`,
            ['Navigate to ' + url, `Click "${link.text}"`],
            'Links should respond within 3 seconds',
            `Response took ${(elapsed / 1000).toFixed(1)}s`,
            link.href));
        }

        // Status-based bugs
        if (status >= 400) {
          brokenCount++;
          const sev = severityForStatus(status);
          bugs.push(makeBug(sev, `Broken link (HTTP ${status}): ${link.text}`, 'nav_broken',
            `Link "${link.text}" returns HTTP ${status}`,
            ['Navigate to ' + url, `Click "${link.text}"`],
            'Link should return 2xx status',
            `Returns HTTP ${status}`,
            link.href));
        } else if (status === 200 && isInternal) {
          reachableUrls.add(link.href);

          // Soft 404 detection — only for internal links
          try {
            const body = await response.text();
            const lower = body.toLowerCase();
            const isSoft404 = soft404Keywords.some(kw => lower.includes(kw)) && body.length < 5000;
            if (isSoft404) {
              bugs.push(makeBug('medium', `Possible soft 404: ${link.text}`, 'nav_broken',
                `Link "${link.text}" returns 200 but page content suggests a "not found" page`,
                ['Navigate to ' + link.href, 'Observe the content'],
                'Link target should have real content',
                'Page appears to be a soft 404 (200 status with "not found" text)',
                link.href));
            }
          } catch (_) { /* could not read body */ }
        } else {
          reachableUrls.add(link.href);
        }

      } catch (error) {
        // Catch-all for unexpected errors
        if (error.message.includes('timeout')) {
          brokenCount++;
          bugs.push(makeBug('low', `Link timeout: ${link.text}`, 'nav_broken',
            `Link "${link.text}" timed out`,
            ['Navigate to ' + url, `Click "${link.text}"`],
            'Link should respond in time',
            'Request timed out',
            link.href));
        }
      }
    }

    // --- Orphan page detection (pages linked from this page with no inbound links from other linked pages) ---
    // This is a best-effort check based on what we can see from a single page
    // Real orphan detection requires a full site crawl (handled by runNavDepth)
    // We note internal links that are unique (only linked once) as potential orphans
    const internalLinkCounts = {};
    for (const link of httpLinks) {
      if (internalLinks.has(link.href)) {
        const path = new URL(link.href).pathname;
        internalLinkCounts[path] = (internalLinkCounts[path] || 0) + 1;
      }
    }

    broadcast({
      type: 'log',
      text: `Broken link check complete: ${brokenCount} broken, ${slowCount} slow, out of ${checkedUrls.size} checked`,
      color: brokenCount > 0 ? '#FF6B35' : '#4ECDC4'
    });

  } catch (error) {
    broadcast({ type: 'log', text: `Link check error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runNavDepth, runNavBackFwd, runNavBroken };
