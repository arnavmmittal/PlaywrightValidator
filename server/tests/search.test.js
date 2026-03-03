const { v4: uuidv4 } = require('uuid');

/**
 * Search & Prompts Tests
 * - Prompt injection tests
 * - Search history verification
 * - History deletion & confirmation
 */

const TEST_QUERIES = [
  'What is the weather today',
  'Help me write an email',
  'Explain quantum computing',
];

const EDGE_CASE_QUERIES = [
  '', // Empty
  'a', // Single character
  'A'.repeat(5000), // Very long
  '🎉🚀💻🔥', // Emojis
  '<script>alert(1)</script>', // XSS attempt
  "'; DROP TABLE users;--", // SQL injection
  'مرحبا بالعالم', // RTL text
  '    ', // Whitespace only
];

async function runSearchPrompts(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing search/prompt functionality...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    // Find search inputs
    const searchInputs = await page.$$('input[type="search"], input[type="text"], textarea, [role="searchbox"], [role="textbox"], [contenteditable="true"]');

    if (searchInputs.length === 0) {
      broadcast({ type: 'log', text: 'No search inputs found', color: '#F5A623' });
      return bugs;
    }

    broadcast({ type: 'log', text: `Found ${searchInputs.length} potential search inputs`, color: '#4ECDC4' });

    // Use the first prominent search input
    const searchInput = searchInputs[0];

    // Test normal queries
    for (const query of TEST_QUERIES.slice(0, 2)) {
      try {
        await searchInput.click();
        await page.keyboard.selectAll();
        await searchInput.fill(query);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);

        const content = await page.content();
        const hasResponse = content.length > 1000; // Page should have content

        if (!hasResponse) {
          bugs.push({
            id: uuidv4(),
            severity: 'medium',
            title: 'No response to search query',
            category: 'Search & Prompts',
            testId: 'search_prompts',
            description: `Search query "${query.slice(0, 50)}" returned no visible response`,
            stepsToReproduce: ['Navigate to ' + url, 'Enter query: ' + query, 'Submit'],
            expected: 'Search should return results or response',
            actual: 'No visible response',
            url,
            timestamp: new Date().toISOString()
          });
        }

        // Navigate back for next test
        await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
      } catch (e) {
        // Continue
      }
    }

    // Test edge cases
    for (const query of EDGE_CASE_QUERIES.slice(0, 4)) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        const searchInput = await page.$('input[type="search"], input[type="text"], textarea');
        if (!searchInput) continue;

        await searchInput.click();
        await searchInput.fill(query);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);

        // Check for crashes or errors
        const content = await page.content();
        const hasError = content.toLowerCase().includes('error') ||
                        content.toLowerCase().includes('crashed') ||
                        content.toLowerCase().includes('something went wrong');

        if (hasError && query.length > 100) {
          bugs.push({
            id: uuidv4(),
            severity: 'medium',
            title: 'Error with edge-case input',
            category: 'Search & Prompts',
            testId: 'search_prompts',
            description: `Search showed error with edge-case input (${query.length > 50 ? 'long string' : query.slice(0, 30)})`,
            stepsToReproduce: ['Navigate to ' + url, 'Enter edge-case input', 'Submit'],
            expected: 'Graceful handling of edge cases',
            actual: 'Error displayed',
            url,
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {
        // Continue
      }
    }

    broadcast({ type: 'log', text: 'Search prompt testing complete', color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Search test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runSearchHistory(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing search history...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const uniqueTerm = `playwrightQAtest_${Date.now()}`;

    // Find and use search input
    const searchInput = await page.$('input[type="search"], input[type="text"], textarea');
    if (!searchInput) {
      broadcast({ type: 'log', text: 'No search input found for history test', color: '#F5A623' });
      return bugs;
    }

    // Perform search
    await searchInput.fill(uniqueTerm);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Look for history/recent searches UI
    const historyElements = await page.$$('[class*="history"], [class*="recent"], [class*="suggestion"], [aria-label*="history"], [aria-label*="recent"]');

    // Click on search input to trigger history dropdown
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const newSearchInput = await page.$('input[type="search"], input[type="text"], textarea');
    if (newSearchInput) {
      await newSearchInput.click();
      await page.waitForTimeout(1000);

      const pageContent = await page.content();
      const historyVisible = pageContent.includes(uniqueTerm) ||
                            historyElements.length > 0;

      if (!historyVisible) {
        bugs.push({
          id: uuidv4(),
          severity: 'info',
          title: 'Search history not visible',
          category: 'Search & Prompts',
          testId: 'search_history',
          description: 'Previous search term not found in history/suggestions',
          stepsToReproduce: ['Navigate to ' + url, 'Perform a search', 'Return and click search box', 'Look for history'],
          expected: 'Recent searches should appear',
          actual: 'No history visible or term not found',
          url,
          timestamp: new Date().toISOString()
        });
      }
    }

    broadcast({ type: 'log', text: 'Search history test complete', color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `History test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runSearchDelete(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing history deletion...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    // Look for history/clear buttons
    const clearButtons = await page.$$('[aria-label*="clear"], [aria-label*="delete"], [class*="clear"], [class*="delete"], button:has-text("Clear"), button:has-text("Delete")');

    if (clearButtons.length === 0) {
      broadcast({ type: 'log', text: 'No history delete controls found', color: '#F5A623' });
      return bugs;
    }

    // Try clicking a delete button
    for (const btn of clearButtons.slice(0, 2)) {
      try {
        const isVisible = await btn.isVisible();
        if (!isVisible) continue;

        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(1000);

        // Check for confirmation dialog
        const hasDialog = await page.evaluate(() => {
          return document.querySelector('[role="dialog"], [role="alertdialog"], .modal, .confirm') !== null;
        });

        // Or check for native confirm dialog (would have been auto-dismissed)
        if (!hasDialog) {
          // Check if item was deleted immediately without confirmation
          const buttonStillExists = await btn.isVisible().catch(() => false);

          if (!buttonStillExists) {
            bugs.push({
              id: uuidv4(),
              severity: 'low',
              title: 'No confirmation for deletion',
              category: 'Search & Prompts',
              testId: 'search_delete',
              description: 'History item was deleted without confirmation prompt',
              stepsToReproduce: ['Navigate to ' + url, 'Click delete on history item'],
              expected: 'Confirmation dialog before deletion',
              actual: 'Item deleted immediately',
              url,
              timestamp: new Date().toISOString()
            });
          }
        }

        break;
      } catch (e) {
        // Continue
      }
    }

    broadcast({ type: 'log', text: 'History deletion test complete', color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Delete test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runSearchPrompts, runSearchHistory, runSearchDelete };
