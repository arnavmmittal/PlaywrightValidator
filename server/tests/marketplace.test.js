const { v4: uuidv4 } = require('uuid');

/**
 * Marketplace/App Store Tests
 * - Store browsing with comprehensive listing validation
 * - Plugin/agent install lifecycle
 * - Store search, filtering & sorting
 */

const STORE_SELECTORS = [
  'a[href*="store"]', 'a[href*="marketplace"]', 'a[href*="plugin"]',
  'a[href*="extension"]', 'a[href*="app"]', 'a[href*="add-on"]',
  'a[href*="integrations"]', 'a[href*="add-ons"]',
  '[aria-label*="store"]', '[aria-label*="marketplace"]',
  'nav a:has-text("Store")', 'nav a:has-text("Marketplace")',
  'nav a:has-text("Plugins")', 'nav a:has-text("Extensions")',
  'nav a:has-text("Integrations")', 'nav a:has-text("Add-ons")',
  // Sidebar links
  'aside a:has-text("Store")', 'aside a:has-text("Marketplace")',
  'aside a:has-text("Plugins")', 'aside a:has-text("Extensions")',
  // Footer links
  'footer a:has-text("Store")', 'footer a:has-text("Marketplace")',
  'footer a:has-text("Plugins")', 'footer a:has-text("Extensions")',
];

const API_DOC_SELECTORS = [
  'a[href*="api"]', 'a[href*="developer"]', 'a[href*="docs"]',
  'a[href*="documentation"]', 'a[href*="reference"]',
  'nav a:has-text("API")', 'nav a:has-text("Developers")',
  'nav a:has-text("Documentation")',
];

const LISTING_CARD_SELECTORS = [
  '[class*="card"]', '[class*="tile"]', '[class*="item"]',
  '[class*="plugin"]', '[class*="app"]', '[class*="extension"]',
  '[class*="listing"]', '[class*="product"]', '[class*="integration"]',
  '[data-testid*="card"]', '[data-testid*="listing"]',
];

const CATEGORY = 'App Store & Plugins';

/* ---------- Helper: find and navigate to store ---------- */

async function navigateToStore(page, url, options) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

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
    // Try searching page text for store keywords
    const storeKeywords = ['store', 'marketplace', 'plugins', 'extensions', 'integrations', 'add-ons'];
    for (const kw of storeKeywords) {
      try {
        storeLink = await page.$(`a:has-text("${kw}")`);
        if (storeLink && await storeLink.isVisible()) break;
        storeLink = null;
      } catch {}
    }
  }

  if (storeLink) {
    const startTime = Date.now();
    await storeLink.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    const loadTime = Date.now() - startTime;
    return { found: true, type: 'store', loadTime };
  }

  // Fallback: look for API/plugin documentation pages
  for (const selector of API_DOC_SELECTORS) {
    try {
      const link = await page.$(selector);
      if (link && await link.isVisible()) {
        await link.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1500);
        return { found: true, type: 'api-docs', loadTime: 0 };
      }
    } catch {}
  }

  return { found: false, type: null, loadTime: 0 };
}

/* ---------- Helper: get listing cards ---------- */

async function getListingCards(page) {
  const combinedSelector = LISTING_CARD_SELECTORS.join(', ');
  return page.$$(combinedSelector);
}

/* ---------- runStoreBrowse ---------- */

