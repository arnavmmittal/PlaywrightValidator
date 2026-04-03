const { v4: uuidv4 } = require('uuid');

/**
 * Search & Prompts Tests — Comprehensive
 * - Diverse query testing with edge cases
 * - Autocomplete, relevance, pagination, XSS reflection
 * - Search history verification with ordering and persistence
 * - History deletion with confirmation, undo, accessibility
 */

const TEST_QUERIES = [
  'What is the weather today',
  'How to write a Python function',
  'Latest technology news 2024',
  'What is 42 times 37',
  'Tell me about yourself',
  'Help me write an email',
  'Explain quantum computing simply',
];

const EDGE_CASE_QUERIES = [
  { label: 'empty string', value: '' },
  { label: 'single character', value: 'a' },
  { label: '5000+ chars', value: 'A'.repeat(5500) },
  { label: 'emojis', value: '🎉🚀💻🔥😀🌍🎶🐱‍👤' },
  { label: 'RTL Arabic', value: 'مرحبا بالعالم العربي' },
  { label: 'RTL Hebrew', value: 'שלום עולם' },
  { label: 'CJK characters', value: '你好世界こんにちは세계' },
  { label: 'whitespace only', value: '     ' },
  { label: 'special chars', value: '!@#$%^&*()_+-=[]{}|;:,.<>?' },
  { label: 'newlines', value: 'line1\nline2\nline3' },
  { label: 'tabs', value: 'col1\tcol2\tcol3' },
  { label: 'HTML tags', value: '<script>alert(1)</script><img src=x onerror=alert(1)>' },
  { label: 'SQL injection', value: "'; DROP TABLE users; -- SELECT * FROM passwords WHERE '1'='1" },
  { label: 'JavaScript code', value: 'function() { return document.cookie; }' },
  { label: 'CSV formatted', value: 'name,age,city\nJohn,30,NYC\nJane,25,LA' },
  { label: 'JSON formatted', value: '{"key": "value", "array": [1,2,3]}' },
  { label: 'unicode null', value: 'test\u0000null\u0000char' },
  { label: 'path traversal', value: '../../../etc/passwd' },
  { label: 'CRLF injection', value: 'test\r\nHeader-Injection: true' },
];

const SEARCH_INPUT_SELECTOR = 'input[type="search"], input[type="text"], textarea, [role="searchbox"], [role="textbox"], [contenteditable="true"]';

async function findSearchInput(page) {
  const inputs = await page.$$(SEARCH_INPUT_SELECTOR);
  if (inputs.length === 0) return null;
  // Prefer visible inputs
  for (const input of inputs) {
    if (await input.isVisible().catch(() => false)) return input;
  }
  return inputs[0];
}

