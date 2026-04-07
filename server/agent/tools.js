/**
 * Playwright Tool Definitions for Claude AI Agent
 *
 * These tools let Claude autonomously control a browser via Playwright.
 * Each tool maps to a Playwright action with structured input/output.
 */

// Tool JSON schemas for the Claude Messages API
const TOOL_DEFINITIONS = [
  {
    name: 'navigate',
    description: 'Navigate the browser to a URL. Use this to visit pages, follow links, or go to specific routes.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to navigate to' },
        wait_until: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle'],
          description: 'When to consider navigation complete. Default: domcontentloaded'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'click',
    description: 'Click an element on the page. Use CSS selectors or text content to target elements.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or text selector (e.g., "text=Submit") for the element to click' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button. Default: left' },
        double_click: { type: 'boolean', description: 'Whether to double-click. Default: false' }
      },
      required: ['selector']
    }
  },
  {
    name: 'type_text',
    description: 'Type text into an input field. Clears existing content first.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the input field' },
        text: { type: 'string', description: 'Text to type into the field' },
        press_enter: { type: 'boolean', description: 'Whether to press Enter after typing. Default: false' }
      },
      required: ['selector', 'text']
    }
  },
  {
    name: 'screenshot',
    description: 'Take a screenshot of the current page or a specific element. Returns a base64-encoded image. Use this to visually inspect the page state.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Optional CSS selector to screenshot a specific element instead of the full page' },
        full_page: { type: 'boolean', description: 'Whether to capture the full scrollable page. Default: false' }
      }
    }
  },
  {
    name: 'extract_page_info',
    description: 'Extract structured information from the current page: URL, title, meta tags, headings, links, forms, and interactive elements. Use this as your first action on any new page to understand its structure.',
    input_schema: {
      type: 'object',
      properties: {
        include_links: { type: 'boolean', description: 'Include all links on the page. Default: true' },
        include_forms: { type: 'boolean', description: 'Include form details. Default: true' },
        include_buttons: { type: 'boolean', description: 'Include buttons and interactive elements. Default: true' }
      }
    }
  },
  {
    name: 'evaluate_js',
    description: 'Execute JavaScript code in the browser page context and return the result. Use for reading DOM state, checking cookies, localStorage, network info, or computing values.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code to execute in the page context. Must return a serializable value.' }
      },
      required: ['code']
    }
  },
  {
    name: 'fill_form',
    description: 'Fill multiple form fields at once. More efficient than individual type_text calls.',
    input_schema: {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector for the field' },
              value: { type: 'string', description: 'Value to fill' }
            },
            required: ['selector', 'value']
          },
          description: 'Array of {selector, value} pairs to fill'
        },
        submit_selector: { type: 'string', description: 'Optional CSS selector for submit button to click after filling' }
      },
      required: ['fields']
    }
  },
  {
    name: 'wait_for',
    description: 'Wait for an element to appear, disappear, or for a specific condition.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to wait for' },
        state: {
          type: 'string',
          enum: ['visible', 'hidden', 'attached', 'detached'],
          description: 'Desired state. Default: visible'
        },
        timeout: { type: 'number', description: 'Max wait time in ms. Default: 5000' }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_console_logs',
    description: 'Retrieve all console messages (logs, warnings, errors) captured since the page loaded or since the last call.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_network_requests',
    description: 'Retrieve captured network requests and responses, including status codes, headers, and timing. Useful for finding API endpoints, checking for errors, and performance analysis.',
    input_schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Optional URL substring to filter requests (e.g., "/api/")' },
        include_headers: { type: 'boolean', description: 'Include response headers. Default: false' }
      }
    }
  },
  {
    name: 'check_accessibility',
    description: 'Run an accessibility audit on the current page. Checks ARIA attributes, color contrast hints, heading hierarchy, alt text, form labels, and focus management.',
    input_schema: {
      type: 'object',
      properties: {
        scope_selector: { type: 'string', description: 'Optional CSS selector to limit the audit scope' }
      }
    }
  },
  {
    name: 'check_security_headers',
    description: 'Analyze HTTP security headers from the most recent page navigation. Checks CSP, HSTS, X-Frame-Options, and more.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'measure_performance',
    description: 'Measure Core Web Vitals and performance metrics for the current page using the Performance API.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'inject_payload',
    description: 'Inject a test payload into an input field and observe the result. Used for security testing (XSS, SQLi). Reports whether the payload was reflected, executed, or sanitized.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the input field to inject into' },
        payload: { type: 'string', description: 'The test payload string to inject' },
        submit_selector: { type: 'string', description: 'Optional selector for a submit button to click after injection' },
        check_type: {
          type: 'string',
          enum: ['xss', 'sqli', 'general'],
          description: 'Type of injection to check for in the response. Default: general'
        }
      },
      required: ['selector', 'payload']
    }
  },
  {
    name: 'report_bug',
    description: 'Report a bug or finding. Use this whenever you discover an issue during testing. Be specific about what you found, where, and its impact.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short descriptive title of the bug' },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'info'],
          description: 'Bug severity level'
        },
        category: { type: 'string', description: 'Category (e.g., Security, Performance, Accessibility, UX, Functionality)' },
        description: { type: 'string', description: 'Detailed description of the issue, including steps to reproduce' },
        evidence: { type: 'string', description: 'Technical evidence (e.g., the XSS payload that executed, the missing header, the error message)' },
        recommendation: { type: 'string', description: 'Suggested fix or mitigation' }
      },
      required: ['title', 'severity', 'category', 'description']
    }
  },
  {
    name: 'report_findings',
    description: 'Submit your complete performance analysis. You MUST call this exactly once with your full analysis. This is the only way to deliver your findings.',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'One-paragraph performance verdict — is this site fast or slow, and what is the single biggest factor?'
        },
        overallScore: {
          type: 'number',
          description: 'Your subjective overall score 0-100 based on your analysis (shown alongside the deterministic score)'
        },
        grade: {
          type: 'string',
          enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
          description: 'Letter grade for overall performance'
        },
        keyFindings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              area: { type: 'string', description: 'Which metric or area (LCP, FCP, CLS, TTFB, TBT, or a category like "Images", "Third-Party")' },
              verdict: { type: 'string', enum: ['good', 'needs-improvement', 'poor'], description: 'Rating for this area' },
              explanation: { type: 'string', description: 'WHY this metric has the value it does — be specific, reference the data' },
              impact: { type: 'string', enum: ['high', 'medium', 'low'], description: 'How much this finding affects overall performance' }
            },
            required: ['area', 'verdict', 'explanation', 'impact']
          },
          description: 'Key findings for each metric/area — explain WHY, not just WHAT'
        },
        architectureAnalysis: {
          type: 'object',
          properties: {
            renderingStrategy: { type: 'string', description: 'SSR/CSR/SSG/ISR analysis — what strategy is used and how it impacts performance' },
            bundleEfficiency: { type: 'string', description: 'Analysis of JS/CSS bundle sizes and loading strategy' },
            cdnAndCaching: { type: 'string', description: 'CDN usage, cache headers, edge delivery analysis' },
            imageOptimization: { type: 'string', description: 'Image formats, lazy loading, sizing analysis' },
            thirdPartyImpact: { type: 'string', description: 'Third-party scripts and their performance cost' },
            securityPosture: { type: 'string', description: 'Security header analysis — HTTPS enforcement, HSTS, CSP, and other security headers. Note which critical headers are missing.' }
          },
          required: ['renderingStrategy', 'bundleEfficiency', 'cdnAndCaching', 'imageOptimization', 'thirdPartyImpact', 'securityPosture']
        },
        topRecommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'Specific, actionable recommendation' },
              impact: { type: 'string', description: 'Expected performance improvement' },
              effort: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Implementation effort' }
            },
            required: ['action', 'impact', 'effort']
          },
          description: '3-5 specific, actionable recommendations ordered by impact'
        }
      },
      required: ['summary', 'overallScore', 'grade', 'keyFindings', 'architectureAnalysis', 'topRecommendations']
    }
  }
];

