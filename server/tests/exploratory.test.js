const { v4: uuidv4 } = require('uuid');
const path = require('path');

/**
 * Exploratory & Ad-Hoc Tests
 * - Comprehensive random click exploration with intelligent prioritization
 * - 8-breakpoint responsive testing with touch targets, readability, orientation
 * - WCAG 2.1 Level AA accessibility scan
 */

const BREAKPOINTS = [
  { name: 'small-phone', width: 320, height: 568 },
  { name: 'iphone', width: 375, height: 667 },
  { name: 'modern-phone', width: 390, height: 844 },
  { name: 'ipad-portrait', width: 768, height: 1024 },
  { name: 'ipad-landscape', width: 1024, height: 768 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'desktop-lg', width: 1920, height: 1080 },
];

const CATEGORY = 'Exploratory & Ad-Hoc';

/* ========== runExpRandom ========== */

async function runExpRandom(page, url, options, broadcast) {
  const bugs = [];
  const consoleErrors = [];
  const unhandledRejections = [];
  const discoveredPages = new Set();
  const networkErrors = [];

  broadcast({ type: 'log', text: 'Starting comprehensive random exploration...', color: '#4ECDC4' });

  // Track console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    unhandledRejections.push(err.message);
  });

  // Track failed network requests
  page.on('requestfailed', req => {
    networkErrors.push({ url: req.url(), failure: req.failure()?.errorText || 'unknown' });
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });
    discoveredPages.add(page.url());

    /* --- Gather all interactive elements with priority --- */
    const elements = await page.evaluate(() => {
      const result = { buttons: [], navLinks: [], interactiveRoles: [], otherClickable: [] };

      // Priority 1: Buttons and CTAs
      const btns = document.querySelectorAll('button, input[type="submit"], input[type="button"], [class*="btn"], [class*="cta"]');
      for (const el of btns) {
        if (el.offsetParent !== null) {
          result.buttons.push({
            selector: el.id ? `#${el.id}` : null,
            text: (el.textContent || '').trim().slice(0, 40),
            tag: el.tagName,
          });
        }
      }

      // Priority 2: Navigation links
      const navLinks = document.querySelectorAll('nav a, header a, [role="navigation"] a');
      for (const el of navLinks) {
        if (el.offsetParent !== null) {
          result.navLinks.push({
            href: el.getAttribute('href') || '',
            text: (el.textContent || '').trim().slice(0, 40),
          });
        }
      }

      // Priority 3: Interactive role elements
      const roleEls = document.querySelectorAll('[role="button"], [role="tab"], [role="menuitem"], [role="link"], [tabindex]:not([tabindex="-1"])');
      for (const el of roleEls) {
        if (el.offsetParent !== null) {
          result.interactiveRoles.push({
            role: el.getAttribute('role') || 'tabindex',
            text: (el.textContent || '').trim().slice(0, 40),
            tag: el.tagName,
          });
        }
      }

      // Priority 4: Other clickable
      const others = document.querySelectorAll('a, [onclick], [class*="clickable"], [class*="link"], summary, details');
      for (const el of others) {
        if (el.offsetParent !== null && !el.closest('nav') && el.tagName !== 'BUTTON') {
          result.otherClickable.push({
            tag: el.tagName,
            text: (el.textContent || '').trim().slice(0, 40),
          });
        }
      }

      return result;
    });

    const totalFound = elements.buttons.length + elements.navLinks.length + elements.interactiveRoles.length + elements.otherClickable.length;
    broadcast({ type: 'log', text: `Found ${totalFound} interactive elements (${elements.buttons.length} buttons, ${elements.navLinks.length} nav links)`, color: '#4ECDC4' });

    /* --- Build prioritized click list --- */
    // We'll click actual DOM elements by index, so re-gather
    const allClickable = await page.$$('button, input[type="submit"], input[type="button"], [class*="btn"], [class*="cta"]');
    const allNavLinks = await page.$$('nav a, header a');
    const allRoleEls = await page.$$('[role="button"], [role="tab"], [role="menuitem"], [tabindex]:not([tabindex="-1"])');
    const allOthers = await page.$$('a:not(nav a):not(header a), [onclick], summary');

    // Combine with priority: buttons first, then nav, then roles, then others
    let clickTargets = [];

    for (const el of allClickable) {
      try { if (await el.isVisible()) clickTargets.push({ el, type: 'button' }); } catch {}
    }
    for (const el of allNavLinks) {
      try { if (await el.isVisible()) clickTargets.push({ el, type: 'nav' }); } catch {}
    }
    for (const el of allRoleEls) {
      try { if (await el.isVisible()) clickTargets.push({ el, type: 'role' }); } catch {}
    }
    for (const el of allOthers) {
      try { if (await el.isVisible()) clickTargets.push({ el, type: 'other' }); } catch {}
    }

    // Shuffle within each priority group but keep priority order
    const shuffle = arr => arr.sort(() => Math.random() - 0.5);
    const buttons = shuffle(clickTargets.filter(t => t.type === 'button'));
    const navs = shuffle(clickTargets.filter(t => t.type === 'nav'));
    const roles = shuffle(clickTargets.filter(t => t.type === 'role'));
    const others = shuffle(clickTargets.filter(t => t.type === 'other'));

    const ordered = [...buttons, ...navs, ...roles, ...others].slice(0, 45);

    let clickCount = 0;
    let errorOnClick = 0;
    let stateInconsistencies = 0;

    for (const target of ordered) {
      try {
        const errorsBefore = consoleErrors.length + unhandledRejections.length;
        const urlBefore = page.url();

        // Check for frozen UI: set a timer and see if setTimeout resolves promptly
        const frozenCheck = await page.evaluate(() => {
          return new Promise(resolve => {
            const start = Date.now();
            setTimeout(() => resolve(Date.now() - start), 0);
          });
        });

        if (frozenCheck > 500) {
          bugs.push({
            id: uuidv4(), severity: 'high',
            title: 'UI appears frozen/unresponsive',
            category: CATEGORY, testId: 'exp_random',
            description: `UI event loop was blocked for ${frozenCheck}ms, indicating a frozen interface`,
            stepsToReproduce: ['Navigate to ' + url, `Interact with the page after ${clickCount} clicks`],
            expected: 'UI remains responsive', actual: `Event loop blocked for ${frozenCheck}ms`,
            url: page.url(), timestamp: new Date().toISOString()
          });
          break; // Stop if UI is frozen
        }

        await target.el.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(400);
        clickCount++;

        const urlAfter = page.url();
        discoveredPages.add(urlAfter);

        if (consoleErrors.length + unhandledRejections.length > errorsBefore) {
          errorOnClick++;
        }

        // Navigate back if we left the domain
        try {
          const currentHost = new URL(page.url()).hostname;
          const originalHost = new URL(url).hostname;
          if (currentHost !== originalHost) {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
          }
        } catch {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        }
      } catch {
        // Element might be stale or not clickable
      }
    }

    broadcast({ type: 'log', text: `Clicked ${clickCount} elements, ${errorOnClick} caused errors`, color: '#4ECDC4' });

    /* --- Report console errors --- */
    if (errorOnClick > 3) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: `${errorOnClick} errors during random exploration`,
        category: CATEGORY, testId: 'exp_random',
        description: `Multiple JavaScript errors occurred during random exploration. Errors: ${consoleErrors.slice(0, 5).join('; ')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Randomly click various interactive elements'],
        expected: 'No JavaScript errors on click interactions',
        actual: `${errorOnClick} errors triggered across ${clickCount} clicks`,
        url, timestamp: new Date().toISOString()
      });
    }

    if (unhandledRejections.length > 0) {
      bugs.push({
        id: uuidv4(), severity: 'high',
        title: `${unhandledRejections.length} unhandled promise rejections`,
        category: CATEGORY, testId: 'exp_random',
        description: `Unhandled promise rejections detected: ${unhandledRejections.slice(0, 3).join('; ')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Interact with the page'],
        expected: 'All promises should be handled', actual: `${unhandledRejections.length} unhandled rejections`,
        url, timestamp: new Date().toISOString()
      });
    }

    if (networkErrors.length > 3) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: `${networkErrors.length} failed network requests during exploration`,
        category: CATEGORY, testId: 'exp_random',
        description: `Failed requests: ${networkErrors.slice(0, 5).map(e => `${e.url} (${e.failure})`).join('; ')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Interact with elements on the page'],
        expected: 'Network requests should succeed', actual: `${networkErrors.length} requests failed`,
        url, timestamp: new Date().toISOString()
      });
    }

    /* --- Test hover states --- */
    broadcast({ type: 'log', text: 'Testing hover states and tooltips...', color: '#4ECDC4' });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const hoverTargets = await page.$$('button, [title], [data-tooltip], [aria-describedby], [class*="tooltip"], nav a');
    let tooltipCount = 0;
    for (const target of hoverTargets.slice(0, 15)) {
      try {
        if (!(await target.isVisible())) continue;
        await target.hover();
        await page.waitForTimeout(500);

        const tooltipVisible = await page.evaluate(() => {
          const tips = document.querySelectorAll('[role="tooltip"], [class*="tooltip"], [class*="popover"]');
          return Array.from(tips).some(t => t.offsetParent !== null || window.getComputedStyle(t).display !== 'none');
        });
        if (tooltipVisible) tooltipCount++;
      } catch {}
    }

    /* --- Test right-click context menus --- */
    try {
      const mainContent = await page.$('main, [role="main"], #content, .content, body');
      if (mainContent) {
        await mainContent.click({ button: 'right' });
        await page.waitForTimeout(500);
        // Just checking it doesn't crash
        await page.keyboard.press('Escape');
      }
    } catch {}

    /* --- Focus trap detection & keyboard navigation --- */
    broadcast({ type: 'log', text: 'Testing keyboard navigation and focus traps...', color: '#4ECDC4' });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const focusResults = await page.evaluate(() => {
      const results = { totalFocusable: 0, focusVisible: 0, focusTrapped: false, trappedElement: null, focusOrder: [], deadZones: [] };

      // Get all focusable elements
      const focusable = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable]');
      results.totalFocusable = focusable.length;

      return results;
    });

    // Tab through elements to check focus visibility
    let tabCount = 0;
    let focusVisibleCount = 0;
    let prevFocused = null;
    let focusTrapDetected = false;
    const focusSeen = new Set();

    for (let i = 0; i < Math.min(focusResults.totalFocusable, 30); i++) {
      try {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(150);

        const focusInfo = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;

          const styles = window.getComputedStyle(el);
          const outlineVisible = styles.outlineStyle !== 'none' && styles.outlineWidth !== '0px';
          const boxShadow = styles.boxShadow !== 'none';
          const borderChanged = styles.borderColor !== 'rgb(0, 0, 0)'; // rough check

          return {
            tag: el.tagName,
            id: el.id || '',
            text: (el.textContent || '').trim().slice(0, 30),
            hasFocusIndicator: outlineVisible || boxShadow,
            rect: el.getBoundingClientRect(),
          };
        });

        if (focusInfo) {
          tabCount++;
          if (focusInfo.hasFocusIndicator) focusVisibleCount++;

          // Detect focus trap
          const focusKey = `${focusInfo.tag}-${focusInfo.id}-${focusInfo.text}`;
          if (focusSeen.has(focusKey) && focusSeen.size < 3) {
            focusTrapDetected = true;
            break;
          }
          focusSeen.add(focusKey);
        }
      } catch {}
    }

    if (tabCount > 5 && focusVisibleCount < tabCount * 0.5) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: `${tabCount - focusVisibleCount}/${tabCount} focusable elements lack visible focus indicator`,
        category: CATEGORY, testId: 'exp_random',
        description: 'Many focusable elements do not show a visible focus indicator when tabbed to',
        stepsToReproduce: ['Navigate to ' + url, 'Press Tab repeatedly to move focus'],
        expected: 'Each focusable element has a visible focus indicator (outline, shadow, etc.)',
        actual: `Only ${focusVisibleCount} of ${tabCount} elements showed visible focus`,
        url, timestamp: new Date().toISOString()
      });
    }

    if (focusTrapDetected) {
      bugs.push({
        id: uuidv4(), severity: 'high',
        title: 'Focus trap detected during keyboard navigation',
        category: CATEGORY, testId: 'exp_random',
        description: 'Tab key cycling through fewer than 3 unique elements suggests a focus trap',
        stepsToReproduce: ['Navigate to ' + url, 'Press Tab repeatedly'],
        expected: 'Focus should move through all interactive elements', actual: 'Focus is trapped in a small loop',
        url, timestamp: new Date().toISOString()
      });
    }

    /* --- Scroll behavior: infinite scroll / lazy load errors --- */
    broadcast({ type: 'log', text: 'Testing scroll behavior...', color: '#4ECDC4' });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    try {
      const scrollErrorsBefore = consoleErrors.length;

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);

      // Check if new content loaded (infinite scroll)
      const bodyHeight1 = await page.evaluate(() => document.body.scrollHeight);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      const bodyHeight2 = await page.evaluate(() => document.body.scrollHeight);

      if (consoleErrors.length > scrollErrorsBefore + 2) {
        bugs.push({
          id: uuidv4(), severity: 'medium',
          title: 'Errors triggered during scrolling',
          category: CATEGORY, testId: 'exp_random',
          description: `Scrolling to the bottom of the page triggered ${consoleErrors.length - scrollErrorsBefore} console errors`,
          stepsToReproduce: ['Navigate to ' + url, 'Scroll to the bottom of the page'],
          expected: 'No errors during scrolling', actual: 'Console errors appeared',
          url, timestamp: new Date().toISOString()
        });
      }
    } catch {}

    /* --- Dead zone detection --- */
    const deadZones = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gridSize = 200;
      const deadAreas = [];

      for (let x = 0; x < vw; x += gridSize) {
        for (let y = 0; y < vh; y += gridSize) {
          const el = document.elementFromPoint(x + gridSize / 2, y + gridSize / 2);
          if (el && (el === document.body || el === document.documentElement)) {
            deadAreas.push({ x, y });
          }
        }
      }

      const totalCells = Math.ceil(vw / gridSize) * Math.ceil(vh / gridSize);
      return { deadCount: deadAreas.length, totalCells, ratio: deadAreas.length / totalCells };
    });

    if (deadZones.ratio > 0.5) {
      bugs.push({
        id: uuidv4(), severity: 'low',
        title: `Large dead zones: ${Math.round(deadZones.ratio * 100)}% of viewport has no interactive content`,
        category: CATEGORY, testId: 'exp_random',
        description: `${deadZones.deadCount} of ${deadZones.totalCells} grid cells are empty (just body/html), indicating potential layout issues or missing content`,
        stepsToReproduce: ['Navigate to ' + url, 'Observe page layout for large empty areas'],
        expected: 'Page content fills the viewport reasonably', actual: `${Math.round(deadZones.ratio * 100)}% of viewport is empty`,
        url, timestamp: new Date().toISOString()
      });
    }

    /* --- Exploration map --- */
    broadcast({ type: 'log', text: `Exploration map: discovered ${discoveredPages.size} distinct URLs`, color: '#4ECDC4' });
    broadcast({ type: 'log', text: `Random exploration complete. ${bugs.length} issues found.`, color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Random exploration error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

/* ========== runExpResponsive ========== */

async function runExpResponsive(page, url, options, broadcast, screenshotDir) {
  const bugs = [];
  let responsiveScore = 100; // Start at 100, deduct for issues

  broadcast({ type: 'log', text: 'Testing responsive design across 8 breakpoints...', color: '#4ECDC4' });

  try {
    /* --- Check viewport meta tag --- */
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const hasViewportMeta = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta ? meta.getAttribute('content') : null;
    });

    if (!hasViewportMeta) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: 'Missing viewport meta tag',
        category: CATEGORY, testId: 'exp_responsive',
        description: 'The page is missing a viewport meta tag, which is required for proper mobile rendering',
        stepsToReproduce: ['View page source', 'Check for <meta name="viewport"> in <head>'],
        expected: '<meta name="viewport" content="width=device-width, initial-scale=1">',
        actual: 'No viewport meta tag found',
        url, timestamp: new Date().toISOString()
      });
      responsiveScore -= 15;
    }

    /* --- Test each breakpoint --- */
    for (const breakpoint of BREAKPOINTS) {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });
      await page.waitForTimeout(1000);

      const isMobile = breakpoint.width <= 480;
      const isTablet = breakpoint.width > 480 && breakpoint.width <= 1024;

      /* --- Horizontal overflow --- */
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      if (overflow) {
        bugs.push({
          id: uuidv4(), severity: 'medium',
          title: `Horizontal overflow at ${breakpoint.name} (${breakpoint.width}px)`,
          category: CATEGORY, testId: 'exp_responsive',
          description: `Page has horizontal scroll at ${breakpoint.width}px viewport width`,
          stepsToReproduce: [`Resize browser to ${breakpoint.width}px width`, 'Check for horizontal scrollbar'],
          expected: 'No horizontal overflow', actual: 'Horizontal scrollbar visible',
          url, timestamp: new Date().toISOString()
        });
        responsiveScore -= 5;
      }

      /* --- Elements overflowing viewport --- */
      const overflowingElements = await page.evaluate(() => {
        const vw = window.innerWidth;
        const elements = document.querySelectorAll('*');
        let count = 0;
        const examples = [];

        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          if (rect.right > vw + 10 && rect.width > 0) {
            count++;
            if (examples.length < 3) {
              examples.push({ tag: el.tagName, class: el.className?.toString().slice(0, 50) || '', overflow: Math.round(rect.right - vw) });
            }
          }
        }
        return { count, examples };
      });

      if (overflowingElements.count > 5) {
        bugs.push({
          id: uuidv4(), severity: 'low',
          title: `${overflowingElements.count} elements overflow at ${breakpoint.name} (${breakpoint.width}px)`,
          category: CATEGORY, testId: 'exp_responsive',
          description: `Multiple elements extend beyond viewport. Examples: ${overflowingElements.examples.map(e => `${e.tag}.${e.class} (+${e.overflow}px)`).join(', ')}`,
          stepsToReproduce: [`Resize browser to ${breakpoint.width}px`, 'Inspect overflowing elements'],
          expected: 'All elements fit within viewport', actual: `${overflowingElements.count} elements overflow`,
          url, timestamp: new Date().toISOString()
        });
        responsiveScore -= 3;
      }

      /* --- Navigation: hamburger menu on mobile --- */
      if (isMobile || isTablet) {
        const navCheck = await page.evaluate(() => {
          // Check if nav is visible or collapsed
          const nav = document.querySelector('nav, [role="navigation"]');
          if (!nav) return { hasNav: false };

          const navVisible = nav.offsetParent !== null && window.getComputedStyle(nav).display !== 'none';
          const navLinks = nav.querySelectorAll('a');
          const visibleLinks = Array.from(navLinks).filter(a => a.offsetParent !== null);

          // Check for hamburger / menu button
          const hamburger = document.querySelector('[class*="hamburger"], [class*="menu-toggle"], [class*="mobile-menu"], button[aria-label*="menu" i], button[aria-expanded], [class*="burger"]');

          return {
            hasNav: true,
            navVisible,
            totalLinks: navLinks.length,
            visibleLinks: visibleLinks.length,
            hasHamburger: !!hamburger,
            hamburgerVisible: hamburger ? hamburger.offsetParent !== null : false,
          };
        });

        if (navCheck.hasNav && navCheck.visibleLinks > 5 && !navCheck.hasHamburger) {
          bugs.push({
            id: uuidv4(), severity: 'medium',
            title: `Navigation not collapsed at ${breakpoint.name} (${breakpoint.width}px)`,
            category: CATEGORY, testId: 'exp_responsive',
            description: `${navCheck.visibleLinks} nav links visible on mobile/tablet without hamburger menu`,
            stepsToReproduce: [`Resize to ${breakpoint.width}px`, 'Check navigation layout'],
            expected: 'Navigation should collapse into hamburger menu on small screens',
            actual: `${navCheck.visibleLinks} links visible, no hamburger menu found`,
            url, timestamp: new Date().toISOString()
          });
          responsiveScore -= 5;
        }

        // Test hamburger menu works
        if (navCheck.hasHamburger && navCheck.hamburgerVisible) {
          try {
            const hamburger = await page.$('[class*="hamburger"], [class*="menu-toggle"], [class*="mobile-menu"], button[aria-label*="menu" i], button[aria-expanded], [class*="burger"]');
            if (hamburger) {
              await hamburger.click();
              await page.waitForTimeout(800);

              const menuOpened = await page.evaluate(() => {
                const menuEl = document.querySelector('[class*="mobile-nav"], [class*="drawer"], [class*="sidebar"], [class*="menu-open"], nav[class*="open"], [class*="menu-panel"]');
                const navLinks = document.querySelectorAll('nav a, [role="navigation"] a');
                const visibleAfter = Array.from(navLinks).filter(a => a.offsetParent !== null);
                return visibleAfter.length > 0 || !!menuEl;
              });

              if (!menuOpened) {
                bugs.push({
                  id: uuidv4(), severity: 'medium',
                  title: `Hamburger menu does not open at ${breakpoint.name}`,
                  category: CATEGORY, testId: 'exp_responsive',
                  description: 'Clicking the hamburger/menu button did not reveal navigation links',
                  stepsToReproduce: [`Resize to ${breakpoint.width}px`, 'Click hamburger menu icon'],
                  expected: 'Navigation menu opens', actual: 'No navigation links visible after click',
                  url, timestamp: new Date().toISOString()
                });
                responsiveScore -= 5;
              }

              // Close menu
              await hamburger.click().catch(() => {});
              await page.waitForTimeout(500);
            }
          } catch {}
        }
      }

      /* --- Text readability: font sizes --- */
      const fontCheck = await page.evaluate(() => {
        const textElements = document.querySelectorAll('p, span, a, li, td, th, label, div');
        let tooSmall = 0;
        let totalChecked = 0;

        for (const el of textElements) {
          const text = (el.textContent || '').trim();
          if (!text || text.length < 3 || el.children.length > 2) continue;
          if (el.offsetParent === null) continue;

          totalChecked++;
          const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
          if (fontSize < 12) tooSmall++;
        }

        return { tooSmall, totalChecked };
      });

      if (fontCheck.tooSmall > 3) {
        bugs.push({
          id: uuidv4(), severity: 'low',
          title: `${fontCheck.tooSmall} text elements too small at ${breakpoint.name} (${breakpoint.width}px)`,
          category: CATEGORY, testId: 'exp_responsive',
          description: `${fontCheck.tooSmall} text elements have font-size below 12px, hurting readability`,
          stepsToReproduce: [`Resize to ${breakpoint.width}px`, 'Check text sizes'],
          expected: 'Minimum 12px font size for body text', actual: `${fontCheck.tooSmall} elements below 12px`,
          url, timestamp: new Date().toISOString()
        });
        responsiveScore -= 3;
      }

      /* --- Touch target sizes on mobile --- */
      if (isMobile) {
        const touchTargets = await page.evaluate(() => {
          const interactive = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [tabindex]');
          let tooSmall = 0;
          let totalChecked = 0;
          const examples = [];

          for (const el of interactive) {
            if (el.offsetParent === null) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;

            totalChecked++;
            if (rect.width < 44 || rect.height < 44) {
              tooSmall++;
              if (examples.length < 3) {
                examples.push({
                  tag: el.tagName,
                  text: (el.textContent || '').trim().slice(0, 30),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                });
              }
            }
          }

          return { tooSmall, totalChecked, examples };
        });

        if (touchTargets.tooSmall > 3) {
          bugs.push({
            id: uuidv4(), severity: 'medium',
            title: `${touchTargets.tooSmall} touch targets too small at ${breakpoint.name}`,
            category: CATEGORY, testId: 'exp_responsive',
            description: `${touchTargets.tooSmall}/${touchTargets.totalChecked} interactive elements are smaller than 44x44px. Examples: ${touchTargets.examples.map(e => `${e.tag} "${e.text}" (${e.width}x${e.height})`).join(', ')}`,
            stepsToReproduce: [`Resize to ${breakpoint.width}px`, 'Measure interactive element sizes'],
            expected: 'Touch targets at least 44x44px on mobile', actual: `${touchTargets.tooSmall} elements below minimum`,
            url, timestamp: new Date().toISOString()
          });
          responsiveScore -= 5;
        }
      }

      /* --- Image sizing: responsive images --- */
      const imageCheck = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img');
        let oversized = 0;
        let noSrcset = 0;
        let total = 0;

        for (const img of imgs) {
          if (img.offsetParent === null) continue;
          total++;
          const rect = img.getBoundingClientRect();

          // Image wider than viewport
          if (rect.width > window.innerWidth + 5) oversized++;

          // Check for responsive image attributes
          if (!img.srcset && !img.closest('picture')) noSrcset++;
        }

        return { oversized, noSrcset, total };
      });

      if (imageCheck.oversized > 0) {
        bugs.push({
          id: uuidv4(), severity: 'medium',
          title: `${imageCheck.oversized} images overflow viewport at ${breakpoint.name}`,
          category: CATEGORY, testId: 'exp_responsive',
          description: `${imageCheck.oversized} images are wider than the viewport at ${breakpoint.width}px`,
          stepsToReproduce: [`Resize to ${breakpoint.width}px`, 'Check image sizing'],
          expected: 'Images should resize within viewport', actual: `${imageCheck.oversized} images overflow`,
          url, timestamp: new Date().toISOString()
        });
        responsiveScore -= 3;
      }

      /* --- Hidden content detection --- */
      const hiddenContent = await page.evaluate(() => {
        const important = document.querySelectorAll('main, [role="main"], h1, h2, form, [class*="hero"], [class*="cta"], [class*="primary"]');
        let hiddenCount = 0;
        const hiddenElements = [];

        for (const el of important) {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            hiddenCount++;
            hiddenElements.push(el.tagName + (el.className ? '.' + el.className.toString().split(' ')[0] : ''));
          }
        }

        return { hiddenCount, hiddenElements };
      });

      if (hiddenContent.hiddenCount > 0) {
        bugs.push({
          id: uuidv4(), severity: 'medium',
          title: `${hiddenContent.hiddenCount} critical elements hidden at ${breakpoint.name}`,
          category: CATEGORY, testId: 'exp_responsive',
          description: `Important content is hidden (display:none/visibility:hidden) at ${breakpoint.width}px: ${hiddenContent.hiddenElements.join(', ')}`,
          stepsToReproduce: [`Resize to ${breakpoint.width}px`, 'Check for missing critical content'],
          expected: 'Critical content visible at all breakpoints', actual: `Hidden: ${hiddenContent.hiddenElements.join(', ')}`,
          url, timestamp: new Date().toISOString()
        });
        responsiveScore -= 8;
      }

      /* --- Z-index stacking / overlapping elements --- */
      const stackingIssues = await page.evaluate(() => {
        const fixed = document.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"]');
        const sticky = document.querySelectorAll('[style*="position: sticky"], [style*="position:sticky"]');
        const allEls = document.querySelectorAll('*');
        let overlaps = 0;

        // Check computed positions
        const positioned = [];
        for (const el of allEls) {
          const style = window.getComputedStyle(el);
          if ((style.position === 'fixed' || style.position === 'sticky') && el.offsetParent !== null) {
            positioned.push({
              rect: el.getBoundingClientRect(),
              zIndex: parseInt(style.zIndex) || 0,
              tag: el.tagName,
            });
          }
        }

        // Check for overlapping fixed/sticky elements
        for (let i = 0; i < positioned.length; i++) {
          for (let j = i + 1; j < positioned.length; j++) {
            const a = positioned[i].rect;
            const b = positioned[j].rect;
            if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
              overlaps++;
            }
          }
        }

        return { overlaps, fixedCount: positioned.length };
      });

      if (stackingIssues.overlaps > 0) {
        bugs.push({
          id: uuidv4(), severity: 'low',
          title: `${stackingIssues.overlaps} overlapping fixed/sticky elements at ${breakpoint.name}`,
          category: CATEGORY, testId: 'exp_responsive',
          description: `Fixed or sticky elements overlap at ${breakpoint.width}px viewport`,
          stepsToReproduce: [`Resize to ${breakpoint.width}px`, 'Check for overlapping headers/footers/modals'],
          expected: 'Fixed/sticky elements should not overlap', actual: `${stackingIssues.overlaps} overlaps detected`,
          url, timestamp: new Date().toISOString()
        });
        responsiveScore -= 3;
      }

      /* --- Take screenshot --- */
      if (options.screenshots && screenshotDir) {
        await page.screenshot({
          path: path.join(screenshotDir, `responsive-${breakpoint.name}.png`),
          fullPage: true,
        });
      }

      broadcast({
        type: 'log',
        text: `${breakpoint.name} (${breakpoint.width}px): ${overflow ? 'overflow' : 'ok'}`,
        color: overflow ? '#FF6B35' : '#4ECDC4',
      });
    }

    /* --- Orientation testing: landscape for mobile breakpoints --- */
    broadcast({ type: 'log', text: 'Testing landscape orientation for mobile...', color: '#4ECDC4' });

    const mobileBreakpoints = BREAKPOINTS.filter(b => b.width <= 480);
    for (const bp of mobileBreakpoints) {
      // Swap width and height for landscape
      await page.setViewportSize({ width: bp.height, height: bp.width });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });
      await page.waitForTimeout(800);

      const landscapeOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      if (landscapeOverflow) {
        bugs.push({
          id: uuidv4(), severity: 'low',
          title: `Horizontal overflow in landscape at ${bp.name} (${bp.height}x${bp.width})`,
          category: CATEGORY, testId: 'exp_responsive',
          description: `Page overflows horizontally in landscape orientation on ${bp.name}`,
          stepsToReproduce: [`Rotate ${bp.name} to landscape (${bp.height}x${bp.width})`, 'Check for horizontal scroll'],
          expected: 'No overflow in landscape', actual: 'Horizontal overflow detected',
          url, timestamp: new Date().toISOString()
        });
        responsiveScore -= 2;
      }

      if (options.screenshots && screenshotDir) {
        await page.screenshot({
          path: path.join(screenshotDir, `responsive-${bp.name}-landscape.png`),
          fullPage: true,
        });
      }
    }

    /* --- Transition testing: resize from desktop to mobile --- */
    broadcast({ type: 'log', text: 'Testing resize transitions...', color: '#4ECDC4' });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const resizeSteps = [1440, 1280, 1024, 768, 480, 375, 320];
    let previousOverflow = false;

    for (const width of resizeSteps) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(500);

      const currentOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      // Detect breakpoint jumps: overflow appears and disappears
      if (currentOverflow && !previousOverflow && width > 320) {
        // This is normal at some breakpoints, just noting it
      }

      previousOverflow = currentOverflow;
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // Clamp score
    responsiveScore = Math.max(0, responsiveScore);

    broadcast({ type: 'log', text: `Responsive testing complete. Score: ${responsiveScore}/100. ${bugs.length} issues found.`, color: responsiveScore > 70 ? '#4ECDC4' : '#FF6B35' });
  } catch (error) {
    broadcast({ type: 'log', text: `Responsive test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

