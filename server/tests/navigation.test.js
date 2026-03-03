const { v4: uuidv4 } = require('uuid');

/**
 * Navigation Tests
 * - URL depth crawl (2-3 levels)
 * - Forward/Back navigation
 * - Broken link detection
 */

async function runNavDepth(page, url, options, broadcast) {
  const bugs = [];
  const visited = new Set();
  const maxDepth = 2;

  broadcast({ type: 'log', text: 'Starting URL depth crawl...', color: '#4ECDC4' });

  async function crawl(currentUrl, depth) {
    if (depth > maxDepth || visited.has(currentUrl)) return;
    visited.add(currentUrl);

    try {
      await page.goto(currentUrl, {
        waitUntil: 'domcontentloaded',
        timeout: (options.timeout || 30) * 1000
      });

      // Check for empty title
      const title = await page.title();
      if (!title || title.trim() === '') {
        bugs.push({
          id: uuidv4(),
          severity: 'medium',
          title: 'Empty page title',
          category: 'Navigation & Routing',
          testId: 'nav_depth',
          description: `Page at ${currentUrl} has an empty or missing title tag`,
          stepsToReproduce: ['Navigate to ' + currentUrl, 'Check page title'],
          expected: 'Page should have a descriptive title',
          actual: 'Title is empty or missing',
          url: currentUrl,
          timestamp: new Date().toISOString()
        });
      }

      // Collect same-origin links
      const baseOrigin = new URL(url).origin;
      const links = await page.evaluate((origin) => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href => {
            try {
              const u = new URL(href);
              return u.origin === origin && !href.includes('#');
            } catch { return false; }
          })
          .filter((v, i, arr) => arr.indexOf(v) === i) // unique
          .slice(0, 10);
      }, baseOrigin);

      broadcast({ type: 'log', text: `Found ${links.length} links at depth ${depth}`, color: '#4ECDC4' });

      // Crawl child links (limit to avoid too much time)
      for (const link of links.slice(0, 5)) {
        if (!visited.has(link)) {
          await crawl(link, depth + 1);
        }
      }
    } catch (error) {
      bugs.push({
        id: uuidv4(),
        severity: 'high',
        title: 'Page load failure',
        category: 'Navigation & Routing',
        testId: 'nav_depth',
        description: `Failed to load page: ${error.message}`,
        stepsToReproduce: ['Navigate to ' + currentUrl],
        expected: 'Page should load successfully',
        actual: `Error: ${error.message}`,
        url: currentUrl,
        timestamp: new Date().toISOString()
      });
    }
  }

  await crawl(url, 0);
  broadcast({ type: 'log', text: `Crawled ${visited.size} pages`, color: '#4ECDC4' });

  return bugs;
}

async function runNavBackFwd(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing back/forward navigation...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });
    const originalUrl = page.url();

    // Find same-origin links
    const baseOrigin = new URL(url).origin;
    const links = await page.evaluate((origin) => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href)
        .filter(href => {
          try {
            return new URL(href).origin === origin;
          } catch { return false; }
        })
        .slice(0, 5);
    }, baseOrigin);

    if (links.length > 0) {
      // Click the first link
      await page.click(`a[href="${links[0]}"]`);
      await page.waitForLoadState('domcontentloaded');
      const newUrl = page.url();

      broadcast({ type: 'log', text: `Navigated to: ${newUrl}`, color: '#4ECDC4' });

      // Go back
      await page.goBack({ waitUntil: 'domcontentloaded' });
      const afterBack = page.url();

      if (!afterBack.includes(new URL(originalUrl).pathname)) {
        bugs.push({
          id: uuidv4(),
          severity: 'medium',
          title: 'Back navigation URL mismatch',
          category: 'Navigation & Routing',
          testId: 'nav_back_fwd',
          description: 'Browser back button did not return to original URL',
          stepsToReproduce: ['Navigate to ' + originalUrl, 'Click a link', 'Press back'],
          expected: `URL should return to ${originalUrl}`,
          actual: `URL is ${afterBack}`,
          url: originalUrl,
          timestamp: new Date().toISOString()
        });
      }

      // Go forward
      await page.goForward({ waitUntil: 'domcontentloaded' });
      const afterForward = page.url();

      if (!afterForward.includes(new URL(newUrl).pathname)) {
        bugs.push({
          id: uuidv4(),
          severity: 'medium',
          title: 'Forward navigation URL mismatch',
          category: 'Navigation & Routing',
          testId: 'nav_back_fwd',
          description: 'Browser forward button did not return to expected URL',
          stepsToReproduce: ['Navigate to ' + originalUrl, 'Click link', 'Press back', 'Press forward'],
          expected: `URL should be ${newUrl}`,
          actual: `URL is ${afterForward}`,
          url: originalUrl,
          timestamp: new Date().toISOString()
        });
      }

      broadcast({ type: 'log', text: 'Back/forward navigation test complete', color: '#4ECDC4' });
    } else {
      broadcast({ type: 'log', text: 'No same-origin links found to test', color: '#F5A623' });
    }
  } catch (error) {
    broadcast({ type: 'log', text: `Navigation test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runNavBroken(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Checking for broken links...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ href: a.href, text: a.textContent?.trim().slice(0, 50) || 'No text' }))
        .filter(l => l.href.startsWith('http'))
        .filter((v, i, arr) => arr.findIndex(x => x.href === v.href) === i) // unique
        .slice(0, 20);
    });

    broadcast({ type: 'log', text: `Checking ${links.length} links...`, color: '#4ECDC4' });

    let brokenCount = 0;
    for (const link of links) {
      try {
        const response = await page.request.head(link.href, { timeout: 5000 });
        const status = response.status();

        if (status >= 400) {
          brokenCount++;
          bugs.push({
            id: uuidv4(),
            severity: status === 404 ? 'medium' : 'low',
            title: `Broken link (HTTP ${status})`,
            category: 'Navigation & Routing',
            testId: 'nav_broken',
            description: `Link "${link.text}" returns HTTP ${status}`,
            stepsToReproduce: ['Navigate to ' + url, 'Click link: ' + link.text],
            expected: 'Link should return 2xx status',
            actual: `Returns ${status}`,
            url: link.href,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        // Timeout or network error - could be a broken link
        if (error.message.includes('timeout')) {
          brokenCount++;
          bugs.push({
            id: uuidv4(),
            severity: 'low',
            title: 'Link timeout',
            category: 'Navigation & Routing',
            testId: 'nav_broken',
            description: `Link "${link.text}" timed out`,
            stepsToReproduce: ['Navigate to ' + url, 'Click link: ' + link.text],
            expected: 'Link should respond within 5 seconds',
            actual: 'Request timed out',
            url: link.href,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    broadcast({
      type: 'log',
      text: `Found ${brokenCount} broken/timeout links out of ${links.length}`,
      color: brokenCount > 0 ? '#FF6B35' : '#4ECDC4'
    });
  } catch (error) {
    broadcast({ type: 'log', text: `Link check error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runNavDepth, runNavBackFwd, runNavBroken };
