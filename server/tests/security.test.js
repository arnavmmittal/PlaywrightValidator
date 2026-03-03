const { v4: uuidv4 } = require('uuid');

/**
 * Security Tests (Defensive - for finding vulnerabilities)
 * - XSS injection detection
 * - SQL injection probes
 * - Input overflow & fuzzing
 */

const XSS_PAYLOADS = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  '<svg onload=alert("XSS")>',
  '" onfocus="alert(\'XSS\')" autofocus="',
  '<body onload=alert("XSS")>',
  'javascript:alert("XSS")',
];

const SQLI_PAYLOADS = [
  "' OR '1'='1",
  "1; DROP TABLE users;--",
  "' UNION SELECT null--",
  "admin'--",
  "1' AND '1'='1",
  "'; EXEC xp_cmdshell('dir');--",
];

const SQL_ERROR_PATTERNS = [
  /sql syntax/i,
  /mysql/i,
  /sqlite/i,
  /postgresql/i,
  /ora-\d+/i,
  /syntax error.*sql/i,
  /unclosed quotation/i,
  /quoted string not properly terminated/i,
  /sql server/i,
  /odbc driver/i,
];

async function runSecXss(page, url, options, broadcast) {
  const bugs = [];
  let dialogDetected = false;
  let dialogMessage = '';

  broadcast({ type: 'log', text: 'Testing for XSS vulnerabilities...', color: '#4ECDC4' });

  const dialogHandler = async dialog => {
    dialogDetected = true;
    dialogMessage = dialog.message();
    await dialog.dismiss();
  };

  page.on('dialog', dialogHandler);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    // Find all text inputs
    const inputs = await page.$$('input[type="text"], input[type="search"], input:not([type]), textarea, [contenteditable="true"]');
    broadcast({ type: 'log', text: `Found ${inputs.length} text inputs to test`, color: '#4ECDC4' });

    let xssFound = false;

    for (const input of inputs.slice(0, 5)) {
      if (xssFound) break;

      for (const payload of XSS_PAYLOADS) {
        dialogDetected = false;

        try {
          // Clear and fill the input
          await input.click({ timeout: 2000 }).catch(() => {});
          await page.keyboard.selectAll();
          await page.keyboard.type(payload, { delay: 10 });
          await page.waitForTimeout(300);

          // Try to submit if there's a form
          await page.keyboard.press('Enter').catch(() => {});
          await page.waitForTimeout(500);

          // Check for XSS execution
          if (dialogDetected) {
            xssFound = true;
            bugs.push({
              id: uuidv4(),
              severity: 'critical',
              title: 'XSS vulnerability: Script execution detected',
              category: 'Security & Malicious Input',
              testId: 'sec_xss',
              description: `XSS payload triggered script execution. A dialog appeared with message: "${dialogMessage}"`,
              stepsToReproduce: ['Navigate to ' + url, 'Find text input field', 'Enter payload: ' + payload, 'Submit or blur the field'],
              expected: 'Input should be sanitized, no script execution',
              actual: 'Script executed and dialog appeared',
              url,
              timestamp: new Date().toISOString()
            });
            broadcast({ type: 'log', text: '⚠ CRITICAL: XSS vulnerability found!', color: '#FF2D2D' });
            break;
          }

          // Check for unescaped reflection in DOM
          const content = await page.content();
          if (content.includes(payload) && !content.includes(encodeURIComponent(payload).replace(/%20/g, '+'))) {
            // Payload appears unencoded
            bugs.push({
              id: uuidv4(),
              severity: 'high',
              title: 'Potential XSS: Unescaped input reflection',
              category: 'Security & Malicious Input',
              testId: 'sec_xss',
              description: `XSS payload is reflected in the page without proper encoding`,
              stepsToReproduce: ['Navigate to ' + url, 'Enter payload in input', 'View page source'],
              expected: 'Input should be HTML-encoded when reflected',
              actual: 'Payload appears unencoded in DOM',
              url,
              timestamp: new Date().toISOString()
            });
            broadcast({ type: 'log', text: '⚠ Potential XSS: unescaped reflection', color: '#FF6B35' });
            xssFound = true;
            break;
          }
        } catch (e) {
          // Input might not be interactive, continue
        }
      }
    }

    if (!xssFound) {
      broadcast({ type: 'log', text: 'No XSS vulnerabilities detected', color: '#4ECDC4' });
    }
  } catch (error) {
    broadcast({ type: 'log', text: `XSS test error: ${error.message}`, color: '#FF6B35' });
  } finally {
    page.off('dialog', dialogHandler);
  }

  return bugs;
}