/**
 * Execute a tool call against a Playwright page.
 * Returns { result: string } on success or { error: string } on failure.
 */
async function executeTool(toolName, toolInput, pageState) {
  const { page, consoleLogs, networkRequests, navigationHeaders } = pageState;

  try {
    switch (toolName) {
      case 'navigate': {
        const waitUntil = toolInput.wait_until || 'domcontentloaded';
        const response = await page.goto(toolInput.url, { waitUntil, timeout: 15000 });
        if (response) {
          // Capture navigation headers
          const headers = response.headers();
          Object.assign(navigationHeaders, headers);
          pageState.lastStatus = response.status();
        }
        const title = await page.title();
        return { result: `Navigated to ${toolInput.url} — Status: ${pageState.lastStatus || 'unknown'}, Title: "${title}"` };
      }

      case 'click': {
        const opts = {};
        if (toolInput.button) opts.button = toolInput.button;
        if (toolInput.double_click) {
          await page.dblclick(toolInput.selector, opts);
        } else {
          await page.click(toolInput.selector, { ...opts, timeout: 5000 });
        }
        await page.waitForTimeout(500); // Brief settle
        const url = page.url();
        return { result: `Clicked "${toolInput.selector}". Current URL: ${url}` };
      }

      case 'type_text': {
        await page.fill(toolInput.selector, toolInput.text);
        if (toolInput.press_enter) {
          await page.press(toolInput.selector, 'Enter');
          await page.waitForTimeout(500);
        }
        return { result: `Typed "${toolInput.text.substring(0, 50)}${toolInput.text.length > 50 ? '...' : ''}" into ${toolInput.selector}` };
      }

      case 'screenshot': {
        const opts = { type: 'png' };
        let buffer;
        if (toolInput.selector) {
          const el = await page.$(toolInput.selector);
          if (!el) return { error: `Element not found: ${toolInput.selector}` };
          buffer = await el.screenshot(opts);
        } else {
          opts.fullPage = toolInput.full_page || false;
          buffer = await page.screenshot(opts);
        }
        const base64 = buffer.toString('base64');
        return {
          result: 'Screenshot captured.',
          image: { type: 'base64', media_type: 'image/png', data: base64 }
        };
      }

      case 'extract_page_info': {
        const info = await page.evaluate((opts) => {
          const result = {
            url: location.href,
            title: document.title,
            meta: {},
            headings: [],
            interactive: { links: [], forms: [], buttons: [] }
          };

          // Meta tags
          document.querySelectorAll('meta').forEach(m => {
            const name = m.getAttribute('name') || m.getAttribute('property') || m.getAttribute('http-equiv');
            if (name) result.meta[name] = m.getAttribute('content');
          });

          // Headings
          document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
            result.headings.push({ level: h.tagName, text: h.textContent.trim().substring(0, 100) });
          });

          // Links
          if (opts.include_links !== false) {
            document.querySelectorAll('a[href]').forEach(a => {
              result.interactive.links.push({
                text: a.textContent.trim().substring(0, 60),
                href: a.getAttribute('href'),
                external: a.hostname !== location.hostname
              });
            });
            // Cap at 50 links
            if (result.interactive.links.length > 50) {
              result.interactive.links = result.interactive.links.slice(0, 50);
              result.interactive.linksTruncated = true;
            }
          }

          // Forms
          if (opts.include_forms !== false) {
            document.querySelectorAll('form').forEach(f => {
              const fields = [];
              f.querySelectorAll('input, select, textarea').forEach(el => {
                fields.push({
                  tag: el.tagName.toLowerCase(),
                  type: el.getAttribute('type') || 'text',
                  name: el.getAttribute('name'),
                  id: el.getAttribute('id'),
                  placeholder: el.getAttribute('placeholder'),
                  required: el.hasAttribute('required')
                });
              });
              result.interactive.forms.push({
                action: f.getAttribute('action'),
                method: f.getAttribute('method') || 'GET',
                id: f.getAttribute('id'),
                fields
              });
            });
          }

          // Buttons
          if (opts.include_buttons !== false) {
            document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach(b => {
              result.interactive.buttons.push({
                text: b.textContent.trim().substring(0, 60),
                type: b.getAttribute('type'),
                id: b.getAttribute('id'),
                disabled: b.disabled
              });
            });
          }

          return result;
        }, toolInput);

        return { result: JSON.stringify(info, null, 2) };
      }

      case 'evaluate_js': {
        const evalResult = await page.evaluate(toolInput.code);
        const serialized = typeof evalResult === 'object' ? JSON.stringify(evalResult, null, 2) : String(evalResult);
        return { result: serialized.substring(0, 5000) };
      }

      case 'fill_form': {
        const filled = [];
        for (const field of toolInput.fields) {
          await page.fill(field.selector, field.value);
          filled.push(field.selector);
        }
        if (toolInput.submit_selector) {
          await page.click(toolInput.submit_selector, { timeout: 5000 });
          await page.waitForTimeout(500);
        }
        return { result: `Filled ${filled.length} fields: ${filled.join(', ')}${toolInput.submit_selector ? '. Submitted.' : ''}` };
      }

      case 'wait_for': {
        const state = toolInput.state || 'visible';
        const timeout = toolInput.timeout || 5000;
        await page.waitForSelector(toolInput.selector, { state, timeout });
        return { result: `Element "${toolInput.selector}" is now ${state}` };
      }

      case 'get_console_logs': {
        const logs = consoleLogs.splice(0); // drain
        if (logs.length === 0) return { result: 'No console messages captured.' };
        const formatted = logs.map(l => `[${l.type}] ${l.text}`).join('\n');
        return { result: formatted.substring(0, 5000) };
      }

      case 'get_network_requests': {
        let reqs = [...networkRequests];
        if (toolInput.filter) {
          reqs = reqs.filter(r => r.url.includes(toolInput.filter));
        }
        const summary = reqs.slice(-50).map(r => {
          const entry = { method: r.method, url: r.url, status: r.status, type: r.resourceType };
          if (toolInput.include_headers && r.headers) entry.headers = r.headers;
          return entry;
        });
        return { result: JSON.stringify(summary, null, 2) };
      }

      case 'check_accessibility': {
        const a11y = await page.evaluate((scopeSelector) => {
          const scope = scopeSelector ? document.querySelector(scopeSelector) : document.body;
          if (!scope) return { error: 'Scope element not found' };

          const issues = [];

          // Check images without alt
          scope.querySelectorAll('img').forEach(img => {
            if (!img.getAttribute('alt') && img.getAttribute('alt') !== '') {
              issues.push({ type: 'missing-alt', element: img.src?.substring(0, 80) || 'unknown', severity: 'high' });
            }
          });

          // Check form labels
          scope.querySelectorAll('input, select, textarea').forEach(el => {
            if (el.type === 'hidden') return;
            const id = el.getAttribute('id');
            const hasLabel = id && document.querySelector(`label[for="${id}"]`);
            const hasAriaLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
            const wrappedInLabel = el.closest('label');
            if (!hasLabel && !hasAriaLabel && !wrappedInLabel) {
              issues.push({ type: 'missing-label', element: `${el.tagName.toLowerCase()}[name=${el.name || 'unknown'}]`, severity: 'high' });
            }
          });

          // Check heading hierarchy
          const headings = [...scope.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(h => parseInt(h.tagName[1]));
          for (let i = 1; i < headings.length; i++) {
            if (headings[i] - headings[i - 1] > 1) {
              issues.push({ type: 'heading-skip', detail: `h${headings[i - 1]} → h${headings[i]}`, severity: 'medium' });
            }
          }

          // Check buttons/links without accessible text
          scope.querySelectorAll('button, a').forEach(el => {
            const text = el.textContent.trim();
            const ariaLabel = el.getAttribute('aria-label');
            if (!text && !ariaLabel) {
              issues.push({ type: 'empty-interactive', element: el.tagName.toLowerCase(), severity: 'high' });
            }
          });

          // Check ARIA landmarks
          const landmarks = scope.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer');

          // Check tabindex misuse
          scope.querySelectorAll('[tabindex]').forEach(el => {
            const val = parseInt(el.getAttribute('tabindex'));
            if (val > 0) {
              issues.push({ type: 'positive-tabindex', value: val, severity: 'medium' });
            }
          });

          return {
            issues,
            summary: {
              totalIssues: issues.length,
              landmarkCount: landmarks.length,
              imagesChecked: scope.querySelectorAll('img').length,
              formsChecked: scope.querySelectorAll('form').length
            }
          };
        }, toolInput.scope_selector || null);

        return { result: JSON.stringify(a11y, null, 2) };
      }

      case 'check_security_headers': {
        const headerChecks = {
          'content-security-policy': { present: false, value: null, rating: 'missing' },
          'strict-transport-security': { present: false, value: null, rating: 'missing' },
          'x-frame-options': { present: false, value: null, rating: 'missing' },
          'x-content-type-options': { present: false, value: null, rating: 'missing' },
          'referrer-policy': { present: false, value: null, rating: 'missing' },
          'permissions-policy': { present: false, value: null, rating: 'missing' },
          'x-xss-protection': { present: false, value: null, rating: 'missing' }
        };

        for (const [header, check] of Object.entries(headerChecks)) {
          const val = navigationHeaders[header];
          if (val) {
            check.present = true;
            check.value = val.substring(0, 200);
            check.rating = 'present';
          }
        }

        // Check for server info leak
        const serverHeader = navigationHeaders['server'];
        const poweredBy = navigationHeaders['x-powered-by'];

        return {
          result: JSON.stringify({
            headers: headerChecks,
            informationLeakage: {
              server: serverHeader || null,
              xPoweredBy: poweredBy || null
            }
          }, null, 2)
        };
      }

      case 'measure_performance': {
        const metrics = await page.evaluate(() => {
          const perf = performance.getEntriesByType('navigation')[0];
          const paint = performance.getEntriesByType('paint');

          const result = {
            navigation: perf ? {
              domContentLoaded: Math.round(perf.domContentLoadedEventEnd - perf.startTime),
              loadComplete: Math.round(perf.loadEventEnd - perf.startTime),
              ttfb: Math.round(perf.responseStart - perf.startTime),
              domInteractive: Math.round(perf.domInteractive - perf.startTime),
              transferSize: perf.transferSize,
              encodedBodySize: perf.encodedBodySize,
              decodedBodySize: perf.decodedBodySize
            } : null,
            paint: {},
            resources: { totalCount: 0, totalSize: 0, byType: {} }
          };

          paint.forEach(p => { result.paint[p.name] = Math.round(p.startTime); });

          const resources = performance.getEntriesByType('resource');
          result.resources.totalCount = resources.length;
          resources.forEach(r => {
            result.resources.totalSize += r.transferSize || 0;
            const type = r.initiatorType || 'other';
            if (!result.resources.byType[type]) result.resources.byType[type] = { count: 0, size: 0 };
            result.resources.byType[type].count++;
            result.resources.byType[type].size += r.transferSize || 0;
          });

          return result;
        });

        return { result: JSON.stringify(metrics, null, 2) };
      }

      case 'inject_payload': {
        // Clear console logs before injection
        consoleLogs.length = 0;

        await page.fill(toolInput.selector, toolInput.payload);

        if (toolInput.submit_selector) {
          await page.click(toolInput.submit_selector, { timeout: 5000 });
          await page.waitForTimeout(1000);
        } else if (toolInput.payload.length < 200) {
          await page.press(toolInput.selector, 'Enter');
          await page.waitForTimeout(1000);
        }

        // Check for XSS execution
        let xssDetected = false;
        if (toolInput.check_type === 'xss' || toolInput.check_type === 'general') {
          xssDetected = await page.evaluate(() => {
            return !!document.querySelector('img[src="x"]') ||
                   !!document.querySelector('svg[onload]') ||
                   window.__xss_triggered === true;
          }).catch(() => false);
        }

        // Check for SQL error indicators
        let sqlErrorDetected = false;
        if (toolInput.check_type === 'sqli' || toolInput.check_type === 'general') {
          const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
          const sqlPatterns = ['sql syntax', 'mysql', 'postgresql', 'sqlite', 'ora-', 'unclosed quotation', 'syntax error'];
          sqlErrorDetected = sqlPatterns.some(p => bodyText.toLowerCase().includes(p));
        }

        // Check if payload was reflected in page
        const reflected = await page.evaluate((payload) => {
          return document.body?.innerHTML?.includes(payload) || false;
        }, toolInput.payload).catch(() => false);

        const newLogs = consoleLogs.splice(0);
        const errorLogs = newLogs.filter(l => l.type === 'error');

        return {
          result: JSON.stringify({
            payload: toolInput.payload.substring(0, 100),
            reflected,
            xssDetected,
            sqlErrorDetected,
            consoleErrors: errorLogs.map(l => l.text),
            currentUrl: page.url()
          }, null, 2)
        };
      }

      case 'report_bug': {
        // This is handled by the orchestrator, not executed against the page
        return { result: `Bug reported: [${toolInput.severity.toUpperCase()}] ${toolInput.title}` };
      }

      case 'report_findings': {
        // This is handled by the analyzer, not executed against the page
        return { result: `Performance analysis submitted: ${toolInput.grade} (${toolInput.overallScore}/100) — ${toolInput.summary.substring(0, 100)}...` };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    return { error: `Tool "${toolName}" failed: ${err.message}` };
  }
}

module.exports = { TOOL_DEFINITIONS, executeTool };