async function runSearchPrompts(page, url, options, broadcast) {
  const bugs = [];
  const timeout = (options.timeout || 30) * 1000;

  broadcast({ type: 'log', text: 'Testing search/prompt functionality (comprehensive)...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const searchInput = await findSearchInput(page);
    if (!searchInput) {
      broadcast({ type: 'log', text: 'No search inputs found on page', color: '#F5A623' });
      return bugs;
    }

    const allInputs = await page.$$(SEARCH_INPUT_SELECTOR);
    broadcast({ type: 'log', text: `Found ${allInputs.length} potential search input(s)`, color: '#4ECDC4' });

    // ─── 1. Normal Queries ───
    broadcast({ type: 'log', text: 'Testing normal search queries...', color: '#4ECDC4' });
    for (const query of TEST_QUERIES.slice(0, 5)) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        const input = await findSearchInput(page);
        if (!input) continue;

        await input.click();
        await input.fill(query);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2500);

        const content = await page.content();
        const hasResponse = content.length > 1000;

        if (!hasResponse) {
          bugs.push({
            id: uuidv4(),
            severity: 'medium',
            title: 'No response to search query',
            category: 'Search & Prompts',
            testId: 'search_prompts',
            description: `Search query "${query.slice(0, 50)}" returned no visible response`,
            stepsToReproduce: ['Navigate to ' + url, `Enter query: "${query}"`, 'Press Enter'],
            expected: 'Search should return results or a response',
            actual: 'No visible response detected',
            url,
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {
        // Continue to next query
      }
    }

    // ─── 2. Edge Case Queries ───
    broadcast({ type: 'log', text: `Testing ${EDGE_CASE_QUERIES.length} edge-case inputs...`, color: '#4ECDC4' });
    for (const { label, value } of EDGE_CASE_QUERIES) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        const input = await findSearchInput(page);
        if (!input) continue;

        await input.click();
        // fill may fail on contenteditable, fall back to typing
        try {
          await input.fill(value);
        } catch {
          await input.type(value.slice(0, 200), { delay: 5 });
        }
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);

        // Check for crash, unhandled error, or blank page
        const content = await page.content();
        const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
        const hasCrash = /unhandled|crashed|fatal|exception|something went wrong|500 internal/i.test(bodyText);
        const isBlank = content.length < 200;

        if (hasCrash) {
          bugs.push({
            id: uuidv4(),
            severity: 'high',
            title: `Application crash with edge-case input: ${label}`,
            category: 'Search & Prompts',
            testId: 'search_prompts_edge',
            description: `Submitting "${label}" input caused the application to show an error or crash state`,
            stepsToReproduce: ['Navigate to ' + url, `Enter edge-case input (${label})`, 'Press Enter'],
            expected: 'Graceful handling — friendly message or no-op',
            actual: 'Error or crash state displayed',
            url,
            timestamp: new Date().toISOString()
          });
        }

        if (isBlank && value.length > 0) {
          bugs.push({
            id: uuidv4(),
            severity: 'medium',
            title: `Blank page after edge-case input: ${label}`,
            category: 'Search & Prompts',
            testId: 'search_prompts_edge',
            description: `Submitting "${label}" input resulted in a nearly blank page`,
            stepsToReproduce: ['Navigate to ' + url, `Enter edge-case input (${label})`, 'Press Enter'],
            expected: 'Page should still render content or a friendly message',
            actual: 'Page appears blank or minimal',
            url,
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {
        // Continue
      }
    }

    // ─── 3. Autocomplete / Suggestions ───
    broadcast({ type: 'log', text: 'Testing search autocomplete/suggestions...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const input = await findSearchInput(page);
      if (input) {
        await input.click();
        // Type slowly to trigger autocomplete
        const testPhrase = 'weather';
        for (const char of testPhrase) {
          await page.keyboard.type(char, { delay: 200 });
        }
        await page.waitForTimeout(1500);

        const suggestions = await page.$$('[role="listbox"] [role="option"], [class*="suggest"], [class*="autocomplete"], [class*="dropdown"] li, [class*="completion"], datalist option');
        const autocompleteAttr = await input.getAttribute('list').catch(() => null);
        const ariaAutocomplete = await input.getAttribute('aria-autocomplete').catch(() => null);

        if (suggestions.length > 0) {
          broadcast({ type: 'log', text: `Found ${suggestions.length} autocomplete suggestions`, color: '#4ECDC4' });
          // Verify keyboard navigation of suggestions
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(300);
          const activeDescendant = await input.getAttribute('aria-activedescendant').catch(() => null);
          const focused = await page.evaluate(() => document.activeElement?.getAttribute('role')).catch(() => null);

          if (!activeDescendant && focused !== 'option') {
            bugs.push({
              id: uuidv4(),
              severity: 'medium',
              title: 'Autocomplete suggestions not keyboard-navigable',
              category: 'Search & Prompts',
              testId: 'search_autocomplete',
              description: 'Search suggestions dropdown does not support keyboard navigation via arrow keys',
              stepsToReproduce: ['Navigate to ' + url, 'Type in search box slowly', 'Wait for suggestions', 'Press ArrowDown'],
              expected: 'Suggestions should be navigable with arrow keys (aria-activedescendant)',
              actual: 'No keyboard navigation support detected',
              url,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (e) {
      // Autocomplete test non-critical
    }

    // ─── 4. "No Results" Handling ───
    broadcast({ type: 'log', text: 'Testing no-results handling...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const input = await findSearchInput(page);
      if (input) {
        const nonsense = 'xyzzy123qwerty987zzznoexist';
        await input.click();
        await input.fill(nonsense);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2500);

        const bodyText = await page.evaluate(() => document.body?.innerText?.toLowerCase() || '').catch(() => '');
        const hasEmptyState = /no results|nothing found|no matches|couldn't find|did not match|try again|try different/i.test(bodyText);
        const hasResults = await page.$$('[class*="result"], [class*="item"], [class*="card"]');

        if (!hasEmptyState && hasResults.length === 0) {
          bugs.push({
            id: uuidv4(),
            severity: 'low',
            title: 'No friendly empty state for zero search results',
            category: 'Search & Prompts',
            testId: 'search_no_results',
            description: 'Searching for nonsensical text does not display a user-friendly "no results" message',
            stepsToReproduce: ['Navigate to ' + url, `Search for "${nonsense}"`, 'Observe result area'],
            expected: 'A friendly "no results found" message should appear',
            actual: 'No empty state message detected',
            url,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 5. Search via URL Parameter ───
    broadcast({ type: 'log', text: 'Testing search via URL parameters...', color: '#4ECDC4' });
    try {
      const searchUrl = new URL(url);
      searchUrl.searchParams.set('q', 'automated test query');
      await page.goto(searchUrl.toString(), { waitUntil: 'domcontentloaded', timeout });
      await page.waitForTimeout(1500);

      const input = await findSearchInput(page);
      if (input) {
        const inputValue = await input.inputValue().catch(() => '');
        const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
        const isPreFilled = inputValue.includes('automated test query') || bodyText.includes('automated test query');

        if (!isPreFilled) {
          bugs.push({
            id: uuidv4(),
            severity: 'info',
            title: 'URL search parameter not pre-filling search',
            category: 'Search & Prompts',
            testId: 'search_url_params',
            description: 'Appending ?q=<term> to the URL does not pre-fill the search box or trigger a search',
            stepsToReproduce: ['Navigate to ' + searchUrl.toString(), 'Check if search box is pre-filled'],
            expected: 'Search term from URL parameter should pre-fill the search',
            actual: 'Search box is empty or search not triggered',
            url,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 6. Search Persistence ───
    broadcast({ type: 'log', text: 'Testing search persistence across navigation...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const input = await findSearchInput(page);
      if (input) {
        const persistTerm = 'persistence check term';
        await input.click();
        await input.fill(persistTerm);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);

        // Navigate away
        const links = await page.$$('a[href]');
        if (links.length > 0) {
          const href = await links[0].getAttribute('href').catch(() => null);
          if (href) {
            await page.goto(href.startsWith('http') ? href : new URL(href, url).toString(), { waitUntil: 'domcontentloaded', timeout }).catch(() => {});
            await page.waitForTimeout(1000);
          }
        }

        // Navigate back
        await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(1500);

        const returnedInput = await findSearchInput(page);
        if (returnedInput) {
          const value = await returnedInput.inputValue().catch(() => '');
          const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
          const isPersisted = value.includes(persistTerm) || bodyText.includes(persistTerm);

          if (!isPersisted) {
            bugs.push({
              id: uuidv4(),
              severity: 'info',
              title: 'Search not persisted after navigation',
              category: 'Search & Prompts',
              testId: 'search_persistence',
              description: 'After searching and navigating away then back, the previous search state is lost',
              stepsToReproduce: ['Navigate to ' + url, 'Perform a search', 'Click a link to navigate away', 'Press Back button'],
              expected: 'Previous search term or results should be preserved',
              actual: 'Search state was lost',
              url,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 7. Rate Limit Testing ───
    broadcast({ type: 'log', text: 'Testing rapid search submissions (rate limit)...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const input = await findSearchInput(page);
      if (input) {
        const errors = [];
        const responses = [];

        page.on('response', (res) => {
          if (res.status() === 429) responses.push(res);
        });
        page.on('pageerror', (err) => errors.push(err.message));

        for (let i = 0; i < 10; i++) {
          try {
            const rapidInput = await findSearchInput(page);
            if (!rapidInput) break;
            await rapidInput.click();
            await rapidInput.fill(`rapid search ${i}`);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(200);
          } catch {
            break;
          }
        }
        await page.waitForTimeout(2000);

        if (errors.length > 0) {
          bugs.push({
            id: uuidv4(),
            severity: 'medium',
            title: 'Errors during rapid search submissions',
            category: 'Search & Prompts',
            testId: 'search_rate_limit',
            description: `Submitting 10 searches rapidly caused ${errors.length} JavaScript error(s): ${errors.slice(0, 3).join('; ')}`,
            stepsToReproduce: ['Navigate to ' + url, 'Submit 10 searches in rapid succession'],
            expected: 'Searches should be debounced or queued gracefully',
            actual: `${errors.length} error(s) occurred`,
            url,
            timestamp: new Date().toISOString()
          });
        }

        if (responses.length > 0) {
          bugs.push({
            id: uuidv4(),
            severity: 'info',
            title: 'Rate limiting detected on search',
            category: 'Search & Prompts',
            testId: 'search_rate_limit',
            description: `Server returned ${responses.length} HTTP 429 response(s) during rapid search. This is expected behavior but should be communicated to the user.`,
            stepsToReproduce: ['Navigate to ' + url, 'Submit 10 searches rapidly'],
            expected: 'Rate limit with user-friendly message',
            actual: `${responses.length} 429 responses received`,
            url,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 8. Search Result Highlighting ───
    broadcast({ type: 'log', text: 'Testing search term highlighting in results...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const input = await findSearchInput(page);
      if (input) {
        const highlightTerm = 'test';
        await input.click();
        await input.fill(highlightTerm);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2500);

        const highlights = await page.$$('mark, em.highlight, span.highlight, [class*="highlight"], b.match, strong.match');
        if (highlights.length === 0) {
          const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
          if (bodyText.toLowerCase().includes(highlightTerm)) {
            bugs.push({
              id: uuidv4(),
              severity: 'info',
              title: 'Search terms not highlighted in results',
              category: 'Search & Prompts',
              testId: 'search_highlighting',
              description: 'Search results contain the query term but it is not visually highlighted',
              stepsToReproduce: ['Navigate to ' + url, `Search for "${highlightTerm}"`, 'Inspect results for highlighting'],
              expected: 'Matching terms should be highlighted (e.g., with <mark> or highlight class)',
              actual: 'No highlighting detected',
              url,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 9. Search Result Pagination ───
    broadcast({ type: 'log', text: 'Testing search result pagination...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const input = await findSearchInput(page);
      if (input) {
        await input.click();
        await input.fill('test');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2500);

        const paginationControls = await page.$$('[class*="pagination"], [class*="pager"], [aria-label*="pagination"], nav[role="navigation"] a, [class*="next-page"], [class*="load-more"], button:has-text("Load more"), button:has-text("Next"), a:has-text("Next")');

        if (paginationControls.length > 0) {
          broadcast({ type: 'log', text: `Found ${paginationControls.length} pagination controls`, color: '#4ECDC4' });
          // Try clicking next/load more
          for (const control of paginationControls.slice(0, 2)) {
            try {
              const isVisible = await control.isVisible();
              if (!isVisible) continue;

              const beforeContent = await page.content();
              await control.click({ timeout: 3000 });
              await page.waitForTimeout(2000);
              const afterContent = await page.content();

              if (afterContent === beforeContent) {
                bugs.push({
                  id: uuidv4(),
                  severity: 'medium',
                  title: 'Pagination control does not load new content',
                  category: 'Search & Prompts',
                  testId: 'search_pagination',
                  description: 'Clicking pagination/load-more did not change the page content',
                  stepsToReproduce: ['Navigate to ' + url, 'Perform a search', 'Click Next/Load More'],
                  expected: 'New results should be loaded',
                  actual: 'Page content unchanged after clicking pagination',
                  url,
                  timestamp: new Date().toISOString()
                });
              }
              break;
            } catch {
              // continue
            }
          }
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 10. Search Analytics / Tracking ───
    broadcast({ type: 'log', text: 'Checking for search analytics/tracking requests...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const input = await findSearchInput(page);
      if (input) {
        const analyticsRequests = [];
        const analyticsPatterns = /analytics|tracking|collect|event|gtag|gtm|segment|mixpanel|amplitude|plausible|umami/i;

        page.on('request', (req) => {
          if (analyticsPatterns.test(req.url())) {
            analyticsRequests.push(req.url());
          }
        });

        await input.click();
        await input.fill('analytics tracking test');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);

        if (analyticsRequests.length > 0) {
          bugs.push({
            id: uuidv4(),
            severity: 'info',
            title: `Search triggers ${analyticsRequests.length} analytics/tracking request(s)`,
            category: 'Search & Prompts',
            testId: 'search_analytics',
            description: `Search action triggers analytics requests to: ${[...new Set(analyticsRequests.map(u => new URL(u).hostname))].join(', ')}`,
            stepsToReproduce: ['Navigate to ' + url, 'Open Network tab', 'Perform a search', 'Filter for analytics domains'],
            expected: 'Awareness of tracking on search actions',
            actual: `${analyticsRequests.length} tracking request(s) sent`,
            url,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 11. XSS Reflection Check ───
    broadcast({ type: 'log', text: 'Testing for XSS reflection in search results...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const input = await findSearchInput(page);
      if (input) {
        const xssPayloads = [
          '<img src=x onerror=alert(1)>',
          '<svg onload=alert(1)>',
          '"><script>alert(document.domain)</script>',
          "javascript:alert('xss')",
        ];

        for (const payload of xssPayloads) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
            const inp = await findSearchInput(page);
            if (!inp) continue;

            await inp.click();
            await inp.fill(payload);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(2000);

            // Check if the raw HTML appears unescaped in the DOM
            const reflected = await page.evaluate((pl) => {
              const html = document.body.innerHTML;
              // If the payload appears literally in the HTML (not entity-encoded), it's reflected
              return html.includes(pl);
            }, payload);

            if (reflected) {
              bugs.push({
                id: uuidv4(),
                severity: 'critical',
                title: 'Potential XSS: unsanitized search input reflected in page',
                category: 'Search & Prompts',
                testId: 'search_xss',
                description: `The search input "${payload.slice(0, 40)}" was reflected in the page HTML without sanitization, which could allow cross-site scripting attacks`,
                stepsToReproduce: ['Navigate to ' + url, `Enter XSS payload: ${payload.slice(0, 40)}`, 'Submit and inspect the DOM'],
                expected: 'User input should be HTML-escaped before rendering',
                actual: 'Raw HTML from input appears unescaped in the DOM',
                url,
                timestamp: new Date().toISOString()
              });
              break; // One XSS bug is enough
            }
          } catch {
            // Continue
          }
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 12. Search Results Accessibility ───
    broadcast({ type: 'log', text: 'Checking search results accessibility...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const input = await findSearchInput(page);
      if (input) {
        await input.click();
        await input.fill('accessibility test');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2500);

        const a11y = await page.evaluate(() => {
          const liveRegions = document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]');
          const inputEl = document.querySelector('input[type="search"], input[type="text"], textarea, [role="searchbox"]');
          const hasAriaLabel = inputEl?.getAttribute('aria-label') || inputEl?.getAttribute('aria-labelledby') || inputEl?.closest('label');
          const resultsRegion = document.querySelector('[role="region"][aria-label*="result"], [role="region"][aria-label*="search"], [aria-label*="results"]');

          return {
            liveRegionCount: liveRegions.length,
            inputHasLabel: !!hasAriaLabel,
            hasResultsRegion: !!resultsRegion,
          };
        });

        const a11yIssues = [];
        if (a11y.liveRegionCount === 0) a11yIssues.push('no aria-live region for dynamic result updates');
        if (!a11y.inputHasLabel) a11yIssues.push('search input missing accessible label');
        if (!a11y.hasResultsRegion) a11yIssues.push('no labeled results region');

        if (a11yIssues.length > 0) {
          bugs.push({
            id: uuidv4(),
            severity: 'medium',
            title: 'Search results have accessibility gaps',
            category: 'Search & Prompts',
            testId: 'search_a11y',
            description: `Search results area has accessibility issues: ${a11yIssues.join('; ')}`,
            stepsToReproduce: ['Navigate to ' + url, 'Perform a search', 'Inspect with screen reader or accessibility tree'],
            expected: 'Search should have ARIA live regions, labeled input, and results region',
            actual: a11yIssues.join('; '),
            url,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      // Non-critical
    }

    broadcast({ type: 'log', text: `Search prompt testing complete — ${bugs.length} bug(s) found`, color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Search test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runSearchHistory(page, url, options, broadcast) {
  const bugs = [];
  const timeout = (options.timeout || 30) * 1000;

  broadcast({ type: 'log', text: 'Testing search history (comprehensive)...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const searchTerms = [
      { term: `qahistory_alpha_${Date.now()}`, time: null },
      { term: `qahistory_beta_${Date.now()}`, time: null },
      { term: `qahistory_gamma_${Date.now()}`, time: null },
    ];

    // ─── 1. Perform 3 Searches with Timestamps ───
    for (const entry of searchTerms) {
      const input = await findSearchInput(page);
      if (!input) {
        broadcast({ type: 'log', text: 'No search input found for history test', color: '#F5A623' });
        return bugs;
      }

      await input.click();
      await input.fill(entry.term);
      entry.time = new Date().toISOString();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    }

    // ─── 2. Check History Visibility and Order ───
    broadcast({ type: 'log', text: 'Checking search history visibility and order...', color: '#4ECDC4' });
    const input = await findSearchInput(page);
    if (input) {
      await input.click();
      await page.waitForTimeout(1500);

      const pageContent = await page.content();
      const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');

      const foundTerms = searchTerms.filter(e => pageContent.includes(e.term) || bodyText.includes(e.term));
      const historyElements = await page.$$('[class*="history"], [class*="recent"], [class*="suggestion"], [aria-label*="history"], [aria-label*="recent"]');

      if (foundTerms.length === 0 && historyElements.length === 0) {
        bugs.push({
          id: uuidv4(),
          severity: 'info',
          title: 'Search history not visible after multiple searches',
          category: 'Search & Prompts',
          testId: 'search_history',
          description: 'After performing 3 searches, none of the terms appear in a history or recent searches UI',
          stepsToReproduce: ['Navigate to ' + url, 'Perform 3 different searches', 'Click back into the search input', 'Look for recent/history items'],
          expected: 'Recent searches should appear in a history dropdown or suggestions',
          actual: 'No history items visible',
          url,
          timestamp: new Date().toISOString()
        });
      } else if (foundTerms.length > 0 && foundTerms.length < 3) {
        bugs.push({
          id: uuidv4(),
          severity: 'low',
          title: 'Search history incomplete — not all searches saved',
          category: 'Search & Prompts',
          testId: 'search_history',
          description: `Only ${foundTerms.length} of 3 search terms found in history`,
          stepsToReproduce: ['Navigate to ' + url, 'Perform 3 different searches', 'Check history'],
          expected: 'All 3 recent searches should appear',
          actual: `Only ${foundTerms.length} found`,
          url,
          timestamp: new Date().toISOString()
        });
      }

      // Check ordering (newest first)
      if (foundTerms.length >= 2) {
        const positions = searchTerms.map(e => bodyText.indexOf(e.term)).filter(p => p >= 0);
        if (positions.length >= 2) {
          const isNewestFirst = positions[positions.length - 1] < positions[0];
          if (!isNewestFirst) {
            bugs.push({
              id: uuidv4(),
              severity: 'low',
              title: 'Search history not in newest-first order',
              category: 'Search & Prompts',
              testId: 'search_history_order',
              description: 'Search history items do not appear in reverse chronological order (newest first)',
              stepsToReproduce: ['Navigate to ' + url, 'Perform 3 searches at different times', 'Open history', 'Check order'],
              expected: 'Most recent search should appear first',
              actual: 'History appears in a different order',
              url,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }

    // ─── 3. History Keyboard Accessibility ───
    broadcast({ type: 'log', text: 'Testing history keyboard accessibility...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const kbInput = await findSearchInput(page);
      if (kbInput) {
        await kbInput.focus();
        await page.waitForTimeout(500);
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(500);

        const historyA11y = await page.evaluate(() => {
          const active = document.activeElement;
          const hasRole = active?.getAttribute('role');
          const ariaSelected = document.querySelector('[aria-selected="true"]');
          const listbox = document.querySelector('[role="listbox"]');
          return {
            activeRole: hasRole,
            hasAriaSelected: !!ariaSelected,
            hasListbox: !!listbox,
          };
        });

        if (!historyA11y.hasListbox && !historyA11y.hasAriaSelected) {
          // Only report if history UI actually exists
          const historyUI = await page.$$('[class*="history"], [class*="recent"]');
          if (historyUI.length > 0) {
            bugs.push({
              id: uuidv4(),
              severity: 'medium',
              title: 'Search history not keyboard accessible',
              category: 'Search & Prompts',
              testId: 'search_history_a11y',
              description: 'Search history dropdown does not have proper ARIA roles (listbox/option) or keyboard navigation',
              stepsToReproduce: ['Navigate to ' + url, 'Focus search input', 'Press ArrowDown to navigate history'],
              expected: 'History should be navigable via keyboard with proper ARIA roles',
              actual: 'No listbox role or aria-selected found',
              url,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 4. History Storage Mechanism ───
    broadcast({ type: 'log', text: 'Testing history storage mechanism...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

      const storageInfo = await page.evaluate(() => {
        const localStorageKeys = Object.keys(localStorage).filter(k =>
          /history|search|recent|query/i.test(k)
        );
        const sessionStorageKeys = Object.keys(sessionStorage).filter(k =>
          /history|search|recent|query/i.test(k)
        );
        return { localStorageKeys, sessionStorageKeys };
      });

      if (storageInfo.localStorageKeys.length > 0 || storageInfo.sessionStorageKeys.length > 0) {
        broadcast({ type: 'log', text: `History stored in: localStorage(${storageInfo.localStorageKeys.length}), sessionStorage(${storageInfo.sessionStorageKeys.length})`, color: '#4ECDC4' });
      }

      // Clear cookies and storage, check if history survives
      await page.context().clearCookies();
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      await page.waitForTimeout(1000);

      const clearedInput = await findSearchInput(page);
      if (clearedInput) {
        await clearedInput.click();
        await page.waitForTimeout(1000);

        const bodyAfterClear = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
        const historyStillVisible = searchTerms.some(e => bodyAfterClear.includes(e.term));

        if (historyStillVisible) {
          bugs.push({
            id: uuidv4(),
            severity: 'info',
            title: 'Search history persists after clearing local storage',
            category: 'Search & Prompts',
            testId: 'search_history_storage',
            description: 'Search history is stored server-side (survives clearing cookies and localStorage)',
            stepsToReproduce: ['Perform searches', 'Clear browser cookies and localStorage', 'Reload and check history'],
            expected: 'Information about storage mechanism',
            actual: 'History persists — stored server-side',
            url,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 5. History Click Re-executes Search ───
    broadcast({ type: 'log', text: 'Testing history item click re-execution...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      // Re-do a search so history has something
      const reInput = await findSearchInput(page);
      if (reInput) {
        const clickTerm = `qaclick_${Date.now()}`;
        await reInput.click();
        await reInput.fill(clickTerm);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        const reInput2 = await findSearchInput(page);
        if (reInput2) {
          await reInput2.click();
          await page.waitForTimeout(1000);

          // Look for clickable history items
          const historyItems = await page.$$('[class*="history"] a, [class*="history"] li, [class*="history"] button, [class*="recent"] a, [class*="recent"] li, [class*="recent"] button, [class*="suggestion"] li, [class*="suggestion"] button');
          if (historyItems.length > 0) {
            try {
              await historyItems[0].click({ timeout: 2000 });
              await page.waitForTimeout(2000);

              const afterClick = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
              // Check if search was triggered (page content changed or input has value)
              const inputAfter = await findSearchInput(page);
              const valueAfter = inputAfter ? await inputAfter.inputValue().catch(() => '') : '';

              if (!valueAfter && afterClick.length < 500) {
                bugs.push({
                  id: uuidv4(),
                  severity: 'low',
                  title: 'Clicking history item does not re-execute search',
                  category: 'Search & Prompts',
                  testId: 'search_history_click',
                  description: 'Clicking on a history item does not re-populate the search box or trigger a new search',
                  stepsToReproduce: ['Navigate to ' + url, 'Perform a search', 'Go back to search', 'Click a history item'],
                  expected: 'Search should re-execute with the selected term',
                  actual: 'Nothing happened when clicking history item',
                  url,
                  timestamp: new Date().toISOString()
                });
              }
            } catch {
              // Element not clickable
            }
          }
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 6. Duplicate Consecutive Search Prevention ───
    broadcast({ type: 'log', text: 'Testing duplicate consecutive search handling...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const dupInput = await findSearchInput(page);
      if (dupInput) {
        const dupTerm = `dup_check_${Date.now()}`;
        // Search same term twice
        for (let i = 0; i < 2; i++) {
          const inp = await findSearchInput(page);
          if (!inp) break;
          await inp.click();
          await inp.fill(dupTerm);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1500);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        }

        // Check history for duplicates
        const inp3 = await findSearchInput(page);
        if (inp3) {
          await inp3.click();
          await page.waitForTimeout(1000);
          const content = await page.content();
          const matches = content.split(dupTerm).length - 1;

          if (matches > 1) {
            bugs.push({
              id: uuidv4(),
              severity: 'low',
              title: 'Duplicate consecutive searches stored in history',
              category: 'Search & Prompts',
              testId: 'search_history_dedup',
              description: 'Searching the same term twice consecutively creates duplicate entries in history',
              stepsToReproduce: ['Navigate to ' + url, 'Search for the same term twice', 'Open history'],
              expected: 'Consecutive duplicate searches should not create multiple history entries',
              actual: `Term appears ${matches} times in history`,
              url,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 7. History Timestamps ───
    broadcast({ type: 'log', text: 'Checking for history timestamps...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const tsInput = await findSearchInput(page);
      if (tsInput) {
        await tsInput.click();
        await page.waitForTimeout(1000);

        const hasTimestamps = await page.evaluate(() => {
          const historyArea = document.querySelector('[class*="history"], [class*="recent"]');
          if (!historyArea) return null;
          const text = historyArea.innerText;
          const timePatterns = /\d{1,2}:\d{2}|ago|today|yesterday|just now|\d{1,2}\/\d{1,2}|\d{4}-\d{2}/i;
          return timePatterns.test(text);
        });

        if (hasTimestamps === false) {
          bugs.push({
            id: uuidv4(),
            severity: 'info',
            title: 'Search history does not display timestamps',
            category: 'Search & Prompts',
            testId: 'search_history_timestamps',
            description: 'Search history items do not show when the search was performed',
            stepsToReproduce: ['Navigate to ' + url, 'Perform a few searches', 'Open history', 'Look for timestamps'],
            expected: 'History items should show relative or absolute timestamps',
            actual: 'No timestamps found in history UI',
            url,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      // Non-critical
    }

    broadcast({ type: 'log', text: `Search history testing complete — ${bugs.length} bug(s) found`, color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `History test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runSearchDelete(page, url, options, broadcast) {
  const bugs = [];
  const timeout = (options.timeout || 30) * 1000;

  broadcast({ type: 'log', text: 'Testing history deletion (comprehensive)...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    // Seed some history items first
    for (let i = 0; i < 3; i++) {
      const input = await findSearchInput(page);
      if (!input) break;
      await input.click();
      await input.fill(`delete_test_${i}_${Date.now()}`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    }

    // ─── 1. Find Delete / Clear Controls ───
    const deleteSelectors = [
      '[aria-label*="clear" i]', '[aria-label*="delete" i]', '[aria-label*="remove" i]',
      '[class*="clear" i]', '[class*="delete" i]', '[class*="remove" i]',
      'button:has-text("Clear")', 'button:has-text("Delete")', 'button:has-text("Remove")',
      'button:has-text("Clear All")', 'button:has-text("Clear History")',
      '[title*="delete" i]', '[title*="clear" i]', '[title*="remove" i]',
    ];

    // Trigger history UI first
    const triggerInput = await findSearchInput(page);
    if (triggerInput) {
      await triggerInput.click();
      await page.waitForTimeout(1000);
    }

    let clearButtons = [];
    for (const sel of deleteSelectors) {
      const found = await page.$$(sel).catch(() => []);
      clearButtons.push(...found);
    }

    // Deduplicate by element handle
    const uniqueButtons = [];
    const seen = new Set();
    for (const btn of clearButtons) {
      const text = await btn.textContent().catch(() => '');
      const label = await btn.getAttribute('aria-label').catch(() => '');
      const key = `${text}|${label}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueButtons.push(btn);
      }
    }

    if (uniqueButtons.length === 0) {
      broadcast({ type: 'log', text: 'No history delete/clear controls found', color: '#F5A623' });

      bugs.push({
        id: uuidv4(),
        severity: 'info',
        title: 'No history deletion controls found',
        category: 'Search & Prompts',
        testId: 'search_delete',
        description: 'No clear, delete, or remove buttons found for search history management',
        stepsToReproduce: ['Navigate to ' + url, 'Perform searches to build history', 'Look for delete/clear controls'],
        expected: 'Users should be able to manage their search history',
        actual: 'No deletion controls found',
        url,
        timestamp: new Date().toISOString()
      });

      return bugs;
    }

    broadcast({ type: 'log', text: `Found ${uniqueButtons.length} delete/clear control(s)`, color: '#4ECDC4' });

    // ─── 2. Test Individual Item Deletion ───
    broadcast({ type: 'log', text: 'Testing individual item deletion...', color: '#4ECDC4' });
    try {
      // Count history items before deletion
      const historyItemsBefore = await page.$$('[class*="history"] li, [class*="history"] > div, [class*="recent"] li, [class*="recent"] > div');
      const countBefore = historyItemsBefore.length;

      // Find per-item delete buttons (small X or delete icons next to items)
      const itemDeleteBtns = await page.$$('[class*="history"] button, [class*="history"] [role="button"], [class*="recent"] button, [class*="recent"] [role="button"]');

      if (itemDeleteBtns.length > 0) {
        const firstBtn = itemDeleteBtns[0];
        const isVisible = await firstBtn.isVisible().catch(() => false);
        if (isVisible) {
          await firstBtn.click({ timeout: 2000 });
          await page.waitForTimeout(1500);

          // Check for confirmation dialog
          const hasDialog = await page.evaluate(() => {
            return !!document.querySelector('[role="dialog"], [role="alertdialog"], .modal, .confirm, [class*="confirm"]');
          });

          if (hasDialog) {
            broadcast({ type: 'log', text: 'Confirmation dialog found for deletion', color: '#4ECDC4' });
            // Dismiss or confirm dialog
            const confirmBtn = await page.$('[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes"), [role="dialog"] button:has-text("Delete"), [role="alertdialog"] button:has-text("OK")');
            if (confirmBtn) {
              await confirmBtn.click({ timeout: 2000 }).catch(() => {});
              await page.waitForTimeout(1000);
            }
          }

          const historyItemsAfter = await page.$$('[class*="history"] li, [class*="history"] > div, [class*="recent"] li, [class*="recent"] > div');
          const countAfter = historyItemsAfter.length;

          if (countAfter >= countBefore && countBefore > 0) {
            bugs.push({
              id: uuidv4(),
              severity: 'medium',
              title: 'Individual history deletion did not remove item',
              category: 'Search & Prompts',
              testId: 'search_delete_individual',
              description: `Clicked delete on a history item but count did not decrease (before: ${countBefore}, after: ${countAfter})`,
              stepsToReproduce: ['Navigate to ' + url, 'Open search history', 'Click delete on an individual item'],
              expected: 'Item should be removed from the list',
              actual: 'Item count unchanged',
              url,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 3. Test "Clear All" Functionality ───
    broadcast({ type: 'log', text: 'Testing Clear All functionality...', color: '#4ECDC4' });
    try {
      const clearAllBtns = await page.$$('button:has-text("Clear All"), button:has-text("Clear History"), button:has-text("Delete All"), [aria-label*="clear all" i], [aria-label*="clear history" i]');

      for (const btn of clearAllBtns) {
        const isVisible = await btn.isVisible().catch(() => false);
        if (!isVisible) continue;

        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(1000);

        // Check for confirmation
        const hasConfirm = await page.evaluate(() => {
          return !!document.querySelector('[role="dialog"], [role="alertdialog"], .modal, .confirm');
        });

        if (!hasConfirm) {
          bugs.push({
            id: uuidv4(),
            severity: 'low',
            title: 'No confirmation dialog for "Clear All" history',
            category: 'Search & Prompts',
            testId: 'search_delete_clearall',
            description: 'Clicking "Clear All" immediately deletes all history without asking for confirmation',
            stepsToReproduce: ['Navigate to ' + url, 'Build up search history', 'Click Clear All'],
            expected: 'Confirmation dialog should appear for destructive bulk action',
            actual: 'History cleared immediately without confirmation',
            url,
            timestamp: new Date().toISOString()
          });
        } else {
          // Confirm the clear
          const confirmBtn = await page.$('[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes"), [role="dialog"] button:has-text("OK"), [role="dialog"] button:has-text("Clear")');
          if (confirmBtn) {
            await confirmBtn.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(1000);
          }
        }

        // Check if undo is available
        const undoBtn = await page.$('button:has-text("Undo"), [aria-label*="undo" i], [class*="undo"]');
        if (undoBtn) {
          broadcast({ type: 'log', text: 'Undo option found after Clear All', color: '#4ECDC4' });
        }

        break;
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 4. Verify Deletion Persists After Refresh ───
    broadcast({ type: 'log', text: 'Verifying deletion persists after refresh...', color: '#4ECDC4' });
    try {
      // First, delete something
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const preInput = await findSearchInput(page);
      if (preInput) {
        const deleteTerm = `persist_delete_${Date.now()}`;
        await preInput.click();
        await preInput.fill(deleteTerm);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

        // Try to delete it
        const postInput = await findSearchInput(page);
        if (postInput) {
          await postInput.click();
          await page.waitForTimeout(1000);

          // Find and click delete buttons near the term
          const allDeleteBtns = await page.$$('[class*="history"] button, [class*="recent"] button, button:has-text("Clear"), button:has-text("Delete")');
          for (const btn of allDeleteBtns.slice(0, 3)) {
            try {
              const vis = await btn.isVisible();
              if (vis) {
                await btn.click({ timeout: 1000 });
                await page.waitForTimeout(500);
                // Dismiss any confirmation
                const confirmBtn = await page.$('[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes"), [role="dialog"] button:has-text("OK")');
                if (confirmBtn) await confirmBtn.click({ timeout: 1000 }).catch(() => {});
                break;
              }
            } catch { continue; }
          }

          // Refresh and check
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
          await page.waitForTimeout(1000);
          const refreshInput = await findSearchInput(page);
          if (refreshInput) {
            await refreshInput.click();
            await page.waitForTimeout(1000);
            const content = await page.content();
            if (content.includes(deleteTerm)) {
              bugs.push({
                id: uuidv4(),
                severity: 'medium',
                title: 'Deleted history item reappears after page refresh',
                category: 'Search & Prompts',
                testId: 'search_delete_persist',
                description: 'A history item that was deleted reappears after refreshing the page',
                stepsToReproduce: ['Navigate to ' + url, 'Perform a search', 'Delete the history item', 'Refresh the page', 'Check history'],
                expected: 'Deleted items should stay deleted after refresh',
                actual: 'Deleted item reappeared',
                url,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 5. Keyboard Accessibility of Delete Actions ───
    broadcast({ type: 'log', text: 'Testing keyboard accessibility of delete actions...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const kbInput = await findSearchInput(page);
      if (kbInput) {
        await kbInput.focus();
        await page.waitForTimeout(500);

        // Tab to delete buttons
        for (let i = 0; i < 10; i++) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(200);
        }

        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            tag: el?.tagName,
            role: el?.getAttribute('role'),
            ariaLabel: el?.getAttribute('aria-label'),
            text: el?.textContent?.trim().slice(0, 50),
          };
        });

        const isFocusOnDelete = /delete|clear|remove/i.test(
          `${focusedElement.ariaLabel || ''} ${focusedElement.text || ''}`
        );

        // Check if any delete button is focusable
        const deleteBtnsTabIndex = await page.evaluate(() => {
          const btns = document.querySelectorAll('[class*="delete"], [class*="clear"], [class*="remove"], [aria-label*="delete"], [aria-label*="clear"]');
          return Array.from(btns).map(b => ({
            tag: b.tagName,
            tabIndex: b.tabIndex,
            role: b.getAttribute('role'),
          }));
        });

        const hasNonFocusable = deleteBtnsTabIndex.some(b =>
          b.tag !== 'BUTTON' && b.tag !== 'A' && b.tabIndex < 0 && !b.role
        );

        if (hasNonFocusable) {
          bugs.push({
            id: uuidv4(),
            severity: 'medium',
            title: 'Delete controls not keyboard accessible',
            category: 'Search & Prompts',
            testId: 'search_delete_a11y',
            description: 'Some delete/clear controls are not focusable via keyboard (non-button elements without tabindex or role)',
            stepsToReproduce: ['Navigate to ' + url, 'Open search history', 'Try to Tab to delete buttons'],
            expected: 'All interactive delete controls should be keyboard focusable',
            actual: 'Some delete controls are not reachable via Tab',
            url,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 6. Screen Reader Announcements for Deletion ───
    broadcast({ type: 'log', text: 'Checking screen reader announcements for delete actions...', color: '#4ECDC4' });
    try {
      const liveRegions = await page.$$('[aria-live], [role="status"], [role="alert"]');
      const historyUI = await page.$$('[class*="history"], [class*="recent"]');

      if (historyUI.length > 0 && liveRegions.length === 0) {
        bugs.push({
          id: uuidv4(),
          severity: 'low',
          title: 'No ARIA live region for history deletion announcements',
          category: 'Search & Prompts',
          testId: 'search_delete_sr',
          description: 'When items are deleted from search history, there is no aria-live region to announce the change to screen readers',
          stepsToReproduce: ['Navigate to ' + url, 'Open search history', 'Delete an item', 'Check for aria-live announcements'],
          expected: 'Deletions should be announced via aria-live="polite" or role="status"',
          actual: 'No live region found near history UI',
          url,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 7. Rapid Click Debounce Protection ───
    broadcast({ type: 'log', text: 'Testing rapid click debounce on delete...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      // Seed a search
      const rapidInput = await findSearchInput(page);
      if (rapidInput) {
        await rapidInput.click();
        await rapidInput.fill(`rapid_delete_${Date.now()}`);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

        const rapidInput2 = await findSearchInput(page);
        if (rapidInput2) {
          await rapidInput2.click();
          await page.waitForTimeout(1000);
        }

        const rapidErrors = [];
        page.on('pageerror', (err) => rapidErrors.push(err.message));

        const deleteBtns = await page.$$('[class*="history"] button, [class*="recent"] button, button:has-text("Clear"), button:has-text("Delete")');
        for (const btn of deleteBtns.slice(0, 2)) {
          try {
            const vis = await btn.isVisible();
            if (!vis) continue;
            // Click rapidly
            for (let i = 0; i < 5; i++) {
              await btn.click({ timeout: 500, force: true }).catch(() => {});
            }
            break;
          } catch { continue; }
        }
        await page.waitForTimeout(1500);

        if (rapidErrors.length > 0) {
          bugs.push({
            id: uuidv4(),
            severity: 'medium',
            title: 'JavaScript errors from rapid delete clicks',
            category: 'Search & Prompts',
            testId: 'search_delete_debounce',
            description: `Rapidly clicking delete buttons caused ${rapidErrors.length} JS error(s): ${rapidErrors.slice(0, 2).join('; ')}`,
            stepsToReproduce: ['Navigate to ' + url, 'Open search history', 'Rapidly click a delete button 5 times'],
            expected: 'Delete action should be debounced or handle rapid clicks gracefully',
            actual: `${rapidErrors.length} error(s) thrown`,
            url,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ─── 8. Delete Animation / Transition ───
    broadcast({ type: 'log', text: 'Checking delete animation/transition...', color: '#4ECDC4' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const animInput = await findSearchInput(page);
      if (animInput) {
        await animInput.click();
        await page.waitForTimeout(1000);

        const historyItems = await page.$$('[class*="history"] li, [class*="history"] > div, [class*="recent"] li, [class*="recent"] > div');
        if (historyItems.length > 0) {
          const hasTransition = await page.evaluate(() => {
            const items = document.querySelectorAll('[class*="history"] li, [class*="history"] > div, [class*="recent"] li, [class*="recent"] > div');
            for (const item of items) {
              const style = getComputedStyle(item);
              if (style.transition !== 'all 0s ease 0s' && style.transition !== '' && style.transition !== 'none') {
                return true;
              }
              if (style.animation !== 'none' && style.animation !== '') {
                return true;
              }
            }
            return false;
          });

          if (!hasTransition) {
            bugs.push({
              id: uuidv4(),
              severity: 'info',
              title: 'No animation/transition on history item deletion',
              category: 'Search & Prompts',
              testId: 'search_delete_animation',
              description: 'History items disappear abruptly without any transition or animation effect',
              stepsToReproduce: ['Navigate to ' + url, 'Open search history', 'Delete an item', 'Observe the removal'],
              expected: 'Smooth fade-out or slide-out animation on deletion',
              actual: 'Items disappear immediately without transition',
              url,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (e) {
      // Non-critical
    }

    broadcast({ type: 'log', text: `History deletion testing complete — ${bugs.length} bug(s) found`, color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Delete test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runSearchPrompts, runSearchHistory, runSearchDelete };
