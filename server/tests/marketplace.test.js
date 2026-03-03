const { v4: uuidv4 } = require('uuid');

/**
 * Marketplace/App Store Tests
 * - Store browsing
 * - Plugin/agent install flow
 * - Store search & filtering
 */

const STORE_SELECTORS = [
  'a[href*="store"]', 'a[href*="marketplace"]', 'a[href*="plugin"]',
  'a[href*="extension"]', 'a[href*="app"]', 'a[href*="add-on"]',
  '[aria-label*="store"]', '[aria-label*="marketplace"]',
  'nav a:has-text("Store")', 'nav a:has-text("Marketplace")',
  'nav a:has-text("Plugins")', 'nav a:has-text("Extensions")',
];

async function runStoreBrowse(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing app/plugin store browsing...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    // Try to find store/marketplace navigation
    let storeLink = null;
    for (const selector of STORE_SELECTORS) {
      try {
        storeLink = await page.$(selector);
        if (storeLink) {
          const isVisible = await storeLink.isVisible();
          if (isVisible) break;
          storeLink = null;
        }
      } catch {}
    }

    if (!storeLink) {
      broadcast({ type: 'log', text: 'No store/marketplace link found', color: '#F5A623' });
      return bugs;
    }

    // Navigate to store
    await storeLink.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    broadcast({ type: 'log', text: `Navigated to: ${page.url()}`, color: '#4ECDC4' });

    // Check for store content
    const storeContent = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="card"], [class*="tile"], [class*="item"], [class*="plugin"], [class*="app"]');
      const images = document.querySelectorAll('img');
      const headings = document.querySelectorAll('h1, h2, h3, h4');

      return {
        cardCount: cards.length,
        imageCount: images.length,
        headingCount: headings.length,
        hasBrokenImages: Array.from(images).some(img => !img.complete || img.naturalHeight === 0)
      };
    });

    if (storeContent.cardCount === 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: 'Empty store listings',
        category: 'App Store & Plugins',
        testId: 'store_browse',
        description: 'Store/marketplace page shows no app/plugin cards',
        stepsToReproduce: ['Navigate to ' + url, 'Click on Store/Marketplace link'],
        expected: 'Store should display available apps/plugins',
        actual: 'No listings visible',
        url: page.url(),
        timestamp: new Date().toISOString()
      });
    }

    if (storeContent.hasBrokenImages) {
      bugs.push({
        id: uuidv4(),
        severity: 'low',
        title: 'Broken images in store',
        category: 'App Store & Plugins',
        testId: 'store_browse',
        description: 'Some images failed to load in the store listing',
        stepsToReproduce: ['Navigate to store', 'Observe image placeholders'],
        expected: 'All images should load',
        actual: 'Some images are broken',
        url: page.url(),
        timestamp: new Date().toISOString()
      });
    }

    // Try clicking on a listing
    const listingLink = await page.$('[class*="card"] a, [class*="tile"] a, [class*="item"] a');
    if (listingLink) {
      try {
        await listingLink.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1500);

        const detailContent = await page.content();
        if (detailContent.includes('404') || detailContent.includes('not found')) {
          bugs.push({
            id: uuidv4(),
            severity: 'medium',
            title: 'Store item detail page 404',
            category: 'App Store & Plugins',
            testId: 'store_browse',
            description: 'Clicking on store listing leads to 404 page',
            stepsToReproduce: ['Navigate to store', 'Click on an item'],
            expected: 'Item detail page should load',
            actual: '404 error',
            url: page.url(),
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {
        // Navigation might fail
      }
    }

    broadcast({ type: 'log', text: 'Store browsing test complete', color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Store browse error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runStoreInstall(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing plugin/agent install flow...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    // Navigate to store first
    let storeLink = null;
    for (const selector of STORE_SELECTORS) {
      try {
        storeLink = await page.$(selector);
        if (storeLink && await storeLink.isVisible()) break;
        storeLink = null;
      } catch {}
    }

    if (storeLink) {
      await storeLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    }

    // Look for install/add buttons
    const installButtons = await page.$$('button:has-text("Install"), button:has-text("Add"), button:has-text("Enable"), button:has-text("Get"), [aria-label*="install"], [aria-label*="add"]');

    if (installButtons.length === 0) {
      broadcast({ type: 'log', text: 'No install buttons found', color: '#F5A623' });
      return bugs;
    }

    // Try clicking an install button
    for (const btn of installButtons.slice(0, 2)) {
      try {
        const isVisible = await btn.isVisible();
        if (!isVisible) continue;

        const beforeContent = await page.content();
        await btn.click({ timeout: 3000 });
        await page.waitForTimeout(2000);
        const afterContent = await page.content();

        // Check for response
        const hasResponse = beforeContent !== afterContent ||
                           afterContent.toLowerCase().includes('installed') ||
                           afterContent.toLowerCase().includes('added') ||
                           afterContent.toLowerCase().includes('enabled');

        if (!hasResponse) {
          bugs.push({
            id: uuidv4(),
            severity: 'medium',
            title: 'Install button unresponsive',
            category: 'App Store & Plugins',
            testId: 'store_install',
            description: 'Install/Add button click produced no visible response',
            stepsToReproduce: ['Navigate to store', 'Click Install/Add button'],
            expected: 'Button should show feedback or start installation',
            actual: 'No visible response',
            url: page.url(),
            timestamp: new Date().toISOString()
          });
        }

        break;
      } catch (e) {
        // Continue
      }
    }

    broadcast({ type: 'log', text: 'Install flow test complete', color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Install test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runStoreSearch(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing store search & filtering...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    // Navigate to store
    let storeLink = null;
    for (const selector of STORE_SELECTORS) {
      try {
        storeLink = await page.$(selector);
        if (storeLink && await storeLink.isVisible()) break;
        storeLink = null;
      } catch {}
    }

    if (storeLink) {
      await storeLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    }

    // Find search input in store
    const searchInput = await page.$('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"], [aria-label*="search"]');

    if (!searchInput) {
      broadcast({ type: 'log', text: 'No store search input found', color: '#F5A623' });
      return bugs;
    }

    // Test common search terms
    const searchTerms = ['productivity', 'writing', 'code'];

    for (const term of searchTerms) {
      try {
        await searchInput.fill(term);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);

        const results = await page.$$('[class*="card"], [class*="tile"], [class*="item"], [class*="result"]');

        if (results.length === 0) {
          bugs.push({
            id: uuidv4(),
            severity: 'low',
            title: `No results for "${term}"`,
            category: 'App Store & Plugins',
            testId: 'store_search',
            description: `Store search for common term "${term}" returned no results`,
            stepsToReproduce: ['Navigate to store', `Search for "${term}"`],
            expected: 'Common terms should return results',
            actual: 'No results found',
            url: page.url(),
            timestamp: new Date().toISOString()
          });
        }

        // Clear for next search
        await searchInput.fill('');
      } catch (e) {
        // Continue
      }
    }

    // Test filter/category dropdowns
    const filters = await page.$$('select, [role="listbox"], [class*="filter"], [class*="category"]');

    for (const filter of filters.slice(0, 2)) {
      try {
        const tagName = await filter.evaluate(el => el.tagName.toLowerCase());
        if (tagName === 'select') {
          const options = await filter.$$('option');
          if (options.length > 1) {
            await filter.selectOption({ index: 1 });
            await page.waitForTimeout(1000);
          }
        } else {
          await filter.click({ timeout: 2000 });
          await page.waitForTimeout(500);
        }
      } catch (e) {
        // Filter might not be interactive
      }
    }

    broadcast({ type: 'log', text: 'Store search test complete', color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Store search error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runStoreBrowse, runStoreInstall, runStoreSearch };