async function runSecSqli(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing for SQL injection vulnerabilities...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const inputs = await page.$$('input[type="text"], input[type="search"], input[type="email"], input:not([type])');
    broadcast({ type: 'log', text: `Testing ${Math.min(inputs.length, 3)} inputs for SQLi`, color: '#4ECDC4' });

    let sqliFound = false;

    for (const input of inputs.slice(0, 3)) {
      if (sqliFound) break;

      for (const payload of SQLI_PAYLOADS) {
        try {
          // Get baseline content
          const baselineContent = await page.content();

          // Enter payload
          await input.click({ timeout: 2000 }).catch(() => {});
          await page.keyboard.selectAll();
          await page.keyboard.type(payload, { delay: 10 });

          // Try to submit
          await page.keyboard.press('Enter').catch(() => {});
          await page.waitForTimeout(1000);

          const responseContent = await page.content();

          // Check for SQL error messages
          for (const pattern of SQL_ERROR_PATTERNS) {
            if (pattern.test(responseContent) && !pattern.test(baselineContent)) {
              sqliFound = true;
              bugs.push({
                id: uuidv4(),
                severity: 'critical',
                title: 'SQL error message exposed',
                category: 'Security & Malicious Input',
                testId: 'sec_sqli',
                description: 'SQL-related error message visible in response. This indicates potential SQL injection vulnerability and information disclosure.',
                stepsToReproduce: ['Navigate to ' + url, 'Enter SQL payload in input: ' + payload, 'Submit the form'],
                expected: 'No database errors should be exposed to users',
                actual: 'SQL error message visible in response',
                url,
                timestamp: new Date().toISOString()
              });
              broadcast({ type: 'log', text: '⚠ CRITICAL: SQL error exposed!', color: '#FF2D2D' });
              break;
            }
          }

          if (sqliFound) break;

          // Go back to original page for next test
          await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
        } catch (e) {
          // Continue testing
        }
      }
    }

    if (!sqliFound) {
      broadcast({ type: 'log', text: 'No SQL injection vulnerabilities detected', color: '#4ECDC4' });
    }
  } catch (error) {
    broadcast({ type: 'log', text: `SQLi test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runSecOverflow(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing input overflow handling...', color: '#4ECDC4' });

  const overflowPayloads = [
    { name: 'Long string (10K chars)', value: 'A'.repeat(10000) },
    { name: 'Null bytes', value: 'test\x00\x00\x00test' },
    { name: 'Format strings', value: '%s%s%s%s%s%n%n%n%n' },
    { name: 'Negative number', value: '-999999999999' },
    { name: 'Unicode overflow', value: '𝕋𝕖𝕤𝕥'.repeat(1000) },
  ];

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const inputs = await page.$$('input, textarea');
    broadcast({ type: 'log', text: `Testing ${Math.min(inputs.length, 3)} inputs for overflow`, color: '#4ECDC4' });

    for (const input of inputs.slice(0, 3)) {
      for (const { name, value } of overflowPayloads) {
        try {
          const beforeUrl = page.url();

          await input.click({ timeout: 2000 }).catch(() => {});
          await page.keyboard.selectAll();

          // Type in chunks for very long strings
          if (value.length > 1000) {
            await input.fill(value.slice(0, 1000));
          } else {
            await page.keyboard.type(value, { delay: 5 });
          }

          await page.waitForTimeout(300);

          // Check for page crash or error
          const currentUrl = page.url();
          const content = await page.content();

          // Check for error indicators
          const hasServerError = content.toLowerCase().includes('500') ||
                                 content.toLowerCase().includes('internal server error') ||
                                 content.toLowerCase().includes('exception');

          if (hasServerError) {
            bugs.push({
              id: uuidv4(),
              severity: 'medium',
              title: `Server error with ${name}`,
              category: 'Security & Malicious Input',
              testId: 'sec_overflow',
              description: `Application showed server error when handling ${name} input`,
              stepsToReproduce: ['Navigate to ' + url, `Enter ${name} payload in input`],
              expected: 'Graceful handling of malformed input',
              actual: 'Server error occurred',
              url,
              timestamp: new Date().toISOString()
            });
            broadcast({ type: 'log', text: `⚠ Server error with ${name}`, color: '#FF6B35' });
          }

          // Reset page
          await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
        } catch (e) {
          if (e.message.includes('crash') || e.message.includes('Target closed')) {
            bugs.push({
              id: uuidv4(),
              severity: 'high',
              title: `Page crash with ${name}`,
              category: 'Security & Malicious Input',
              testId: 'sec_overflow',
              description: `Page crashed when handling ${name} input`,
              stepsToReproduce: ['Navigate to ' + url, `Enter ${name} payload`],
              expected: 'Page should handle input gracefully',
              actual: 'Page crashed',
              url,
              timestamp: new Date().toISOString()
            });
            broadcast({ type: 'log', text: `⚠ Page crash with ${name}`, color: '#FF2D2D' });
          }
        }
      }
    }

    broadcast({ type: 'log', text: 'Overflow testing complete', color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Overflow test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runSecXss, runSecSqli, runSecOverflow };
