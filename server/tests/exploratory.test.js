const { v4: uuidv4 } = require('uuid');
const path = require('path');

/**
 * Exploratory & Ad-Hoc Tests
 * - Random click exploration
 * - Responsive breakpoint testing
 * - Accessibility quick scan
 */

const BREAKPOINTS = [
  { name: 'mobile', width: 320, height: 568 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop-sm', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'desktop-lg', width: 1920, height: 1080 },
];

async function runExpRandom(page, url, options, broadcast) {
  const bugs = [];
  const errors = [];

  broadcast({ type: 'log', text: 'Starting random click exploration...', color: '#4ECDC4' });

  // Track console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    errors.push(err.message);
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    // Get all clickable elements
    const clickables = await page.evaluate(() => {
      const elements = document.querySelectorAll('a, button, [role="button"], [onclick], input[type="submit"], input[type="button"]');
      return Array.from(elements)
        .map((el, idx) => ({
          index: idx,
          tag: el.tagName,
          text: el.textContent?.slice(0, 30) || '',
          visible: el.offsetParent !== null
        }))
        .filter(e => e.visible);
    });

    broadcast({ type: 'log', text: `Found ${clickables.length} clickable elements`, color: '#4ECDC4' });

    // Randomly select and click elements
    const shuffled = clickables.sort(() => Math.random() - 0.5).slice(0, 20);
    let clickCount = 0;
    let errorOnClick = 0;

    for (const item of shuffled) {
      try {
        const elements = await page.$$('a, button, [role="button"], [onclick], input[type="submit"], input[type="button"]');
        if (elements[item.index]) {
          const errorsBefore = errors.length;

          await elements[item.index].click({ timeout: 1000 }).catch(() => {});
          await page.waitForTimeout(300);
          clickCount++;

          if (errors.length > errorsBefore) {
            errorOnClick++;
          }

          // Navigate back if we left the page
          if (!page.url().includes(new URL(url).hostname)) {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
          }
        }
      } catch (e) {
        // Element might not be clickable
      }
    }

    if (errorOnClick > 3) {
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: `${errorOnClick} errors during random clicking`,
        category: 'Exploratory & Ad-Hoc',
        testId: 'exp_random',
        description: `Multiple JavaScript errors occurred during random exploration. Errors: ${errors.slice(0, 3).join('; ')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Randomly click various elements'],
        expected: 'No JavaScript errors',
        actual: `${errorOnClick} errors triggered`,
        consoleOutput: errors.slice(0, 5).join('\n'),
        url,
        timestamp: new Date().toISOString()
      });
    }

    broadcast({ type: 'log', text: `Clicked ${clickCount} elements, ${errorOnClick} caused errors`, color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Random exploration error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runExpResponsive(page, url, options, broadcast, screenshotDir) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing responsive breakpoints...', color: '#4ECDC4' });

  try {
    for (const breakpoint of BREAKPOINTS) {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });
      await page.waitForTimeout(1000);

      // Check for horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      if (overflow) {
        bugs.push({
          id: uuidv4(),
          severity: 'medium',
          title: `Horizontal overflow at ${breakpoint.name} (${breakpoint.width}px)`,
          category: 'Exploratory & Ad-Hoc',
          testId: 'exp_responsive',
          description: `Page has horizontal scroll at ${breakpoint.width}px viewport width`,
          stepsToReproduce: ['Resize browser to ' + breakpoint.width + 'px width', 'Check for horizontal scrollbar'],
          expected: 'No horizontal overflow',
          actual: 'Horizontal scrollbar visible',
          url,
          timestamp: new Date().toISOString()
        });
      }

      // Check for elements overflowing viewport
      const overflowingElements = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const elements = document.querySelectorAll('*');
        let count = 0;

        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          if (rect.right > viewportWidth + 10) { // 10px tolerance
            count++;
          }
        }
        return count;
      });

      if (overflowingElements > 5) {
        bugs.push({
          id: uuidv4(),
          severity: 'low',
          title: `${overflowingElements} elements overflow at ${breakpoint.name}`,
          category: 'Exploratory & Ad-Hoc',
          testId: 'exp_responsive',
          description: `Multiple elements extend beyond viewport at ${breakpoint.width}px`,
          stepsToReproduce: ['Resize browser to ' + breakpoint.width + 'px', 'Inspect overflowing elements'],
          expected: 'All elements fit within viewport',
          actual: `${overflowingElements} elements overflow`,
          url,
          timestamp: new Date().toISOString()
        });
      }

      // Take screenshot if enabled
      if (options.screenshots && screenshotDir) {
        await page.screenshot({
          path: path.join(screenshotDir, `responsive-${breakpoint.name}.png`),
          fullPage: true
        });
      }

      broadcast({ type: 'log', text: `${breakpoint.name}: ${overflow ? '⚠ overflow' : '✓ ok'}`, color: overflow ? '#FF6B35' : '#4ECDC4' });
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  } catch (error) {
    broadcast({ type: 'log', text: `Responsive test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runExpA11y(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Running accessibility quick scan...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const a11yIssues = await page.evaluate(() => {
      const issues = {
        missingAlt: 0,
        missingLabels: 0,
        emptyButtons: 0,
        emptyLinks: 0,
        missingLang: !document.documentElement.lang,
        noSkipLink: true,
        lowContrastSuspects: 0,
      };

      // Check images for alt text
      const images = document.querySelectorAll('img');
      for (const img of images) {
        if (!img.alt && !img.getAttribute('aria-label') && !img.getAttribute('aria-labelledby')) {
          issues.missingAlt++;
        }
      }

      // Check form inputs for labels
      const inputs = document.querySelectorAll('input, select, textarea');
      for (const input of inputs) {
        if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') continue;
        const hasLabel = input.id && document.querySelector(`label[for="${input.id}"]`);
        const hasAria = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
        const hasPlaceholder = input.placeholder;
        if (!hasLabel && !hasAria && !hasPlaceholder) {
          issues.missingLabels++;
        }
      }

      // Check buttons for accessible names
      const buttons = document.querySelectorAll('button, [role="button"]');
      for (const btn of buttons) {
        const hasText = btn.textContent?.trim();
        const hasAria = btn.getAttribute('aria-label') || btn.getAttribute('aria-labelledby');
        if (!hasText && !hasAria) {
          issues.emptyButtons++;
        }
      }

      // Check links for accessible names
      const links = document.querySelectorAll('a');
      for (const link of links) {
        const hasText = link.textContent?.trim();
        const hasAria = link.getAttribute('aria-label') || link.getAttribute('aria-labelledby');
        if (!hasText && !hasAria) {
          issues.emptyLinks++;
        }
      }

      // Check for skip link
      const skipLink = document.querySelector('a[href="#main"], a[href="#content"], .skip-link, .skip-to-content');
      issues.noSkipLink = !skipLink;

      return issues;
    });

    // Report issues
    if (a11yIssues.missingAlt > 0) {
      bugs.push({
        id: uuidv4(),
        severity: a11yIssues.missingAlt > 5 ? 'medium' : 'low',
        title: `${a11yIssues.missingAlt} images missing alt text`,
        category: 'Exploratory & Ad-Hoc',
        testId: 'exp_a11y',
        description: 'Images without alt text are inaccessible to screen reader users',
        stepsToReproduce: ['Navigate to ' + url, 'Inspect images for alt attributes'],
        expected: 'All images should have alt text',
        actual: `${a11yIssues.missingAlt} images missing alt`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    if (a11yIssues.missingLabels > 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: `${a11yIssues.missingLabels} form inputs missing labels`,
        category: 'Exploratory & Ad-Hoc',
        testId: 'exp_a11y',
        description: 'Form inputs without labels are difficult for screen reader users',
        stepsToReproduce: ['Navigate to ' + url, 'Check form inputs for associated labels'],
        expected: 'All form inputs should have labels',
        actual: `${a11yIssues.missingLabels} inputs missing labels`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    if (a11yIssues.emptyButtons > 0) {
      bugs.push({
        id: uuidv4(),
        severity: 'medium',
        title: `${a11yIssues.emptyButtons} buttons without accessible names`,
        category: 'Exploratory & Ad-Hoc',
        testId: 'exp_a11y',
        description: 'Buttons without text or aria-label are unusable for screen reader users',
        stepsToReproduce: ['Navigate to ' + url, 'Check buttons for text content or aria-label'],
        expected: 'All buttons should have accessible names',
        actual: `${a11yIssues.emptyButtons} buttons have no accessible name`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    if (a11yIssues.missingLang) {
      bugs.push({
        id: uuidv4(),
        severity: 'low',
        title: 'Missing lang attribute on html element',
        category: 'Exploratory & Ad-Hoc',
        testId: 'exp_a11y',
        description: 'The html element should have a lang attribute for screen readers',
        stepsToReproduce: ['View page source', 'Check <html> for lang attribute'],
        expected: '<html lang="en"> or appropriate language',
        actual: 'No lang attribute',
        url,
        timestamp: new Date().toISOString()
      });
    }

    const totalIssues = a11yIssues.missingAlt + a11yIssues.missingLabels + a11yIssues.emptyButtons + a11yIssues.emptyLinks;
    broadcast({
      type: 'log',
      text: `Accessibility scan: ${totalIssues} issues found`,
      color: totalIssues > 5 ? '#FF6B35' : (totalIssues > 0 ? '#F5A623' : '#4ECDC4')
    });
  } catch (error) {
    broadcast({ type: 'log', text: `A11y scan error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runExpRandom, runExpResponsive, runExpA11y };