/* ========== runExpA11y ========== */

async function runExpA11y(page, url, options, broadcast) {
  const bugs = [];
  let a11yScore = 100;

  broadcast({ type: 'log', text: 'Running comprehensive WCAG 2.1 Level AA accessibility scan...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    /* --- Core checks (existing + enhanced) --- */
    const coreIssues = await page.evaluate(() => {
      const issues = {
        missingAlt: 0,
        missingLabels: 0,
        emptyButtons: 0,
        emptyLinks: 0,
        missingLang: !document.documentElement.lang,
        noSkipLink: true,
        genericLinks: 0,
        headingIssues: [],
        ariaIssues: [],
        landmarkIssues: [],
        semanticIssues: [],
        tableIssues: 0,
        iframeIssues: 0,
        mediaIssues: 0,
        autoPlayContent: false,
      };

      // --- Images without alt ---
      const images = document.querySelectorAll('img');
      for (const img of images) {
        if (!img.alt && !img.getAttribute('aria-label') && !img.getAttribute('aria-labelledby') && img.getAttribute('role') !== 'presentation') {
          issues.missingAlt++;
        }
      }

      // --- Form inputs without labels ---
      const inputs = document.querySelectorAll('input, select, textarea');
      for (const input of inputs) {
        if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') continue;
        const hasLabel = input.id && document.querySelector(`label[for="${input.id}"]`);
        const hasAria = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
        const hasTitle = input.getAttribute('title');
        if (!hasLabel && !hasAria && !hasTitle) {
          issues.missingLabels++;
        }
      }

      // --- Buttons without accessible names ---
      const buttons = document.querySelectorAll('button, [role="button"]');
      for (const btn of buttons) {
        const hasText = (btn.textContent || '').trim();
        const hasAria = btn.getAttribute('aria-label') || btn.getAttribute('aria-labelledby');
        const hasTitle = btn.getAttribute('title');
        const hasImg = btn.querySelector('img[alt], svg[aria-label]');
        if (!hasText && !hasAria && !hasTitle && !hasImg) {
          issues.emptyButtons++;
        }
      }

      // --- Links without accessible names ---
      const links = document.querySelectorAll('a');
      for (const link of links) {
        const hasText = (link.textContent || '').trim();
        const hasAria = link.getAttribute('aria-label') || link.getAttribute('aria-labelledby');
        const hasTitle = link.getAttribute('title');
        if (!hasText && !hasAria && !hasTitle) {
          issues.emptyLinks++;
        }
        // Generic link text
        const genericPatterns = /^(click here|read more|learn more|here|more|link|details)$/i;
        if (genericPatterns.test(hasText) && !link.getAttribute('aria-label')) {
          issues.genericLinks++;
        }
      }

      // --- Skip link ---
      const skipLink = document.querySelector('a[href="#main"], a[href="#content"], a[href="#main-content"], .skip-link, .skip-to-content, [class*="skip"]');
      issues.noSkipLink = !skipLink;

      // --- Heading hierarchy ---
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let prevLevel = 0;
      let h1Count = 0;

      for (const h of headings) {
        const level = parseInt(h.tagName[1]);
        if (level === 1) h1Count++;
        if (prevLevel > 0 && level > prevLevel + 1) {
          issues.headingIssues.push(`Skipped heading level: H${prevLevel} -> H${level}`);
        }
        prevLevel = level;
      }

      if (h1Count === 0) issues.headingIssues.push('No H1 element found');
      if (h1Count > 1) issues.headingIssues.push(`Multiple H1 elements found (${h1Count})`);

      // --- ARIA validation ---
      const validRoles = ['alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell', 'checkbox', 'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition', 'dialog', 'directory', 'document', 'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading', 'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'navigation', 'none', 'note', 'option', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider', 'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem'];

      const roleElements = document.querySelectorAll('[role]');
      for (const el of roleElements) {
        const role = el.getAttribute('role');
        if (!validRoles.includes(role)) {
          issues.ariaIssues.push(`Invalid ARIA role: "${role}" on <${el.tagName.toLowerCase()}>`);
        }
      }

      // Check for required ARIA attributes
      const ariaRequired = {
        'checkbox': ['aria-checked'],
        'combobox': ['aria-expanded'],
        'slider': ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
        'progressbar': ['aria-valuenow'],
        'scrollbar': ['aria-controls', 'aria-valuenow'],
        'tab': ['aria-selected'],
      };

      for (const el of roleElements) {
        const role = el.getAttribute('role');
        if (ariaRequired[role]) {
          for (const attr of ariaRequired[role]) {
            if (!el.hasAttribute(attr)) {
              issues.ariaIssues.push(`Missing ${attr} on [role="${role}"]`);
            }
          }
        }
      }

      // --- ARIA landmarks ---
      const hasMain = !!document.querySelector('main, [role="main"]');
      const hasNav = !!document.querySelector('nav, [role="navigation"]');
      const hasBanner = !!document.querySelector('header, [role="banner"]');
      const hasContentinfo = !!document.querySelector('footer, [role="contentinfo"]');

      if (!hasMain) issues.landmarkIssues.push('Missing main landmark');
      if (!hasNav) issues.landmarkIssues.push('Missing navigation landmark');
      if (!hasBanner) issues.landmarkIssues.push('Missing banner/header landmark');
      if (!hasContentinfo) issues.landmarkIssues.push('Missing contentinfo/footer landmark');

      // --- Semantic HTML ---
      const hasSemanticMain = !!document.querySelector('main');
      const hasSemanticNav = !!document.querySelector('nav');
      const hasSemanticHeader = !!document.querySelector('header');
      const hasSemanticFooter = !!document.querySelector('footer');

      if (!hasSemanticMain) issues.semanticIssues.push('No <main> element');
      if (!hasSemanticNav && document.querySelectorAll('a').length > 5) issues.semanticIssues.push('No <nav> element despite having many links');
      if (!hasSemanticHeader) issues.semanticIssues.push('No <header> element');
      if (!hasSemanticFooter) issues.semanticIssues.push('No <footer> element');

      // --- Tables ---
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const hasHeaders = table.querySelectorAll('th').length > 0;
        const hasCaption = !!table.querySelector('caption');
        if (!hasHeaders) issues.tableIssues++;
        if (!hasCaption && table.querySelectorAll('tr').length > 3) issues.tableIssues++;
      }

      // --- iframes ---
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        if (!iframe.getAttribute('title')) issues.iframeIssues++;
      }

      // --- Media ---
      const videos = document.querySelectorAll('video');
      const audios = document.querySelectorAll('audio');
      for (const media of [...videos, ...audios]) {
        const hasTrack = media.querySelector('track');
        if (!hasTrack) issues.mediaIssues++;
        if (media.hasAttribute('autoplay') && !media.hasAttribute('muted')) {
          issues.autoPlayContent = true;
        }
      }

      // --- Auto-advancing content (carousels) ---
      const carousels = document.querySelectorAll('[class*="carousel"], [class*="slider"], [class*="slideshow"], [class*="swiper"]');
      if (carousels.length > 0) {
        const hasPauseControl = !!document.querySelector('[aria-label*="pause" i], button:has-text("Pause"), [class*="pause"]');
        if (!hasPauseControl) issues.autoPlayContent = true;
      }

      return issues;
    });

    // Report core issues
    if (coreIssues.missingAlt > 0) {
      const severity = coreIssues.missingAlt > 5 ? 'medium' : 'low';
      bugs.push({
        id: uuidv4(), severity,
        title: `${coreIssues.missingAlt} images missing alt text`,
        category: CATEGORY, testId: 'exp_a11y',
        description: 'Images without alt text are inaccessible to screen reader users (WCAG 1.1.1)',
        stepsToReproduce: ['Navigate to ' + url, 'Inspect images for alt attributes'],
        expected: 'All images should have descriptive alt text or role="presentation"',
        actual: `${coreIssues.missingAlt} images missing alt`,
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= coreIssues.missingAlt * 2;
    }

    if (coreIssues.missingLabels > 0) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: `${coreIssues.missingLabels} form inputs missing labels`,
        category: CATEGORY, testId: 'exp_a11y',
        description: 'Form inputs without labels are inaccessible (WCAG 1.3.1, 3.3.2)',
        stepsToReproduce: ['Navigate to ' + url, 'Check form inputs for associated labels'],
        expected: 'All form inputs should have visible labels', actual: `${coreIssues.missingLabels} inputs missing labels`,
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= coreIssues.missingLabels * 3;
    }

    if (coreIssues.emptyButtons > 0) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: `${coreIssues.emptyButtons} buttons without accessible names`,
        category: CATEGORY, testId: 'exp_a11y',
        description: 'Buttons without text or aria-label are unusable for screen reader users (WCAG 4.1.2)',
        stepsToReproduce: ['Navigate to ' + url, 'Check buttons for text content or aria-label'],
        expected: 'All buttons should have accessible names', actual: `${coreIssues.emptyButtons} buttons have no accessible name`,
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= coreIssues.emptyButtons * 3;
    }

    if (coreIssues.emptyLinks > 0) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: `${coreIssues.emptyLinks} links without accessible names`,
        category: CATEGORY, testId: 'exp_a11y',
        description: 'Links without text or aria-label are unusable for screen readers (WCAG 2.4.4)',
        stepsToReproduce: ['Navigate to ' + url, 'Check links for text content'],
        expected: 'All links should have accessible names', actual: `${coreIssues.emptyLinks} links have no accessible name`,
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= coreIssues.emptyLinks * 2;
    }

    if (coreIssues.missingLang) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: 'Missing lang attribute on html element',
        category: CATEGORY, testId: 'exp_a11y',
        description: 'The html element must have a lang attribute for screen readers (WCAG 3.1.1)',
        stepsToReproduce: ['View page source', 'Check <html> for lang attribute'],
        expected: '<html lang="en"> or appropriate language', actual: 'No lang attribute',
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= 5;
    }

    if (coreIssues.noSkipLink) {
      bugs.push({
        id: uuidv4(), severity: 'low',
        title: 'No skip navigation link found',
        category: CATEGORY, testId: 'exp_a11y',
        description: 'A skip-to-content link should be provided for keyboard users (WCAG 2.4.1)',
        stepsToReproduce: ['Navigate to ' + url, 'Press Tab as the first action', 'Look for a "Skip to content" link'],
        expected: 'Skip navigation link as first focusable element', actual: 'No skip link found',
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= 3;
    }

    if (coreIssues.genericLinks > 3) {
      bugs.push({
        id: uuidv4(), severity: 'low',
        title: `${coreIssues.genericLinks} links with generic text ("click here", "read more")`,
        category: CATEGORY, testId: 'exp_a11y',
        description: 'Links with generic text like "click here" or "read more" lack context for screen readers (WCAG 2.4.4)',
        stepsToReproduce: ['Navigate to ' + url, 'Search for links with generic text'],
        expected: 'Link text should describe the destination', actual: `${coreIssues.genericLinks} links with generic text`,
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= 2;
    }

    if (coreIssues.headingIssues.length > 0) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: `Heading hierarchy issues: ${coreIssues.headingIssues.length} problems`,
        category: CATEGORY, testId: 'exp_a11y',
        description: `Heading structure is not sequential (WCAG 1.3.1): ${coreIssues.headingIssues.join('; ')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Inspect heading elements (H1-H6)'],
        expected: 'Sequential heading hierarchy (H1 > H2 > H3, no skipping)', actual: coreIssues.headingIssues.join('; '),
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= coreIssues.headingIssues.length * 2;
    }

    if (coreIssues.ariaIssues.length > 0) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: `${coreIssues.ariaIssues.length} ARIA issues found`,
        category: CATEGORY, testId: 'exp_a11y',
        description: `ARIA role/attribute issues (WCAG 4.1.2): ${coreIssues.ariaIssues.slice(0, 5).join('; ')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Inspect elements with ARIA roles'],
        expected: 'Valid ARIA roles with required attributes', actual: `${coreIssues.ariaIssues.length} issues found`,
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= coreIssues.ariaIssues.length * 2;
    }

    if (coreIssues.landmarkIssues.length > 0) {
      bugs.push({
        id: uuidv4(), severity: 'low',
        title: `Missing ARIA landmarks: ${coreIssues.landmarkIssues.join(', ')}`,
        category: CATEGORY, testId: 'exp_a11y',
        description: `Page is missing important ARIA landmarks (WCAG 1.3.1): ${coreIssues.landmarkIssues.join(', ')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Check for main, nav, banner, contentinfo landmarks'],
        expected: 'All primary landmarks present', actual: coreIssues.landmarkIssues.join(', '),
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= coreIssues.landmarkIssues.length * 2;
    }

    if (coreIssues.semanticIssues.length > 0) {
      bugs.push({
        id: uuidv4(), severity: 'low',
        title: `Semantic HTML issues: ${coreIssues.semanticIssues.length} problems`,
        category: CATEGORY, testId: 'exp_a11y',
        description: `Missing semantic HTML elements: ${coreIssues.semanticIssues.join('; ')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Check for semantic HTML (main, nav, header, footer, article, section)'],
        expected: 'Proper use of semantic HTML5 elements', actual: coreIssues.semanticIssues.join('; '),
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= 2;
    }

    if (coreIssues.tableIssues > 0) {
      bugs.push({
        id: uuidv4(), severity: 'low',
        title: `${coreIssues.tableIssues} table accessibility issues`,
        category: CATEGORY, testId: 'exp_a11y',
        description: 'Tables missing proper headers (th), caption, or scope attributes (WCAG 1.3.1)',
        stepsToReproduce: ['Navigate to ' + url, 'Inspect tables for th, caption, scope'],
        expected: 'Tables with proper headers and captions', actual: `${coreIssues.tableIssues} issues found`,
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= 2;
    }

    if (coreIssues.iframeIssues > 0) {
      bugs.push({
        id: uuidv4(), severity: 'low',
        title: `${coreIssues.iframeIssues} iframes missing title attribute`,
        category: CATEGORY, testId: 'exp_a11y',
        description: 'iframes should have a title attribute for screen readers (WCAG 4.1.2)',
        stepsToReproduce: ['Navigate to ' + url, 'Check iframes for title attributes'],
        expected: 'All iframes should have descriptive titles', actual: `${coreIssues.iframeIssues} iframes without title`,
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= 2;
    }

    if (coreIssues.mediaIssues > 0) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: `${coreIssues.mediaIssues} media elements without captions/tracks`,
        category: CATEGORY, testId: 'exp_a11y',
        description: 'Video/audio elements should have captions or transcripts (WCAG 1.2.2)',
        stepsToReproduce: ['Navigate to ' + url, 'Check video/audio for track elements'],
        expected: 'Media with captions or transcripts', actual: `${coreIssues.mediaIssues} media without tracks`,
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= coreIssues.mediaIssues * 5;
    }

    if (coreIssues.autoPlayContent) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: 'Auto-playing or auto-advancing content without pause control',
        category: CATEGORY, testId: 'exp_a11y',
        description: 'Carousels, videos, or animations auto-play without a pause button (WCAG 2.2.2)',
        stepsToReproduce: ['Navigate to ' + url, 'Observe auto-advancing content', 'Look for pause controls'],
        expected: 'Auto-playing content should have pause/stop controls', actual: 'No pause control found',
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= 5;
    }

    /* --- Color contrast check --- */
    broadcast({ type: 'log', text: 'Checking color contrast ratios...', color: '#4ECDC4' });

    const contrastIssues = await page.evaluate(() => {
      function getLuminance(r, g, b) {
        const [rs, gs, bs] = [r, g, b].map(c => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }

      function getContrastRatio(l1, l2) {
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      }

      function parseColor(colorStr) {
        if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return null;
        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
        return null;
      }

      function getEffectiveBg(el) {
        let current = el;
        while (current && current !== document.documentElement) {
          const bg = window.getComputedStyle(current).backgroundColor;
          const parsed = parseColor(bg);
          if (parsed && (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent')) {
            return parsed;
          }
          current = current.parentElement;
        }
        return { r: 255, g: 255, b: 255 }; // default white
      }

      const textElements = document.querySelectorAll('p, span, a, li, h1, h2, h3, h4, h5, h6, td, th, label, button');
      let failNormal = 0;
      let failLarge = 0;
      let totalChecked = 0;
      const examples = [];

      for (const el of textElements) {
        if (el.offsetParent === null) continue;
        const text = (el.textContent || '').trim();
        if (!text || text.length < 2) continue;
        if (el.children.length > 3) continue; // skip containers

        totalChecked++;
        if (totalChecked > 100) break; // sample limit

        const style = window.getComputedStyle(el);
        const fg = parseColor(style.color);
        const bg = getEffectiveBg(el);

        if (!fg || !bg) continue;

        const fgLum = getLuminance(fg.r, fg.g, fg.b);
        const bgLum = getLuminance(bg.r, bg.g, bg.b);
        const ratio = getContrastRatio(fgLum, bgLum);

        const fontSize = parseFloat(style.fontSize);
        const fontWeight = parseInt(style.fontWeight) || 400;
        const isLargeText = fontSize >= 18.66 || (fontSize >= 14 && fontWeight >= 700);

        if (isLargeText && ratio < 3) {
          failLarge++;
          if (examples.length < 3) examples.push({ text: text.slice(0, 30), ratio: ratio.toFixed(2), type: 'large' });
        } else if (!isLargeText && ratio < 4.5) {
          failNormal++;
          if (examples.length < 3) examples.push({ text: text.slice(0, 30), ratio: ratio.toFixed(2), type: 'normal' });
        }
      }

      return { failNormal, failLarge, totalChecked, examples };
    });

    if (contrastIssues.failNormal > 0 || contrastIssues.failLarge > 0) {
      const total = contrastIssues.failNormal + contrastIssues.failLarge;
      bugs.push({
        id: uuidv4(), severity: total > 5 ? 'medium' : 'low',
        title: `${total} color contrast failures (WCAG AA)`,
        category: CATEGORY, testId: 'exp_a11y',
        description: `${contrastIssues.failNormal} normal text elements below 4.5:1, ${contrastIssues.failLarge} large text below 3:1 (WCAG 1.4.3). Examples: ${contrastIssues.examples.map(e => `"${e.text}" ratio ${e.ratio}:1`).join('; ')}`,
        stepsToReproduce: ['Navigate to ' + url, 'Check text color contrast against background'],
        expected: 'Normal text >= 4.5:1, large text >= 3:1 contrast ratio',
        actual: `${total} failures out of ${contrastIssues.totalChecked} checked`,
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= total * 2;
    }

    /* --- Focus visibility check --- */
    broadcast({ type: 'log', text: 'Testing focus visibility and keyboard traps...', color: '#4ECDC4' });

    const focusCheck = await page.evaluate(() => {
      const focusable = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      return { count: focusable.length };
    });

    let tabCount = 0;
    let visibleFocusCount = 0;
    let focusTrapDetected = false;
    const focusSeen = new Set();

    for (let i = 0; i < Math.min(focusCheck.count, 25); i++) {
      try {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        const focusInfo = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;

          const styles = window.getComputedStyle(el);
          const outlineVisible = styles.outlineStyle !== 'none' && styles.outlineWidth !== '0px';
          const boxShadow = styles.boxShadow !== 'none';

          return {
            tag: el.tagName,
            id: el.id || '',
            hasFocusIndicator: outlineVisible || boxShadow,
          };
        });

        if (focusInfo) {
          tabCount++;
          if (focusInfo.hasFocusIndicator) visibleFocusCount++;

          const key = `${focusInfo.tag}-${focusInfo.id}`;
          if (focusSeen.has(key) && focusSeen.size < 3) {
            focusTrapDetected = true;
            break;
          }
          focusSeen.add(key);
        }
      } catch {}
    }

    if (tabCount > 5 && visibleFocusCount < tabCount * 0.5) {
      bugs.push({
        id: uuidv4(), severity: 'medium',
        title: `${tabCount - visibleFocusCount}/${tabCount} elements lack visible focus indicator`,
        category: CATEGORY, testId: 'exp_a11y',
        description: 'Focusable elements must have a visible focus indicator (WCAG 2.4.7)',
        stepsToReproduce: ['Navigate to ' + url, 'Tab through interactive elements'],
        expected: 'Visible focus indicator on every focusable element',
        actual: `Only ${visibleFocusCount} of ${tabCount} elements show focus`,
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= 10;
    }

    if (focusTrapDetected) {
      bugs.push({
        id: uuidv4(), severity: 'critical',
        title: 'Keyboard trap detected',
        category: CATEGORY, testId: 'exp_a11y',
        description: 'Focus is trapped in a small group of elements, preventing keyboard navigation (WCAG 2.1.2)',
        stepsToReproduce: ['Navigate to ' + url, 'Tab through the page'],
        expected: 'Focus moves through all interactive elements', actual: 'Focus is trapped in a loop of fewer than 3 elements',
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= 15;
    }

    /* --- prefers-reduced-motion check --- */
    const motionCheck = await page.evaluate(() => {
      const animated = document.querySelectorAll('[class*="animate"], [class*="transition"], [class*="motion"], [class*="slide"], [class*="fade"]');
      const stylesheets = Array.from(document.styleSheets);
      let hasReducedMotionQuery = false;

      try {
        for (const sheet of stylesheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.media && rule.media.mediaText && rule.media.mediaText.includes('prefers-reduced-motion')) {
                hasReducedMotionQuery = true;
                break;
              }
            }
          } catch {}
          if (hasReducedMotionQuery) break;
        }
      } catch {}

      return { animatedElements: animated.length, hasReducedMotionQuery };
    });

    if (motionCheck.animatedElements > 0 && !motionCheck.hasReducedMotionQuery) {
      bugs.push({
        id: uuidv4(), severity: 'low',
        title: 'Animations present without prefers-reduced-motion support',
        category: CATEGORY, testId: 'exp_a11y',
        description: `${motionCheck.animatedElements} animated elements found but no @media (prefers-reduced-motion) query detected (WCAG 2.3.3)`,
        stepsToReproduce: ['Navigate to ' + url, 'Observe animations', 'Enable "Reduce motion" in OS settings'],
        expected: 'Animations respect prefers-reduced-motion preference',
        actual: 'No prefers-reduced-motion media query found',
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= 3;
    }

    /* --- Zoom test (200%) --- */
    broadcast({ type: 'log', text: 'Testing 200% zoom accessibility...', color: '#4ECDC4' });

    try {
      await page.evaluate(() => {
        document.body.style.zoom = '2';
      });
      await page.waitForTimeout(1000);

      const zoomIssues = await page.evaluate(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let overflowCount = 0;
        let overlappingCount = 0;

        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          if (el.offsetParent === null) continue;
          const rect = el.getBoundingClientRect();
          if (rect.right > vw * 2 + 20) overflowCount++; // doubled because of zoom
        }

        return { overflowCount };
      });

      if (zoomIssues.overflowCount > 10) {
        bugs.push({
          id: uuidv4(), severity: 'medium',
          title: 'Content overflows or is lost at 200% zoom',
          category: CATEGORY, testId: 'exp_a11y',
          description: `${zoomIssues.overflowCount} elements overflow the viewport at 200% zoom (WCAG 1.4.4)`,
          stepsToReproduce: ['Navigate to ' + url, 'Zoom to 200%', 'Check for lost or overlapping content'],
          expected: 'All content accessible at 200% zoom', actual: `${zoomIssues.overflowCount} elements overflow`,
          url, timestamp: new Date().toISOString()
        });
        a11yScore -= 5;
      }

      // Reset zoom
      await page.evaluate(() => {
        document.body.style.zoom = '1';
      });
    } catch {}

    /* --- Error identification: form errors --- */
    const formErrorCheck = await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      let errorsNotAssociated = 0;

      for (const form of forms) {
        const errorMsgs = form.querySelectorAll('[class*="error"], [class*="invalid"], [aria-invalid="true"]');
        for (const err of errorMsgs) {
          // Check if error is programmatically associated
          const hasAriaDescribedby = err.getAttribute('aria-describedby');
          const hasAriaErrormessage = err.getAttribute('aria-errormessage');
          const isNearInput = err.previousElementSibling?.tagName === 'INPUT' || err.nextElementSibling?.tagName === 'INPUT';

          if (!hasAriaDescribedby && !hasAriaErrormessage && !isNearInput) {
            errorsNotAssociated++;
          }
        }
      }

      return { errorsNotAssociated, formCount: forms.length };
    });

    if (formErrorCheck.errorsNotAssociated > 0) {
      bugs.push({
        id: uuidv4(), severity: 'low',
        title: `${formErrorCheck.errorsNotAssociated} form errors not programmatically associated`,
        category: CATEGORY, testId: 'exp_a11y',
        description: 'Form error messages are not linked to inputs via aria-describedby or aria-errormessage (WCAG 3.3.1)',
        stepsToReproduce: ['Navigate to ' + url, 'Submit forms with errors', 'Check error association'],
        expected: 'Error messages linked to inputs via ARIA', actual: `${formErrorCheck.errorsNotAssociated} errors not associated`,
        url, timestamp: new Date().toISOString()
      });
      a11yScore -= 3;
    }

    // Clamp score
    a11yScore = Math.max(0, Math.min(100, a11yScore));

    const totalIssues = bugs.length;
    broadcast({
      type: 'log',
      text: `Accessibility scan complete. Score: ${a11yScore}/100. ${totalIssues} issues found.`,
      color: a11yScore > 70 ? '#4ECDC4' : (a11yScore > 40 ? '#F5A623' : '#FF6B35'),
    });
  } catch (error) {
    broadcast({ type: 'log', text: `A11y scan error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runExpRandom, runExpResponsive, runExpA11y };