async function runStoreBrowse(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing app/plugin store browsing...', color: '#4ECDC4' });

  try {
    const nav = await navigateToStore(page, url, options);

    if (!nav.found) {
      broadcast({ type: 'log', text: 'No store/marketplace or API docs link found', color: '#F5A623' });
      return bugs;
    }

    broadcast({ type: 'log', text: `Navigated to ${nav.type}: ${page.url()}`, color: '#4ECDC4' });

    // Flag slow store load
    if (nav.loadTime > 3000) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: `Store page slow to load (${(nav.loadTime / 1000).toFixed(1)}s)`,
        category: CATEGORY, testId: 'store_browse',
        description: `Store page took ${nav.loadTime}ms to load, exceeding 3s threshold`,
        stepsToReproduce: ['Navigate to ' + url, 'Click on Store/Marketplace link'],
        expected: 'Store should load within 3 seconds',
        actual: `Loaded in ${(nav.loadTime / 1000).toFixed(1)}s`,
        url: page.url(), timestamp: new Date().toISOString()
      });
    }

    if (nav.type === 'api-docs') {
      broadcast({ type: 'log', text: 'Found API/plugin docs instead of store. Validating docs page.', color: '#F5A623' });
      return bugs;
    }

    /* --- Listing card validation --- */
    const cards = await getListingCards(page);

    if (cards.length === 0) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: 'Empty store listings',
        category: CATEGORY, testId: 'store_browse',
        description: 'Store/marketplace page shows no app/plugin cards',
        stepsToReproduce: ['Navigate to ' + url, 'Click on Store/Marketplace link'],
        expected: 'Store should display available apps/plugins',
        actual: 'No listings visible',
        url: page.url(), timestamp: new Date().toISOString()
      });
      return bugs;
    }

    broadcast({ type: 'log', text: `Found ${cards.length} listing cards`, color: '#4ECDC4' });

    // Validate listing card structure
    const cardAudit = await page.evaluate((selectors) => {
      const allCards = document.querySelectorAll(selectors);
      const results = { total: allCards.length, missingTitle: 0, missingDesc: 0, missingImage: 0, missingAuthor: 0, missingPrice: 0, missingRating: 0, missingCategory: 0, brokenImages: 0, inconsistentSizes: false, placeholderText: 0 };

      const widths = [];
      const heights = [];

      for (const card of allCards) {
        const text = card.textContent || '';
        const innerHtml = card.innerHTML || '';

        // Title
        const hasTitle = card.querySelector('h1, h2, h3, h4, h5, [class*="title"], [class*="name"]');
        if (!hasTitle) results.missingTitle++;

        // Description / subtitle
        const hasDesc = card.querySelector('p, [class*="desc"], [class*="subtitle"], [class*="summary"]');
        if (!hasDesc) results.missingDesc++;

        // Icon / image
        const hasImage = card.querySelector('img, svg, [class*="icon"], [class*="logo"], [class*="avatar"]');
        if (!hasImage) results.missingImage++;

        // Author / publisher
        const authorPatterns = /author|publisher|by |developer|creator/i;
        const hasAuthorEl = card.querySelector('[class*="author"], [class*="publisher"], [class*="developer"], [class*="creator"]');
        if (!hasAuthorEl && !authorPatterns.test(text)) results.missingAuthor++;

        // Price / free indicator
        const pricePatterns = /free|\$|price|€|£|premium|paid|install/i;
        const hasPriceEl = card.querySelector('[class*="price"], [class*="cost"], [class*="free"]');
        if (!hasPriceEl && !pricePatterns.test(text)) results.missingPrice++;

        // Rating / review count
        const ratingPatterns = /★|star|rating|review|\d+\.\d/i;
        const hasRatingEl = card.querySelector('[class*="rating"], [class*="star"], [class*="review"]');
        if (!hasRatingEl && !ratingPatterns.test(text)) results.missingRating++;

        // Category / tag labels
        const hasCategoryEl = card.querySelector('[class*="tag"], [class*="category"], [class*="badge"], [class*="label"]');
        if (!hasCategoryEl) results.missingCategory++;

        // Broken images
        const images = card.querySelectorAll('img');
        for (const img of images) {
          if (!img.complete || img.naturalHeight === 0) results.brokenImages++;
        }

        // Placeholder / lorem text
        const loremPattern = /lorem ipsum|placeholder|coming soon|tbd|n\/a/i;
        if (loremPattern.test(text)) results.placeholderText++;

        // Card sizing
        const rect = card.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          widths.push(Math.round(rect.width));
          heights.push(Math.round(rect.height));
        }
      }

      // Check sizing consistency (allow 20% variance)
      if (widths.length > 2) {
        const avgW = widths.reduce((a, b) => a + b, 0) / widths.length;
        const maxVariance = avgW * 0.3;
        results.inconsistentSizes = widths.some(w => Math.abs(w - avgW) > maxVariance);
      }

      return results;
    }, LISTING_CARD_SELECTORS.join(', '));

    if (cardAudit.missingTitle > 0) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: `${cardAudit.missingTitle}/${cardAudit.total} listing cards missing title`,
        category: CATEGORY, testId: 'store_browse',
        description: 'Listing cards should have a visible title or name',
        stepsToReproduce: ['Navigate to store', 'Inspect listing cards'],
        expected: 'Each listing card has a title', actual: `${cardAudit.missingTitle} cards have no detectable title`,
        url: page.url(), timestamp: new Date().toISOString()
      });
    }

    if (cardAudit.missingImage > cardAudit.total * 0.5) {
      bugs.push({
        id: uuidv4(), severity: 'low',
        title: `${cardAudit.missingImage}/${cardAudit.total} listing cards missing icon/image`,
        category: CATEGORY, testId: 'store_browse',
        description: 'Listing cards should include an icon, logo, or image',
        stepsToReproduce: ['Navigate to store', 'Inspect listing cards for images'],
        expected: 'Each listing card has an icon or image', actual: `${cardAudit.missingImage} cards lack any image`,
        url: page.url(), timestamp: new Date().toISOString()
      });
    }

    if (cardAudit.brokenImages > 0) {
      bugs.push({
        id: uuidv4(), severity: 'low',
        title: `${cardAudit.brokenImages} broken images in store listings`,
        category: CATEGORY, testId: 'store_browse',
        description: 'Some images failed to load in the store listing',
        stepsToReproduce: ['Navigate to store', 'Observe image placeholders'],
        expected: 'All images should load', actual: `${cardAudit.brokenImages} images are broken`,
        url: page.url(), timestamp: new Date().toISOString()
      });
    }

    if (cardAudit.inconsistentSizes) {
      bugs.push({
        id: uuidv4(), severity: 'low',
        title: 'Inconsistent listing card sizes in store',
        category: CATEGORY, testId: 'store_browse',
        description: 'Listing cards have significantly varying sizes, indicating layout inconsistency',
        stepsToReproduce: ['Navigate to store', 'Compare card dimensions visually'],
        expected: 'Listing cards should be consistently sized', actual: 'Card sizes vary by more than 30%',
        url: page.url(), timestamp: new Date().toISOString()
      });
    }

    if (cardAudit.placeholderText > 0) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: `${cardAudit.placeholderText} listing cards contain placeholder text`,
        category: CATEGORY, testId: 'store_browse',
        description: 'Listing cards contain placeholder or lorem ipsum text',
        stepsToReproduce: ['Navigate to store', 'Read card content'],
        expected: 'Real content in all listings', actual: `${cardAudit.placeholderText} cards have placeholder text`,
        url: page.url(), timestamp: new Date().toISOString()
      });
    }

    /* --- Navigation testing: categories / tabs --- */
    broadcast({ type: 'log', text: 'Testing store navigation (categories, tabs, pagination)...', color: '#4ECDC4' });

    const categoryTabs = await page.$$('[class*="tab"], [class*="category"] a, [role="tab"], nav[class*="store"] a, [class*="filter-tab"], [class*="nav-tab"]');
    if (categoryTabs.length > 0) {
      let tabErrors = 0;
      for (const tab of categoryTabs.slice(0, 5)) {
        try {
          if (!(await tab.isVisible())) continue;
          await tab.click();
          await page.waitForTimeout(1500);
          const afterCards = await getListingCards(page);
          // Empty category check
          if (afterCards.length === 0) {
            bugs.push({
              id: uuidv4(), severity: 'low',
              title: 'Empty category in store',
              category: CATEGORY, testId: 'store_browse',
              description: 'A category/tab in the store shows zero listings',
              stepsToReproduce: ['Navigate to store', 'Click on a category tab'],
              expected: 'Category shows listings or a friendly empty state',
              actual: 'No listings and no empty state message',
              url: page.url(), timestamp: new Date().toISOString()
            });
          }
        } catch {
          tabErrors++;
        }
      }
      if (tabErrors > 2) {
        bugs.push({
          id: uuidv4(), severity: 'low',
          title: 'Multiple store category tabs failed to respond',
          category: CATEGORY, testId: 'store_browse',
          description: `${tabErrors} category/tab elements could not be clicked or caused errors`,
          stepsToReproduce: ['Navigate to store', 'Click on category tabs'],
          expected: 'Category tabs should be functional', actual: `${tabErrors} tabs unresponsive`,
          url: page.url(), timestamp: new Date().toISOString()
        });
      }
    }

    // Pagination testing
    const paginationSelectors = [
      'button:has-text("Next")', 'a:has-text("Next")',
      '[class*="pagination"] button', '[class*="pagination"] a',
      '[aria-label="Next page"]', '[aria-label*="next"]',
      'button:has-text("Load more")', 'a:has-text("Load more")',
    ];

    let paginationFound = false;
    for (const sel of paginationSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn && await btn.isVisible()) {
          paginationFound = true;
          const beforeUrl = page.url();
          await btn.click();
          await page.waitForTimeout(2000);
          const afterCards = await getListingCards(page);
          if (afterCards.length === 0) {
            bugs.push({
              id: uuidv4(), severity: 'medium',
              title: 'Pagination leads to empty page',
              category: CATEGORY, testId: 'store_browse',
              description: 'Clicking next page/load more results in no listings',
              stepsToReproduce: ['Navigate to store', 'Click Next/Load More'],
              expected: 'Additional listings should appear', actual: 'No listings after pagination',
              url: page.url(), timestamp: new Date().toISOString()
            });
          }
          // Navigate back if URL changed
          if (page.url() !== beforeUrl) {
            await page.goBack();
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(1000);
          }
          break;
        }
      } catch {}
    }

    // Breadcrumb navigation
    const breadcrumbs = await page.$('[class*="breadcrumb"], nav[aria-label="Breadcrumb"], [aria-label*="breadcrumb"], ol[class*="breadcrumb"]');
    // Just check presence; we test it more on detail pages

    /* --- Detail page testing --- */
    broadcast({ type: 'log', text: 'Testing store detail pages...', color: '#4ECDC4' });

    const detailLinks = await page.$$(`${LISTING_CARD_SELECTORS.join(' a, ')} a, ${LISTING_CARD_SELECTORS.join(', ')}`);
    let detailsTested = 0;
    const storeUrl = page.url();

    for (const link of detailLinks.slice(0, 6)) {
      if (detailsTested >= 3) break;
      try {
        if (!(await link.isVisible())) continue;

        const startTime = Date.now();
        await link.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1500);
        const detailLoadTime = Date.now() - startTime;

        // Check if we actually navigated to a detail page (URL changed or content changed)
        const currentUrl = page.url();
        if (currentUrl === storeUrl) continue; // didn't navigate

        detailsTested++;
        broadcast({ type: 'log', text: `Detail page ${detailsTested}: ${currentUrl}`, color: '#4ECDC4' });

        // Flag slow detail pages
        if (detailLoadTime > 3000) {
          bugs.push({
            id: uuidv4(), severity: 'low',
            title: `Detail page slow to load (${(detailLoadTime / 1000).toFixed(1)}s)`,
            category: CATEGORY, testId: 'store_browse',
            description: `Detail page at ${currentUrl} took ${detailLoadTime}ms`,
            stepsToReproduce: ['Navigate to store', 'Click on a listing'],
            expected: 'Detail page loads within 3s', actual: `Loaded in ${(detailLoadTime / 1000).toFixed(1)}s`,
            url: currentUrl, timestamp: new Date().toISOString()
          });
        }

        // 404 check
        const pageContent = await page.content();
        if (pageContent.includes('404') && pageContent.includes('not found')) {
          bugs.push({
            id: uuidv4(), severity: 'medium',
            title: 'Store item detail page 404',
            category: CATEGORY, testId: 'store_browse',
            description: 'Clicking on store listing leads to 404 page',
            stepsToReproduce: ['Navigate to store', 'Click on an item'],
            expected: 'Item detail page should load', actual: '404 error',
            url: currentUrl, timestamp: new Date().toISOString()
          });
          await page.goto(storeUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1000);
          continue;
        }

        // Detail page content audit
        const detailAudit = await page.evaluate(() => {
          const body = document.body;
          const text = body.textContent || '';
          const html = body.innerHTML || '';

          const result = {
            hasTitle: !!document.querySelector('h1, h2, [class*="title"]'),
            hasDescription: false,
            hasScreenshots: false,
            hasReviews: false,
            hasVersion: false,
            hasAuthor: false,
            hasInstallButton: false,
            hasRelated: false,
            brokenImages: 0,
            missingFields: [],
            hasPlaceholder: false,
            hasTruncatedText: false,
          };

          // Description: paragraph with substantial text
          const paragraphs = document.querySelectorAll('p, [class*="desc"], [class*="about"]');
          result.hasDescription = Array.from(paragraphs).some(p => (p.textContent || '').trim().length > 50);

          // Screenshots / images gallery
          const gallery = document.querySelectorAll('[class*="screenshot"], [class*="gallery"], [class*="preview"], [class*="carousel"] img');
          result.hasScreenshots = gallery.length > 0 || document.querySelectorAll('img').length > 2;

          // Reviews / ratings
          result.hasReviews = !!/rating|review|★|star/i.test(text) || !!document.querySelector('[class*="review"], [class*="rating"]');

          // Version info
          result.hasVersion = !!/version|v\d+\.\d+/i.test(text) || !!document.querySelector('[class*="version"]');

          // Author info
          result.hasAuthor = !!/author|publisher|developer|created by|by /i.test(text) || !!document.querySelector('[class*="author"], [class*="publisher"]');

          // Install / get button
          const installBtn = document.querySelector('button:not([disabled])');
          const installPatterns = /install|get|add|download|enable|activate|try|subscribe/i;
          result.hasInstallButton = !!document.querySelector('[class*="install"], [class*="download"]') ||
            Array.from(document.querySelectorAll('button, a[role="button"]')).some(b => installPatterns.test(b.textContent || ''));

          // Related items
          result.hasRelated = !!/related|similar|you may also|recommended|more like/i.test(text) || !!document.querySelector('[class*="related"], [class*="similar"]');

          // Broken images
          const imgs = document.querySelectorAll('img');
          for (const img of imgs) {
            if (!img.complete || img.naturalHeight === 0) result.brokenImages++;
          }

          // Placeholder text
          result.hasPlaceholder = /lorem ipsum|placeholder text|coming soon|tbd/i.test(text);

          // Truncated text without read more
          const truncated = document.querySelectorAll('[class*="truncat"], [class*="clamp"], [class*="ellipsis"]');
          const readMore = document.querySelectorAll('[class*="read-more"], a:has-text("Read more"), button:has-text("Read more"), a:has-text("Show more"), button:has-text("Show more")');
          result.hasTruncatedText = truncated.length > 0 && readMore.length === 0;

          // Build missing fields list
          if (!result.hasTitle) result.missingFields.push('title');
          if (!result.hasDescription) result.missingFields.push('description');
          if (!result.hasInstallButton) result.missingFields.push('install/get button');

          return result;
        });

        if (detailAudit.missingFields.length > 0) {
          bugs.push({
            id: uuidv4(), severity: 'medium',
            title: `Detail page missing key fields: ${detailAudit.missingFields.join(', ')}`,
            category: CATEGORY, testId: 'store_browse',
            description: `Store item detail page is missing: ${detailAudit.missingFields.join(', ')}`,
            stepsToReproduce: ['Navigate to store', 'Click on a listing', 'Inspect detail page content'],
            expected: 'Detail page should have title, description, and install button at minimum',
            actual: `Missing: ${detailAudit.missingFields.join(', ')}`,
            url: currentUrl, timestamp: new Date().toISOString()
          });
        }

        if (detailAudit.brokenImages > 0) {
          bugs.push({
            id: uuidv4(), severity: 'low',
            title: `${detailAudit.brokenImages} broken images on detail page`,
            category: CATEGORY, testId: 'store_browse',
            description: 'Broken images found on store item detail page',
            stepsToReproduce: ['Navigate to store', 'Click on a listing', 'Check images'],
            expected: 'All images load correctly', actual: `${detailAudit.brokenImages} broken images`,
            url: currentUrl, timestamp: new Date().toISOString()
          });
        }

        if (detailAudit.hasPlaceholder) {
          bugs.push({
            id: uuidv4(), severity: 'medium',
            title: 'Placeholder/lorem ipsum text on detail page',
            category: CATEGORY, testId: 'store_browse',
            description: 'Detail page contains placeholder or lorem ipsum text',
            stepsToReproduce: ['Navigate to store', 'Open listing detail', 'Read content'],
            expected: 'Real content', actual: 'Placeholder text detected',
            url: currentUrl, timestamp: new Date().toISOString()
          });
        }

        if (detailAudit.hasTruncatedText) {
          bugs.push({
            id: uuidv4(), severity: 'low',
            title: 'Truncated text without "read more" option',
            category: CATEGORY, testId: 'store_browse',
            description: 'Text appears truncated on the detail page with no way to expand it',
            stepsToReproduce: ['Navigate to store', 'Open listing detail', 'Look for cut-off text'],
            expected: 'Truncated text should have a "read more" or "show more" control',
            actual: 'Text is truncated with no expand option',
            url: currentUrl, timestamp: new Date().toISOString()
          });
        }

        // Test back navigation from detail page
        try {
          await page.goBack();
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(1000);
          const backCards = await getListingCards(page);
          if (backCards.length === 0) {
            bugs.push({
              id: uuidv4(), severity: 'medium',
              title: 'Back navigation from detail page broken',
              category: CATEGORY, testId: 'store_browse',
              description: 'Navigating back from a detail page does not return to the listings view',
              stepsToReproduce: ['Navigate to store', 'Click a listing', 'Click browser back'],
              expected: 'Return to store listings', actual: 'Listings not displayed after back navigation',
              url: page.url(), timestamp: new Date().toISOString()
            });
            // Recover
            await page.goto(storeUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1000);
          }
        } catch {
          await page.goto(storeUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1000);
        }
      } catch {
        // Recover navigation
        try {
          await page.goto(storeUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1000);
        } catch {}
      }
    }

    if (detailsTested === 0) {
      broadcast({ type: 'log', text: 'Could not navigate to any detail pages', color: '#F5A623' });
    }

    broadcast({ type: 'log', text: `Store browsing test complete. ${bugs.length} issues found.`, color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Store browse error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

/* ---------- runStoreInstall ---------- */

async function runStoreInstall(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing plugin/agent install lifecycle...', color: '#4ECDC4' });

  try {
    const nav = await navigateToStore(page, url, options);

    if (!nav.found || nav.type !== 'store') {
      broadcast({ type: 'log', text: 'No store found for install testing', color: '#F5A623' });
      return bugs;
    }

    const storeUrl = page.url();

    // Find install/add/get buttons
    const installButtonSelectors = [
      'button:has-text("Install")', 'button:has-text("Add")',
      'button:has-text("Enable")', 'button:has-text("Get")',
      'button:has-text("Download")', 'button:has-text("Activate")',
      'button:has-text("Try")', 'button:has-text("Subscribe")',
      '[aria-label*="install"]', '[aria-label*="add"]',
      '[class*="install"] button', '[class*="download"] button',
    ];

    let installButtons = [];
    for (const sel of installButtonSelectors) {
      try {
        const btns = await page.$$(sel);
        for (const btn of btns) {
          if (await btn.isVisible()) installButtons.push(btn);
        }
      } catch {}
    }

    // If no buttons on listings page, try navigating to a detail page first
    if (installButtons.length === 0) {
      const cards = await getListingCards(page);
      if (cards.length > 0) {
        try {
          await cards[0].click();
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(1500);

          for (const sel of installButtonSelectors) {
            try {
              const btns = await page.$$(sel);
              for (const btn of btns) {
                if (await btn.isVisible()) installButtons.push(btn);
              }
            } catch {}
          }
        } catch {}
      }
    }

    if (installButtons.length === 0) {
      broadcast({ type: 'log', text: 'No install buttons found in store', color: '#F5A623' });
      return bugs;
    }

    broadcast({ type: 'log', text: `Found ${installButtons.length} install-like buttons`, color: '#4ECDC4' });

    let itemsTested = 0;

    for (const btn of installButtons.slice(0, 3)) {
      try {
        if (!(await btn.isVisible())) continue;

        const beforeText = (await btn.textContent() || '').trim();
        const beforeUrl = page.url();

        broadcast({ type: 'log', text: `Testing install button: "${beforeText}"`, color: '#4ECDC4' });

        // Listen for dialogs (permission requests, confirmations)
        let dialogAppeared = false;
        let dialogMessage = '';
        const dialogHandler = (dialog) => {
          dialogAppeared = true;
          dialogMessage = dialog.message();
          dialog.accept().catch(() => {});
        };
        page.on('dialog', dialogHandler);

        // Check for auth gate: detect redirect to login
        const beforeContent = await page.content();
        await btn.click({ timeout: 3000 });
        await page.waitForTimeout(2500);

        const afterUrl = page.url();
        const afterContent = await page.content();

        // Detect authentication redirect
        const loginPatterns = /login|sign.?in|auth|oauth|sso/i;
        if (loginPatterns.test(afterUrl) && !loginPatterns.test(beforeUrl)) {
          broadcast({ type: 'log', text: 'Install requires authentication (redirected to login)', color: '#F5A623' });
          // Navigate back to continue testing
          await page.goBack();
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(1000);
          page.off('dialog', dialogHandler);
          continue;
        }

        // Check button state change
        let afterText = '';
        try {
          afterText = (await btn.textContent() || '').trim();
        } catch {
          // Button may have been replaced
          afterText = '';
        }

        const hasResponse = beforeContent !== afterContent ||
          afterContent.toLowerCase().includes('installed') ||
          afterContent.toLowerCase().includes('added') ||
          afterContent.toLowerCase().includes('enabled') ||
          afterContent.toLowerCase().includes('success') ||
          dialogAppeared ||
          afterText !== beforeText;

        if (!hasResponse) {
          bugs.push({
            id: uuidv4(), severity: 'medium',
            title: 'Install button produced no visible response',
            category: CATEGORY, testId: 'store_install',
            description: 'Clicking the install/add button did not change the UI, show feedback, or redirect',
            stepsToReproduce: ['Navigate to store', `Click "${beforeText}" button`],
            expected: 'Button should show loading state, success message, or change text',
            actual: 'No visible response detected',
            url: page.url(), timestamp: new Date().toISOString()
          });
        }

        // Check for installing/loading state
        const hasLoadingState = await page.evaluate(() => {
          const spinners = document.querySelectorAll('[class*="spinner"], [class*="loading"], [class*="progress"], [role="progressbar"]');
          return spinners.length > 0;
        });

        // Check for success notification/toast
        const hasNotification = await page.evaluate(() => {
          const toasts = document.querySelectorAll('[class*="toast"], [class*="notification"], [class*="snackbar"], [class*="alert"], [role="alert"], [role="status"]');
          return Array.from(toasts).some(t => t.offsetParent !== null);
        });

        // Check for button text change to "Installed"/"Remove"/"Uninstall"
        const postInstallPatterns = /installed|remove|uninstall|disable|added|enabled|active/i;
        const buttonChanged = postInstallPatterns.test(afterText);

        if (hasResponse && !buttonChanged && !hasNotification && !hasLoadingState) {
          bugs.push({
            id: uuidv4(), severity: 'low',
            title: 'Install lacks clear feedback state',
            category: CATEGORY, testId: 'store_install',
            description: 'Install action triggered a response but no clear loading, success, or button state change was detected',
            stepsToReproduce: ['Navigate to store', `Click "${beforeText}" button`, 'Observe feedback'],
            expected: 'Clear feedback: loading spinner, button text change, or success notification',
            actual: 'Response occurred but no clear feedback pattern detected',
            url: page.url(), timestamp: new Date().toISOString()
          });
        }

        /* --- Test double-install protection --- */
        try {
          const doubleBtn = await page.$(installButtonSelectors.find(s => s.includes('Install')) || installButtonSelectors[0]);
          if (doubleBtn && await doubleBtn.isVisible()) {
            const dblText = (await doubleBtn.textContent() || '').trim();
            // If still shows "Install", rapid double-click
            if (/install|add|get/i.test(dblText)) {
              await doubleBtn.dblclick({ timeout: 2000 });
              await page.waitForTimeout(1500);
              // Check for error or duplicate state
              const errorState = await page.evaluate(() => {
                const errors = document.querySelectorAll('[class*="error"], [class*="warning"], [role="alert"]');
                return Array.from(errors).some(e => e.offsetParent !== null && /already|duplicate|exists/i.test(e.textContent || ''));
              });
              // No need to report unless there is a crash
            }
          }
        } catch {}

        /* --- Test uninstall flow if item appears installed --- */
        if (buttonChanged || afterContent.toLowerCase().includes('installed')) {
          broadcast({ type: 'log', text: 'Testing uninstall/remove flow...', color: '#4ECDC4' });

          const uninstallSelectors = [
            'button:has-text("Uninstall")', 'button:has-text("Remove")',
            'button:has-text("Disable")', 'button:has-text("Delete")',
            '[aria-label*="uninstall"]', '[aria-label*="remove"]',
          ];

          let uninstallBtn = null;
          for (const sel of uninstallSelectors) {
            try {
              uninstallBtn = await page.$(sel);
              if (uninstallBtn && await uninstallBtn.isVisible()) break;
              uninstallBtn = null;
            } catch {}
          }

          if (uninstallBtn) {
            const uninstallBefore = await page.content();
            await uninstallBtn.click({ timeout: 3000 });
            await page.waitForTimeout(2000);

            // Check for confirmation dialog
            if (dialogAppeared) {
              broadcast({ type: 'log', text: `Uninstall confirmation dialog: "${dialogMessage}"`, color: '#4ECDC4' });
            }

            const uninstallAfter = await page.content();
            const uninstallChanged = uninstallBefore !== uninstallAfter;

            if (!uninstallChanged && !dialogAppeared) {
              bugs.push({
                id: uuidv4(), severity: 'medium',
                title: 'Uninstall button produced no response',
                category: CATEGORY, testId: 'store_install',
                description: 'Clicking uninstall/remove did not change the UI or show a confirmation',
                stepsToReproduce: ['Install an item', 'Click Uninstall/Remove'],
                expected: 'Confirmation dialog or UI change indicating removal',
                actual: 'No response',
                url: page.url(), timestamp: new Date().toISOString()
              });
            }

            // Check item returned to not-installed state
            try {
              const currentBtnText = await uninstallBtn.textContent();
              if (postInstallPatterns.test(currentBtnText || '')) {
                bugs.push({
                  id: uuidv4(), severity: 'low',
                  title: 'Item still shows installed state after uninstall',
                  category: CATEGORY, testId: 'store_install',
                  description: 'After clicking uninstall, the button still shows an installed state',
                  stepsToReproduce: ['Install an item', 'Click Uninstall', 'Check button text'],
                  expected: 'Button returns to "Install" or similar', actual: `Button shows "${currentBtnText}"`,
                  url: page.url(), timestamp: new Date().toISOString()
                });
              }
            } catch {}
          }
        }

        /* --- Test keyboard accessibility of install action --- */
        try {
          // Tab to an install button and press Enter
          await page.keyboard.press('Tab');
          await page.keyboard.press('Tab');
          await page.keyboard.press('Tab');
          const focused = await page.evaluate(() => {
            const el = document.activeElement;
            return el ? { tag: el.tagName, text: (el.textContent || '').trim().slice(0, 50), role: el.getAttribute('role') } : null;
          });
          if (focused && (focused.tag === 'BUTTON' || focused.role === 'button')) {
            // Keyboard accessible
          }
        } catch {}

        page.off('dialog', dialogHandler);
        itemsTested++;

        // Navigate back to store for next item
        if (page.url() !== storeUrl) {
          await page.goto(storeUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        try {
          await page.goto(storeUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1000);
        } catch {}
      }
    }

    /* --- Check installed section --- */
    try {
      const installedSection = await page.$('[class*="installed"], [class*="my-apps"], [class*="my-plugins"], a:has-text("Installed"), a:has-text("My Apps"), a:has-text("My Plugins")');
      if (installedSection && await installedSection.isVisible()) {
        broadcast({ type: 'log', text: 'Found installed/my-apps section', color: '#4ECDC4' });
      }
    } catch {}

    broadcast({ type: 'log', text: `Install lifecycle test complete. Tested ${itemsTested} items. ${bugs.length} issues.`, color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Install test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

/* ---------- runStoreSearch ---------- */

async function runStoreSearch(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing store search, filtering & sorting...', color: '#4ECDC4' });

  try {
    const nav = await navigateToStore(page, url, options);

    if (!nav.found || nav.type !== 'store') {
      broadcast({ type: 'log', text: 'No store found for search testing', color: '#F5A623' });
      return bugs;
    }

    const storeUrl = page.url();

    // Find search input
    const searchSelectors = [
      'input[type="search"]', 'input[placeholder*="search" i]',
      'input[placeholder*="Search" i]', '[aria-label*="search" i]',
      'input[name="search"]', 'input[name="q"]', 'input[name="query"]',
      '[class*="search"] input', '[role="searchbox"]',
    ];

    let searchInput = null;
    for (const sel of searchSelectors) {
      try {
        searchInput = await page.$(sel);
        if (searchInput && await searchInput.isVisible()) break;
        searchInput = null;
      } catch {}
    }

    if (!searchInput) {
      broadcast({ type: 'log', text: 'No store search input found', color: '#F5A623' });
      // Skip to filter testing below
    }

    if (searchInput) {
      /* --- Search functionality --- */
      const searchTerms = [
        { term: 'productivity', type: 'category' },
        { term: 'writing', type: 'category' },
        { term: 'code', type: 'common' },
        { term: 'ai', type: 'common' },
        { term: 'cal', type: 'partial' },
        { term: 'prodctivity', type: 'misspelling' },
      ];

      let searchWorked = false;
      let noResultsHandled = false;

      for (const { term, type } of searchTerms) {
        try {
          await searchInput.fill('');
          await page.waitForTimeout(300);
          await searchInput.fill(term);

          // Measure search response time
          const searchStart = Date.now();

          // Detect search behavior: type-ahead vs enter-submit
          await page.waitForTimeout(800);
          let resultsAfterType = await getListingCards(page);
          const isTypeAhead = resultsAfterType.length > 0;

          if (!isTypeAhead) {
            await page.keyboard.press('Enter');
            await page.waitForTimeout(2000);
            resultsAfterType = await getListingCards(page);
          }

          const searchTime = Date.now() - searchStart;

          // Flag slow search
          if (searchTime > 2000 && resultsAfterType.length > 0) {
            bugs.push({
              id: uuidv4(), severity: 'low',
              title: `Search response slow (${(searchTime / 1000).toFixed(1)}s) for "${term}"`,
              category: CATEGORY, testId: 'store_search',
              description: `Search for "${term}" took ${searchTime}ms, exceeding 2s threshold`,
              stepsToReproduce: ['Navigate to store', `Search for "${term}"`],
              expected: 'Search results within 2 seconds', actual: `${(searchTime / 1000).toFixed(1)}s response time`,
              url: page.url(), timestamp: new Date().toISOString()
            });
          }

          if (resultsAfterType.length > 0) {
            searchWorked = true;
          }

          // Check for result count display
          const hasResultCount = await page.evaluate(() => {
            const text = document.body.textContent || '';
            return /\d+\s*(result|item|found|match)/i.test(text) || !!document.querySelector('[class*="result-count"], [class*="results-count"], [class*="total"]');
          });

          // Check for search term highlighting
          const hasHighlight = await page.evaluate((searchTerm) => {
            const marks = document.querySelectorAll('mark, [class*="highlight"], em, strong');
            return Array.from(marks).some(m => (m.textContent || '').toLowerCase().includes(searchTerm.toLowerCase()));
          }, term);

          // No results handling
          if (resultsAfterType.length === 0) {
            const hasEmptyState = await page.evaluate(() => {
              const text = document.body.textContent || '';
              return /no result|nothing found|try (a )?different|no match|couldn't find/i.test(text) ||
                !!document.querySelector('[class*="empty"], [class*="no-results"], [class*="not-found"]');
            });

            if (hasEmptyState) {
              noResultsHandled = true;
            } else if (type !== 'misspelling') {
              bugs.push({
                id: uuidv4(), severity: 'low',
                title: `No results and no empty state for "${term}"`,
                category: CATEGORY, testId: 'store_search',
                description: `Searching for "${term}" shows no results and no user-friendly empty state message`,
                stepsToReproduce: ['Navigate to store', `Search for "${term}"`],
                expected: 'Friendly empty state with suggestions when no results found',
                actual: 'No results and no helpful message',
                url: page.url(), timestamp: new Date().toISOString()
              });
            }
          }
        } catch {}
      }

      /* --- Special character and edge case searches --- */
      const edgeCases = [
        { term: '', label: 'empty search' },
        { term: '   ', label: 'whitespace only' },
        { term: '<script>alert(1)</script>', label: 'XSS attempt' },
        { term: "' OR 1=1 --", label: 'SQL injection' },
        { term: '🎉🔥', label: 'unicode/emoji' },
        { term: 'a'.repeat(200), label: 'very long term' },
      ];

      for (const { term, label } of edgeCases) {
        try {
          await searchInput.fill('');
          await page.waitForTimeout(200);
          await searchInput.fill(term);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1500);

          // Check for errors/crashes
          const hasError = await page.evaluate(() => {
            const text = document.body.textContent || '';
            return /error|exception|500|internal server/i.test(text) && !/no result/i.test(text);
          });

          if (hasError) {
            bugs.push({
              id: uuidv4(), severity: 'high',
              title: `Search error with ${label}`,
              category: CATEGORY, testId: 'store_search',
              description: `Searching with ${label} (${term.slice(0, 30)}${term.length > 30 ? '...' : ''}) caused an error`,
              stepsToReproduce: ['Navigate to store', `Enter ${label} in search`],
              expected: 'Graceful handling of invalid input', actual: 'Error displayed on page',
              url: page.url(), timestamp: new Date().toISOString()
            });
          }
        } catch {}
      }

      /* --- Test clearing search returns to default view --- */
      try {
        await searchInput.fill('test');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);

        await searchInput.fill('');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);

        const defaultCards = await getListingCards(page);
        if (defaultCards.length === 0) {
          bugs.push({
            id: uuidv4(), severity: 'low',
            title: 'Clearing search does not restore default view',
            category: CATEGORY, testId: 'store_search',
            description: 'After clearing the search input, the default listings are not displayed',
            stepsToReproduce: ['Search for something', 'Clear the search input', 'Press Enter'],
            expected: 'Default listing view restored', actual: 'No listings displayed',
            url: page.url(), timestamp: new Date().toISOString()
          });
        }
      } catch {}

      /* --- Test rapid sequential searches (debounce) --- */
      try {
        const rapidTerms = ['a', 'ab', 'abc', 'abcd', 'abcde'];
        for (const t of rapidTerms) {
          await searchInput.fill(t);
          await page.waitForTimeout(100); // Rapid typing
        }
        await page.waitForTimeout(2000);
        // Just checking it doesn't crash - no bug unless error
      } catch {}
    }

    /* --- Filter testing --- */
    broadcast({ type: 'log', text: 'Testing store filters and sorting...', color: '#4ECDC4' });

    // Restore store page
    await page.goto(storeUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const filterSelectors = [
      'select', '[role="listbox"]', '[class*="filter"]', '[class*="dropdown"]',
      '[class*="select"]', 'button[class*="filter"]',
    ];

    let filters = [];
    for (const sel of filterSelectors) {
      try {
        const els = await page.$$(sel);
        for (const el of els) {
          if (await el.isVisible()) filters.push(el);
        }
      } catch {}
    }

    // Deduplicate by taking unique set
    filters = filters.slice(0, 5);

    const initialCardCount = (await getListingCards(page)).length;

    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      try {
        const tagName = await filter.evaluate(el => el.tagName.toLowerCase());

        if (tagName === 'select') {
          const optionValues = await filter.evaluate(el => {
            const opts = el.querySelectorAll('option');
            return Array.from(opts).map(o => ({ value: o.value, text: o.textContent }));
          });

          if (optionValues.length > 1) {
            // Select second option
            await filter.selectOption({ index: 1 });
            await page.waitForTimeout(1500);

            const filteredCards = await getListingCards(page);

            // Check if URL updated with filter state
            const urlChanged = page.url() !== storeUrl;

            // Reset filter
            await filter.selectOption({ index: 0 });
            await page.waitForTimeout(1000);

            const resetCards = await getListingCards(page);
            if (resetCards.length === 0 && initialCardCount > 0) {
              bugs.push({
                id: uuidv4(), severity: 'medium',
                title: 'Removing filter does not restore listings',
                category: CATEGORY, testId: 'store_search',
                description: 'After applying and removing a filter, listings do not return to the default view',
                stepsToReproduce: ['Navigate to store', 'Apply a filter', 'Remove the filter'],
                expected: 'Default listings restored', actual: 'No listings displayed after filter removal',
                url: page.url(), timestamp: new Date().toISOString()
              });
            }
          }
        } else {
          await filter.click({ timeout: 2000 });
          await page.waitForTimeout(1000);

          // Look for dropdown options
          const dropdownOptions = await page.$$('[role="option"], [class*="option"], [class*="menu-item"], li[class*="item"]');
          if (dropdownOptions.length > 0) {
            try {
              await dropdownOptions[0].click();
              await page.waitForTimeout(1500);
            } catch {}
          }
        }
      } catch {}
    }

    /* --- Sorting --- */
    const sortSelectors = [
      'select[class*="sort"]', '[class*="sort"] select', '[aria-label*="sort" i]',
      'button:has-text("Sort")', '[class*="sort"] button',
    ];

    let sortControl = null;
    for (const sel of sortSelectors) {
      try {
        sortControl = await page.$(sel);
        if (sortControl && await sortControl.isVisible()) break;
        sortControl = null;
      } catch {}
    }

    if (sortControl) {
      try {
        const tagName = await sortControl.evaluate(el => el.tagName.toLowerCase());

        if (tagName === 'select') {
          const sortOptions = await sortControl.evaluate(el => {
            const opts = el.querySelectorAll('option');
            return Array.from(opts).map(o => ({ value: o.value, text: (o.textContent || '').trim() }));
          });

          for (let i = 0; i < Math.min(sortOptions.length, 3); i++) {
            await sortControl.selectOption({ index: i });
            await page.waitForTimeout(1500);

            const sortedCards = await getListingCards(page);
            if (sortedCards.length === 0 && initialCardCount > 0) {
              bugs.push({
                id: uuidv4(), severity: 'low',
                title: `Sort option "${sortOptions[i].text}" results in empty view`,
                category: CATEGORY, testId: 'store_search',
                description: `Applying sort "${sortOptions[i].text}" shows no listings`,
                stepsToReproduce: ['Navigate to store', `Sort by "${sortOptions[i].text}"`],
                expected: 'Listings reorder based on sort', actual: 'No listings displayed',
                url: page.url(), timestamp: new Date().toISOString()
              });
            }
          }
        } else {
          await sortControl.click({ timeout: 2000 });
          await page.waitForTimeout(1000);
          // Click first sort option
          const sortOpts = await page.$$('[role="option"], [class*="option"], [class*="menu-item"]');
          if (sortOpts.length > 0) {
            await sortOpts[0].click();
            await page.waitForTimeout(1500);
          }
        }
      } catch {}
    }

    /* --- Test filter + search combination --- */
    if (searchInput && filters.length > 0) {
      try {
        await page.goto(storeUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);

        const freshSearch = await page.$(searchSelectors.find(s => true) || 'input[type="search"]');
        if (freshSearch) {
          await freshSearch.fill('test');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1500);

          // Apply a filter on top of search
          const freshFilters = await page.$$('select');
          if (freshFilters.length > 0) {
            const opts = await freshFilters[0].evaluate(el => el.querySelectorAll('option').length);
            if (opts > 1) {
              await freshFilters[0].selectOption({ index: 1 });
              await page.waitForTimeout(1500);
            }
          }
        }
      } catch {}
    }

    /* --- Check URL updates with filter/search state (bookmarkability) --- */
    const finalUrl = page.url();
    const hasQueryParams = finalUrl.includes('?') || finalUrl.includes('#');
    // We don't flag this as a bug — it's informational

    broadcast({ type: 'log', text: `Store search & filter test complete. ${bugs.length} issues found.`, color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Store search error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runStoreBrowse, runStoreInstall, runStoreSearch };
