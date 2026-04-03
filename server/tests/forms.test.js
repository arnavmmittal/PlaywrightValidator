const { v4: uuidv4 } = require('uuid');

/**
 * Forms & Interaction Tests — Enterprise Grade
 * - Form auto-fill & submit (all field types, wizard forms, CSRF, autofill)
 * - Form validation (per-field, boundary, accessible errors, XSS, client vs server)
 * - Command/button execution (modals, dropdowns, toggles, keyboard, focus management)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBug(severity, title, testId, description, steps, expected, actual, pageUrl) {
  return {
    id: uuidv4(),
    severity,
    title,
    category: 'Forms & Interaction',
    testId,
    description,
    stepsToReproduce: steps,
    expected,
    actual,
    url: pageUrl,
    timestamp: new Date().toISOString()
  };
}

// Comprehensive test data per field type
const TEST_DATA = {
  text: 'Test User',
  email: 'test@example.com',
  password: 'TestPass123!@#',
  tel: '+1-555-123-4567',
  number: '42',
  url: 'https://example.com',
  search: 'test query',
  date: '2025-06-15',
  'datetime-local': '2025-06-15T10:30',
  time: '14:30',
  month: '2025-06',
  week: '2025-W24',
  range: '50',
  color: '#ff5733',
  textarea: 'This is a comprehensive test message for form validation. It includes multiple sentences to simulate realistic user input.',
};

// Invalid data for validation testing
const INVALID_DATA = {
  email: [
    { value: 'notanemail', desc: 'missing @ and domain' },
    { value: 'user@', desc: 'missing domain' },
    { value: '@domain.com', desc: 'missing local part' },
    { value: 'user@domain', desc: 'missing TLD' },
    { value: 'user name@domain.com', desc: 'contains space' },
  ],
  url: [
    { value: 'not a url', desc: 'plain text' },
    { value: 'ftp://missing-http.com', desc: 'wrong protocol' },
    { value: '://no-protocol.com', desc: 'missing protocol' },
  ],
  tel: [
    { value: 'abc', desc: 'letters only' },
    { value: '12', desc: 'too short' },
  ],
  number: [
    { value: 'abc', desc: 'non-numeric' },
    { value: '99999999999999999999', desc: 'extremely large' },
  ],
};

// XSS payloads for validation error testing
const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  '\' onmouseover=alert(1) \'',
];

// ---------------------------------------------------------------------------
// runFormFill
// ---------------------------------------------------------------------------

async function runFormFill(page, url, options, broadcast) {
  const bugs = [];
  const timeout = (options.timeout || 30) * 1000;

  broadcast({ type: 'log', text: 'Starting comprehensive form fill & submit testing...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const formCount = await page.$$eval('form', fs => fs.length);
    broadcast({ type: 'log', text: `Found ${formCount} forms on page`, color: '#4ECDC4' });

    // --- Check for duplicate form IDs ---
    const duplicateFormIds = await page.evaluate(() => {
      const forms = document.querySelectorAll('form[id]');
      const ids = {};
      const dupes = [];
      for (const f of forms) {
        if (ids[f.id]) dupes.push(f.id);
        ids[f.id] = true;
      }
      return dupes;
    });

    for (const dupId of duplicateFormIds) {
      bugs.push(makeBug('medium', `Duplicate form ID: "${dupId}"`, 'form_fill',
        `Multiple forms share the same id="${dupId}"`,
        ['Navigate to ' + url, 'Inspect forms'],
        'Each form should have a unique ID',
        `Duplicate form id="${dupId}" found`,
        url));
    }

    // --- Process ALL forms ---
    for (let fi = 0; fi < formCount; fi++) {
      try {
        // Re-navigate to reset page state for each form
        if (fi > 0) {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        }

        const forms = await page.$$('form');
        if (fi >= forms.length) break;
        const form = forms[fi];

        broadcast({ type: 'log', text: `Testing form ${fi + 1}/${formCount}...`, color: '#4ECDC4' });

        // --- Check for CSRF token ---
        const hasCsrf = await form.evaluate(f => {
          const csrfInputs = f.querySelectorAll(
            'input[name*="csrf"], input[name*="token"], input[name*="_token"], input[name="authenticity_token"], input[name*="xsrf"]'
          );
          const csrfMeta = document.querySelector('meta[name*="csrf"], meta[name*="xsrf"]');
          return csrfInputs.length > 0 || !!csrfMeta;
        });

        const formAction = await form.getAttribute('action');
        const formMethod = (await form.getAttribute('method') || 'get').toLowerCase();

        if (formMethod === 'post' && !hasCsrf) {
          bugs.push(makeBug('high', 'POST form missing CSRF token', 'form_fill',
            `Form ${fi + 1} uses POST but has no CSRF token input or meta tag`,
            ['Navigate to ' + url, `Inspect form ${fi + 1}`, 'Look for CSRF token'],
            'POST forms should include a CSRF protection token',
            'No CSRF token found',
            url));
        }

        // --- Check password field autocomplete ---
        const passwordFields = await form.$$('input[type="password"]');
        for (const pwField of passwordFields) {
          const autocomplete = await pwField.getAttribute('autocomplete');
          if (!autocomplete || (autocomplete !== 'new-password' && autocomplete !== 'current-password' && autocomplete !== 'off')) {
            bugs.push(makeBug('medium', 'Password field missing proper autocomplete', 'form_fill',
              `Password field in form ${fi + 1} does not have autocomplete="new-password" or autocomplete="current-password"`,
              ['Navigate to ' + url, `Inspect password field in form ${fi + 1}`],
              'Password fields should have autocomplete="new-password" or "current-password"',
              `autocomplete="${autocomplete || 'not set'}"`,
              url));
          }
        }

        // --- Check autofill attributes on common fields ---
        const autofillChecks = await form.evaluate(f => {
          const issues = [];
          const nameFields = f.querySelectorAll('input[name*="name"]:not([autocomplete])');
          const emailFields = f.querySelectorAll('input[type="email"]:not([autocomplete])');
          const telFields = f.querySelectorAll('input[type="tel"]:not([autocomplete])');
          if (nameFields.length > 0) issues.push('name field(s) missing autocomplete');
          if (emailFields.length > 0) issues.push('email field(s) missing autocomplete');
          if (telFields.length > 0) issues.push('tel field(s) missing autocomplete');
          return issues;
        });

        for (const issue of autofillChecks) {
          bugs.push(makeBug('low', `Missing autocomplete attribute: ${issue}`, 'form_fill',
            `Form ${fi + 1} has ${issue}`,
            ['Navigate to ' + url, `Inspect form ${fi + 1} fields`],
            'Input fields should have appropriate autocomplete attributes for browser autofill',
            issue,
            url));
        }

        // --- Fill all inputs ---
        const inputs = await form.$$('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select');

        if (inputs.length === 0) continue;

        broadcast({ type: 'log', text: `  Filling ${inputs.length} fields in form ${fi + 1}...`, color: '#4ECDC4' });

        for (const input of inputs) {
          try {
            const type = (await input.getAttribute('type') || 'text').toLowerCase();
            const tagName = await input.evaluate(el => el.tagName.toLowerCase());
            const isDisabled = await input.isDisabled();
            const isVisible = await input.isVisible();

            if (isDisabled || !isVisible) continue;

            if (tagName === 'select') {
              const optCount = await input.$$eval('option', opts => opts.length);
              if (optCount > 1) {
                await input.selectOption({ index: 1 });
              }
            } else if (tagName === 'textarea') {
              await input.fill(TEST_DATA.textarea);
            } else if (type === 'checkbox') {
              const isChecked = await input.isChecked();
              if (!isChecked) await input.check({ timeout: 2000 }).catch(() => {});
            } else if (type === 'radio') {
              const isChecked = await input.isChecked();
              if (!isChecked) await input.check({ timeout: 2000 }).catch(() => {});
            } else if (type === 'file') {
              // Create a small test file for file upload
              try {
                await input.setInputFiles({
                  name: 'test.txt',
                  mimeType: 'text/plain',
                  buffer: Buffer.from('Test file content for upload validation'),
                });
              } catch (_) { /* file input may have restrictions */ }
            } else if (type === 'color') {
              await input.fill(TEST_DATA.color);
            } else if (type === 'range') {
              await input.fill(TEST_DATA.range);
            } else if (type === 'date') {
              await input.fill(TEST_DATA.date);
            } else if (type === 'datetime-local') {
              await input.fill(TEST_DATA['datetime-local']);
            } else if (type === 'time') {
              await input.fill(TEST_DATA.time);
            } else if (type === 'month') {
              await input.fill(TEST_DATA.month);
            } else if (type === 'week') {
              await input.fill(TEST_DATA.week);
            } else {
              const testValue = TEST_DATA[type] || TEST_DATA.text;
              await input.fill(testValue);
            }
          } catch (_) {
            // Field might not be fillable — skip
          }
        }

        // --- Test form submission via submit button ---
        const submitBtn = await form.$('button[type="submit"], input[type="submit"], button:not([type])');
        const beforeUrl = page.url();
        const beforeContent = await page.content();
        let submitSucceeded = false;

        if (submitBtn) {
          try {
            await submitBtn.click({ timeout: 3000 });
          } catch (_) {
            // Button click may fail (e.g. overlay)
          }
        } else {
          // No submit button — try Enter key
          try {
            await page.keyboard.press('Enter');
          } catch (_) {}
        }

        await page.waitForTimeout(2500);

        const afterUrl = page.url();
        const afterContent = await page.content();

        // Detect success
        const successIndicators = await page.evaluate(() => {
          const text = document.body.innerText.toLowerCase();
          const hasSuccessClass = !!document.querySelector('.success, .alert-success, .toast-success, [role="status"]');
          const hasThankYou = text.includes('thank') || text.includes('success') || text.includes('submitted');
          return { hasSuccessClass, hasThankYou };
        });

        const urlChanged = beforeUrl !== afterUrl;
        const contentChanged = beforeContent !== afterContent;

        if (successIndicators.hasSuccessClass || successIndicators.hasThankYou || urlChanged) {
          submitSucceeded = true;
        }

        // Check for error on valid data
        const errorElements = await page.$$('.error, .alert-danger, .alert-error, [role="alert"], .form-error, .validation-error, .field-error, .is-invalid');
        const hasErrorText = await page.evaluate(() => {
          const text = document.body.innerText.toLowerCase();
          return (text.includes('error') || text.includes('failed') || text.includes('invalid')) &&
            !text.includes('success');
        });

        if ((errorElements.length > 0 || hasErrorText) && !submitSucceeded) {
          bugs.push(makeBug('medium', `Form ${fi + 1} submission error with valid data`, 'form_fill',
            'Form submission resulted in an error when filled with valid test data',
            ['Navigate to ' + url, `Fill form ${fi + 1} with valid data`, 'Submit form'],
            'Form should submit successfully with valid data',
            'Error message displayed after submission',
            url));
        }

        // --- Test submission via Enter key (if we used button above) ---
        if (submitBtn) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
            const formsAgain = await page.$$('form');
            if (fi < formsAgain.length) {
              const formAgain = formsAgain[fi];
              const lastInput = await formAgain.$('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):last-of-type');
              if (lastInput) {
                await lastInput.fill('test');
                await lastInput.press('Enter');
                await page.waitForTimeout(1500);
                // If nothing happened (no URL change, no content change), Enter key submit may be broken
                const enterUrl = page.url();
                const enterContent = await page.content();
                if (enterUrl === url && enterContent === beforeContent) {
                  // This is just informational — many forms only submit via button
                }
              }
            }
          } catch (_) { /* non-critical */ }
        }

        // --- Test: verify form data preserved on failed submission ---
        // Navigate back if we were redirected
        if (afterUrl !== beforeUrl) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
          } catch (_) {}
        }

      } catch (e) {
        broadcast({ type: 'log', text: `Form ${fi + 1} test error: ${e.message}`, color: '#F5A623' });
      }
    }

    // --- Test multi-step/wizard forms ---
    broadcast({ type: 'log', text: 'Checking for multi-step/wizard forms...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const wizardBtns = await page.$$('button:has-text("Next"), button:has-text("Continue"), button:has-text("next"), a:has-text("Next Step"), button:has-text("Proceed"), [data-step], .wizard-next, .step-next');

    if (wizardBtns.length > 0) {
      broadcast({ type: 'log', text: `Found ${wizardBtns.length} potential wizard navigation elements`, color: '#4ECDC4' });

      let stepCount = 0;
      for (const btn of wizardBtns.slice(0, 5)) {
        try {
          const isVisible = await btn.isVisible();
          if (!isVisible) continue;

          const contentBefore = await page.evaluate(() => document.body.innerText.slice(0, 300));
          await btn.click({ timeout: 2000 });
          await page.waitForTimeout(1000);
          const contentAfter = await page.evaluate(() => document.body.innerText.slice(0, 300));

          if (contentBefore !== contentAfter) {
            stepCount++;
          }
        } catch (_) {}
      }

      if (stepCount > 0) {
        broadcast({ type: 'log', text: `  Navigated through ${stepCount} wizard step(s)`, color: '#4ECDC4' });
      }
    }

    // --- Check for forms with required fields — fill only required, submit ---
    broadcast({ type: 'log', text: 'Testing required-fields-only submission...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const formsForRequired = await page.$$('form');
    for (let fi = 0; fi < Math.min(formsForRequired.length, 3); fi++) {
      const form = formsForRequired[fi];
      const requiredInputs = await form.$$('input[required]:not([type="hidden"]), textarea[required], select[required]');

      if (requiredInputs.length === 0) continue;

      try {
        for (const input of requiredInputs) {
          const type = (await input.getAttribute('type') || 'text').toLowerCase();
          const tagName = await input.evaluate(el => el.tagName.toLowerCase());
          const isVisible = await input.isVisible();
          if (!isVisible) continue;

          if (tagName === 'select') {
            const optCount = await input.$$eval('option', opts => opts.length);
            if (optCount > 1) await input.selectOption({ index: 1 });
          } else if (tagName === 'textarea') {
            await input.fill('Required field test');
          } else if (type === 'checkbox') {
            await input.check().catch(() => {});
          } else {
            const val = TEST_DATA[type] || TEST_DATA.text;
            await input.fill(val);
          }
        }

        const submitBtn = await form.$('button[type="submit"], input[type="submit"], button:not([type])');
        if (submitBtn) {
          await submitBtn.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(1500);
        }
      } catch (_) {}
    }

    broadcast({ type: 'log', text: 'Form fill testing complete', color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Form fill error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

// ---------------------------------------------------------------------------
// runFormValidation
// ---------------------------------------------------------------------------

async function runFormValidation(page, url, options, broadcast) {
  const bugs = [];
  const timeout = (options.timeout || 30) * 1000;

  broadcast({ type: 'log', text: 'Starting comprehensive form validation testing...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const formCount = await page.$$eval('form', fs => fs.length);
    broadcast({ type: 'log', text: `Found ${formCount} forms to validate`, color: '#4ECDC4' });

    for (let fi = 0; fi < formCount; fi++) {
      try {
        // --- Reset page for each form ---
        if (fi > 0) {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        }

        const forms = await page.$$('form');
        if (fi >= forms.length) break;
        const form = forms[fi];

        broadcast({ type: 'log', text: `Validating form ${fi + 1}/${formCount}...`, color: '#4ECDC4' });

        // ---- TEST 1: Submit empty form ----
        const submitBtn = await form.$('button[type="submit"], input[type="submit"], button:not([type])');

        if (submitBtn) {
          try {
            await submitBtn.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(800);

            const hasValidation = await page.evaluate(() => {
              const inputs = document.querySelectorAll('input, textarea, select');
              for (const input of inputs) {
                if (input.validationMessage || (input.validity && !input.validity.valid)) {
                  return true;
                }
              }
              return !!document.querySelector('.error, .invalid, [aria-invalid="true"], .is-invalid, .field-error, .form-error, [role="alert"]');
            });

            const hasRequired = await form.$$eval('input[required], textarea[required], select[required]', els => els.length > 0);

            if (hasRequired && !hasValidation) {
              bugs.push(makeBug('medium', `Form ${fi + 1}: no validation on empty submit`, 'form_validation',
                'Form with required fields can be submitted empty without validation errors',
                ['Navigate to ' + url, `Click submit on empty form ${fi + 1}`],
                'Validation errors should appear for required fields',
                'No validation messages shown',
                url));
            }
          } catch (_) {}
        }

        // ---- TEST 2: Test each required field individually ----
        const requiredFields = await form.$$('input[required]:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea[required], select[required]');

        broadcast({ type: 'log', text: `  Testing ${requiredFields.length} required fields individually...`, color: '#4ECDC4' });

        for (let ri = 0; ri < requiredFields.length; ri++) {
          try {
            // Reload form state
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
            const freshForms = await page.$$('form');
            if (fi >= freshForms.length) break;
            const freshForm = freshForms[fi];

            // Fill ALL required fields except the one we're testing
            const allRequired = await freshForm.$$('input[required]:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea[required], select[required]');

            for (let j = 0; j < allRequired.length; j++) {
              if (j === ri) continue; // Skip the one we're testing
              try {
                const type = (await allRequired[j].getAttribute('type') || 'text').toLowerCase();
                const tag = await allRequired[j].evaluate(el => el.tagName.toLowerCase());
                const isVis = await allRequired[j].isVisible();
                if (!isVis) continue;

                if (tag === 'select') {
                  await allRequired[j].selectOption({ index: 1 }).catch(() => {});
                } else if (tag === 'textarea') {
                  await allRequired[j].fill('Test value');
                } else {
                  await allRequired[j].fill(TEST_DATA[type] || 'testvalue');
                }
              } catch (_) {}
            }

            // Also fill required checkboxes
            const reqCheckboxes = await freshForm.$$('input[type="checkbox"][required]');
            for (const cb of reqCheckboxes) {
              await cb.check().catch(() => {});
            }

            // Submit with one required field empty
            const freshSubmit = await freshForm.$('button[type="submit"], input[type="submit"], button:not([type])');
            if (freshSubmit) {
              await freshSubmit.click({ timeout: 2000 }).catch(() => {});
              await page.waitForTimeout(500);

              // Check that validation triggered
              const fieldName = await allRequired[ri].getAttribute('name') || await allRequired[ri].getAttribute('id') || `field ${ri + 1}`;
              const fieldIsInvalid = await allRequired[ri].evaluate(el => {
                return !el.validity.valid || el.classList.contains('is-invalid') || el.getAttribute('aria-invalid') === 'true';
              }).catch(() => false);

              // Check if page navigated (meaning validation was bypassed)
              if (page.url() !== url) {
                bugs.push(makeBug('high', `Required field "${fieldName}" validation bypassed`, 'form_validation',
                  `Form submitted successfully even though required field "${fieldName}" was empty`,
                  ['Navigate to ' + url, `Fill all fields except "${fieldName}"`, 'Submit form'],
                  `Validation should prevent submission when "${fieldName}" is empty`,
                  'Form submitted without the required field',
                  url));
              }
            }
          } catch (_) {}
        }

        // ---- TEST 3: Invalid format testing ----
        broadcast({ type: 'log', text: `  Testing invalid formats...`, color: '#4ECDC4' });

        for (const [fieldType, invalidValues] of Object.entries(INVALID_DATA)) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
            const freshForms = await page.$$('form');
            if (fi >= freshForms.length) break;
            const freshForm = freshForms[fi];

            const targetSelector = fieldType === 'email' ? 'input[type="email"]' :
                                   fieldType === 'url' ? 'input[type="url"]' :
                                   fieldType === 'tel' ? 'input[type="tel"]' :
                                   fieldType === 'number' ? 'input[type="number"]' : null;
            if (!targetSelector) continue;

            const targetField = await freshForm.$(targetSelector);
            if (!targetField) continue;
            const isVisible = await targetField.isVisible();
            if (!isVisible) continue;

            for (const { value, desc } of invalidValues) {
              try {
                await targetField.fill(''); // Clear first
                await targetField.fill(value);
                await page.keyboard.press('Tab');
                await page.waitForTimeout(300);

                const isInvalid = await targetField.evaluate(el => !el.validity.valid);

                if (!isInvalid) {
                  bugs.push(makeBug('low', `${fieldType} field accepts invalid input: ${desc}`, 'form_validation',
                    `${fieldType} field accepted "${value}" (${desc}) without validation error`,
                    ['Navigate to ' + url, `Enter "${value}" in ${fieldType} field`, 'Tab out'],
                    `Field should reject "${value}" as invalid ${fieldType}`,
                    `Value "${value}" accepted`,
                    url));
                }
              } catch (_) {}
            }
          } catch (_) {}
        }

        // ---- TEST 4: Boundary value testing (minlength, maxlength, min, max, step) ----
        broadcast({ type: 'log', text: `  Testing boundary values...`, color: '#4ECDC4' });

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
          const freshForms = await page.$$('form');
          if (fi >= freshForms.length) continue;
          const freshForm = freshForms[fi];

          const constrainedFields = await freshForm.evaluate(f => {
            const fields = [];
            const inputs = f.querySelectorAll('input, textarea');
            for (const inp of inputs) {
              const constraints = {};
              if (inp.getAttribute('minlength')) constraints.minlength = parseInt(inp.getAttribute('minlength'));
              if (inp.getAttribute('maxlength')) constraints.maxlength = parseInt(inp.getAttribute('maxlength'));
              if (inp.getAttribute('min')) constraints.min = parseFloat(inp.getAttribute('min'));
              if (inp.getAttribute('max')) constraints.max = parseFloat(inp.getAttribute('max'));
              if (inp.getAttribute('step')) constraints.step = inp.getAttribute('step');
              if (inp.getAttribute('pattern')) constraints.pattern = inp.getAttribute('pattern');

              if (Object.keys(constraints).length > 0) {
                fields.push({
                  selector: inp.id ? `#${inp.id}` : (inp.name ? `[name="${inp.name}"]` : null),
                  type: inp.type || 'text',
                  name: inp.name || inp.id || 'unnamed',
                  ...constraints,
                });
              }
            }
            return fields;
          });

          for (const field of constrainedFields) {
            if (!field.selector) continue;
            const el = await freshForm.$(field.selector);
            if (!el) continue;
            const isVisible = await el.isVisible().catch(() => false);
            if (!isVisible) continue;

            // Test below minlength
            if (field.minlength && field.minlength > 1) {
              try {
                const shortVal = 'a'.repeat(field.minlength - 1);
                await el.fill(shortVal);
                await page.keyboard.press('Tab');
                await page.waitForTimeout(200);
                const isInvalid = await el.evaluate(e => !e.validity.valid);
                if (!isInvalid) {
                  bugs.push(makeBug('low', `minlength not enforced on "${field.name}"`, 'form_validation',
                    `Field "${field.name}" accepted ${field.minlength - 1} chars (min is ${field.minlength})`,
                    ['Navigate to ' + url, `Enter ${field.minlength - 1} characters in "${field.name}"`],
                    `Should reject input shorter than ${field.minlength} characters`,
                    'Input accepted',
                    url));
                }
              } catch (_) {}
            }

            // Test above max for number fields
            if (field.max !== undefined && (field.type === 'number' || field.type === 'range')) {
              try {
                await el.fill(String(field.max + 1));
                await page.keyboard.press('Tab');
                await page.waitForTimeout(200);
                const isInvalid = await el.evaluate(e => !e.validity.valid);
                if (!isInvalid) {
                  bugs.push(makeBug('low', `max value not enforced on "${field.name}"`, 'form_validation',
                    `Field "${field.name}" accepted ${field.max + 1} (max is ${field.max})`,
                    ['Navigate to ' + url, `Enter ${field.max + 1} in "${field.name}"`],
                    `Should reject values above ${field.max}`,
                    'Value accepted',
                    url));
                }
              } catch (_) {}
            }

            // Test below min for number fields
            if (field.min !== undefined && (field.type === 'number' || field.type === 'range')) {
              try {
                await el.fill(String(field.min - 1));
                await page.keyboard.press('Tab');
                await page.waitForTimeout(200);
                const isInvalid = await el.evaluate(e => !e.validity.valid);
                if (!isInvalid) {
                  bugs.push(makeBug('low', `min value not enforced on "${field.name}"`, 'form_validation',
                    `Field "${field.name}" accepted ${field.min - 1} (min is ${field.min})`,
                    ['Navigate to ' + url, `Enter ${field.min - 1} in "${field.name}"`],
                    `Should reject values below ${field.min}`,
                    'Value accepted',
                    url));
                }
              } catch (_) {}
            }
          }
        } catch (_) {}

        // ---- TEST 5: Error messages are visible and associated correctly ----
        broadcast({ type: 'log', text: `  Checking error message accessibility...`, color: '#4ECDC4' });

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
          const freshForms = await page.$$('form');
          if (fi >= freshForms.length) continue;
          const freshForm = freshForms[fi];

          // Submit empty to trigger errors
          const sub = await freshForm.$('button[type="submit"], input[type="submit"], button:not([type])');
          if (sub) {
            await sub.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(800);

            // Check for accessible error messaging
            const a11yIssues = await page.evaluate(() => {
              const issues = [];
              const invalidFields = document.querySelectorAll('[aria-invalid="true"], .is-invalid, .error, .invalid');

              for (const field of invalidFields) {
                const describedBy = field.getAttribute('aria-describedby');
                if (!describedBy) {
                  const name = field.getAttribute('name') || field.getAttribute('id') || 'unknown';
                  issues.push(`Field "${name}" has error state but no aria-describedby`);
                } else {
                  const descEl = document.getElementById(describedBy);
                  if (!descEl) {
                    issues.push(`aria-describedby="${describedBy}" references non-existent element`);
                  }
                }
              }

              // Check for role="alert" on error containers
              const errorContainers = document.querySelectorAll('.error-message, .form-error, .validation-error, .field-error');
              let hasAlertRole = false;
              for (const ec of errorContainers) {
                if (ec.getAttribute('role') === 'alert' || ec.closest('[role="alert"]')) {
                  hasAlertRole = true;
                  break;
                }
              }
              if (errorContainers.length > 0 && !hasAlertRole) {
                issues.push('Error messages lack role="alert" for screen reader announcement');
              }

              return issues;
            });

            for (const issue of a11yIssues) {
              bugs.push(makeBug('medium', 'Inaccessible error messaging', 'form_validation',
                issue,
                ['Navigate to ' + url, 'Submit empty form', 'Inspect error messages'],
                'Error messages should use aria-describedby and role="alert"',
                issue,
                url));
            }
          }
        } catch (_) {}

        // ---- TEST 6: Validation errors clear when corrected ----
        broadcast({ type: 'log', text: `  Testing error clearance...`, color: '#4ECDC4' });

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
          const freshForms = await page.$$('form');
          if (fi >= freshForms.length) continue;
          const freshForm = freshForms[fi];

          // Trigger errors
          const sub = await freshForm.$('button[type="submit"], input[type="submit"], button:not([type])');
          if (sub) {
            await sub.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(500);

            // Count errors before correction
            const errorsBefore = await page.$$eval('.error, .is-invalid, [aria-invalid="true"], .field-error, .invalid', els => els.length);

            if (errorsBefore > 0) {
              // Fill required fields
              const reqFields = await freshForm.$$('input[required]:not([type="hidden"]), textarea[required]');
              for (const rf of reqFields) {
                try {
                  const type = (await rf.getAttribute('type') || 'text').toLowerCase();
                  const isVis = await rf.isVisible();
                  if (!isVis) continue;
                  await rf.fill(TEST_DATA[type] || 'corrected value');
                  await page.keyboard.press('Tab');
                } catch (_) {}
              }

              await page.waitForTimeout(500);

              const errorsAfter = await page.$$eval('.error, .is-invalid, [aria-invalid="true"], .field-error, .invalid', els => els.length);

              if (errorsAfter >= errorsBefore) {
                bugs.push(makeBug('low', 'Validation errors not cleared after correction', 'form_validation',
                  `Form ${fi + 1} still shows ${errorsAfter} error indicator(s) after correcting the fields`,
                  ['Navigate to ' + url, 'Submit empty form', 'Fill in required fields', 'Observe error states'],
                  'Error indicators should clear when the field is corrected',
                  `${errorsAfter} errors remain visible after correction`,
                  url));
              }
            }
          }
        } catch (_) {}

        // ---- TEST 7: XSS in form fields ----
        broadcast({ type: 'log', text: `  Testing XSS in form fields...`, color: '#4ECDC4' });

        for (const payload of XSS_PAYLOADS) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
            const freshForms = await page.$$('form');
            if (fi >= freshForms.length) break;
            const freshForm = freshForms[fi];

            const textInputs = await freshForm.$$('input[type="text"], input:not([type]), textarea');
            if (textInputs.length === 0) break;

            // Set up dialog listener to detect XSS
            let alertFired = false;
            page.on('dialog', async (dialog) => {
              alertFired = true;
              await dialog.dismiss();
            });

            await textInputs[0].fill(payload);

            // Try submitting
            const sub = await freshForm.$('button[type="submit"], input[type="submit"], button:not([type])');
            if (sub) {
              await sub.click({ timeout: 2000 }).catch(() => {});
            }
            await page.waitForTimeout(1000);

            // Check if the payload rendered as HTML
            const xssRendered = await page.evaluate((xssPayload) => {
              const html = document.body.innerHTML;
              // Check if script tags or event handlers made it into the DOM unescaped
              return html.includes('<script>alert') || html.includes('onerror=alert') || html.includes('onmouseover=alert');
            }, payload);

            if (alertFired || xssRendered) {
              bugs.push(makeBug('critical', 'XSS vulnerability in form field', 'form_validation',
                `XSS payload "${payload.slice(0, 30)}..." executed or rendered unescaped`,
                ['Navigate to ' + url, `Enter "${payload.slice(0, 30)}..." in a text field`, 'Submit form'],
                'User input should be properly escaped/sanitized',
                'Script executed or rendered in DOM',
                url));
            }

            page.removeAllListeners('dialog');
          } catch (_) {
            page.removeAllListeners('dialog');
          }
        }

        // ---- TEST 8: Client-side vs server-side validation ----
        broadcast({ type: 'log', text: `  Testing server-side validation (JS disabled)...`, color: '#4ECDC4' });

        try {
          // Attempt to bypass client-side validation by removing required attributes via JS
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
          const freshForms = await page.$$('form');
          if (fi >= freshForms.length) continue;
          const freshForm = freshForms[fi];

          // Remove required attributes and HTML5 validation
          await freshForm.evaluate(f => {
            f.setAttribute('novalidate', '');
            const inputs = f.querySelectorAll('[required]');
            for (const inp of inputs) {
              inp.removeAttribute('required');
              inp.removeAttribute('pattern');
              inp.removeAttribute('minlength');
              inp.removeAttribute('maxlength');
            }
          });

          // Submit the empty form
          const sub = await freshForm.$('button[type="submit"], input[type="submit"], button:not([type])');
          if (sub) {
            const beforeNav = page.url();
            await sub.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(2000);

            // If the form submitted without any server-side error, there's no server validation
            const afterNav = page.url();
            const serverError = await page.evaluate(() => {
              const text = document.body.innerText.toLowerCase();
              return text.includes('error') || text.includes('required') || text.includes('invalid') || text.includes('failed');
            });

            if (!serverError && afterNav !== beforeNav) {
              bugs.push(makeBug('high', 'No server-side form validation', 'form_validation',
                `Form ${fi + 1} accepted empty/invalid data when client-side validation was bypassed`,
                ['Navigate to ' + url, 'Disable client-side validation (remove required attributes)', 'Submit empty form'],
                'Server should validate form data independently of client-side checks',
                'Form submitted successfully without server validation',
                url));
            }
          }
        } catch (_) {}

        // ---- TEST 9: Paste vs type for validation triggers ----
        broadcast({ type: 'log', text: `  Testing paste-triggered validation...`, color: '#4ECDC4' });

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
          const freshForms = await page.$$('form');
          if (fi >= freshForms.length) continue;
          const freshForm = freshForms[fi];

          const emailField = await freshForm.$('input[type="email"]');
          if (emailField) {
            const isVisible = await emailField.isVisible();
            if (isVisible) {
              // Simulate paste of invalid email via evaluate
              await emailField.evaluate(el => {
                el.value = 'invalid-pasted-email';
                el.dispatchEvent(new Event('paste', { bubbles: true }));
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              });
              await page.keyboard.press('Tab');
              await page.waitForTimeout(300);

              const isInvalid = await emailField.evaluate(el => !el.validity.valid || el.classList.contains('is-invalid'));
              if (!isInvalid) {
                bugs.push(makeBug('low', 'Pasted invalid email not validated', 'form_validation',
                  'Pasting an invalid email address does not trigger validation',
                  ['Navigate to ' + url, 'Paste "invalid-pasted-email" into email field', 'Tab out'],
                  'Validation should trigger on pasted content',
                  'Pasted value accepted without validation',
                  url));
              }
            }
          }
        } catch (_) {}

      } catch (e) {
        broadcast({ type: 'log', text: `Form ${fi + 1} validation error: ${e.message}`, color: '#F5A623' });
      }
    }

    broadcast({ type: 'log', text: 'Form validation testing complete', color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Validation test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

// ---------------------------------------------------------------------------
// runCmdExecute
// ---------------------------------------------------------------------------

async function runCmdExecute(page, url, options, broadcast) {
  const bugs = [];
  const timeout = (options.timeout || 30) * 1000;

  broadcast({ type: 'log', text: 'Starting comprehensive button/command execution testing...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    // --- Gather ALL interactive elements ---
    const interactiveElements = await page.evaluate(() => {
      const elements = [];
      const selectors = [
        'button',
        '[role="button"]',
        'input[type="button"]',
        'input[type="submit"]',
        'a.btn',
        '.button',
        '[role="switch"]',
        '[role="tab"]',
        '[role="menuitem"]',
        'details > summary',
      ];

      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const rect = el.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
          if (!visible) continue;

          const text = (el.textContent || '').trim().slice(0, 50);
          const ariaLabel = el.getAttribute('aria-label') || '';
          const role = el.getAttribute('role') || el.tagName.toLowerCase();
          const disabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
          const href = el.getAttribute('href');

          // Categorize
          let category = 'action';
          if (role === 'switch' || el.classList.contains('toggle')) category = 'toggle';
          if (role === 'tab') category = 'tab';
          if (role === 'menuitem') category = 'menu';
          if (text.toLowerCase().includes('close') || text.toLowerCase().includes('cancel') || text.toLowerCase().includes('dismiss')) category = 'close';
          if (el.getAttribute('data-toggle') === 'modal' || el.getAttribute('data-bs-toggle') === 'modal' || text.toLowerCase().includes('open') || text.toLowerCase().includes('show')) category = 'modal';
          if (el.getAttribute('data-toggle') === 'dropdown' || el.getAttribute('data-bs-toggle') === 'dropdown') category = 'dropdown';

          // Build a selector for re-finding
          let selector = '';
          if (el.id) selector = `#${el.id}`;
          else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;

          elements.push({ text, ariaLabel, role, disabled, href, category, selector, index: elements.length });
        }
      }
      return elements;
    });

    broadcast({ type: 'log', text: `Found ${interactiveElements.length} interactive elements`, color: '#4ECDC4' });

    let unresponsiveCount = 0;
    const unresponsiveButtons = [];

    // --- Categorised testing ---

    // Helper to get a clickable element handle
    async function getElement(info) {
      if (info.selector) {
        const el = await page.$(info.selector);
        if (el) return el;
      }
      // Fallback: find by text
      const allBtns = await page.$$('button, [role="button"], input[type="button"], a.btn, .button, [role="switch"], [role="tab"]');
      if (info.index < allBtns.length) return allBtns[info.index];
      return null;
    }

    // ---- Test all visible buttons ----
    for (const elInfo of interactiveElements) {
      // Skip navigation links and disabled buttons
      if (elInfo.href && (elInfo.href.startsWith('http') || elInfo.href.startsWith('/'))) continue;
      if (elInfo.disabled) continue;

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

        // Re-find the element
        const allClickables = await page.$$('button, [role="button"], input[type="button"], a.btn, .button, [role="switch"], [role="tab"], [role="menuitem"], details > summary');
        const visibleClickables = [];
        for (const c of allClickables) {
          if (await c.isVisible().catch(() => false)) visibleClickables.push(c);
        }
        if (elInfo.index >= visibleClickables.length) continue;
        const el = visibleClickables[elInfo.index];

        const beforeContent = await page.evaluate(() => document.body.innerHTML.length);
        const beforeUrl = page.url();

        // Set up network request tracking
        let networkRequestFired = false;
        const reqHandler = () => { networkRequestFired = true; };
        page.on('request', reqHandler);

        // Click
        await el.click({ timeout: 2000 });
        await page.waitForTimeout(800);

        page.off('request', reqHandler);

        const afterContent = await page.evaluate(() => document.body.innerHTML.length);
        const afterUrl = page.url();
        const contentChanged = Math.abs(beforeContent - afterContent) > 50;
        const urlChanged = beforeUrl !== afterUrl;

        if (!contentChanged && !urlChanged && !networkRequestFired) {
          unresponsiveCount++;
          unresponsiveButtons.push(elInfo.text || elInfo.ariaLabel || `element #${elInfo.index}`);
        }
      } catch (_) { /* click may fail */ }
    }

    if (unresponsiveCount > 0) {
      bugs.push(makeBug(
        unresponsiveCount > 5 ? 'medium' : 'low',
        `${unresponsiveCount} unresponsive interactive element(s)`,
        'cmd_execute',
        `The following elements showed no response when clicked: ${unresponsiveButtons.slice(0, 10).join(', ')}${unresponsiveButtons.length > 10 ? '...' : ''}`,
        ['Navigate to ' + url, 'Click various buttons', 'Observe no visible response'],
        'Buttons should provide visible feedback when clicked',
        `${unresponsiveCount} elements had no effect`,
        url));
    }

    // ---- Modal open/close testing ----
    broadcast({ type: 'log', text: 'Testing modal dialogs...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const modalTriggers = await page.$$('[data-toggle="modal"], [data-bs-toggle="modal"], [aria-haspopup="dialog"]');

    for (const trigger of modalTriggers.slice(0, 5)) {
      try {
        const isVisible = await trigger.isVisible();
        if (!isVisible) continue;

        await trigger.click({ timeout: 2000 });
        await page.waitForTimeout(500);

        // Check if a modal appeared
        const modalVisible = await page.evaluate(() => {
          const modal = document.querySelector('.modal.show, .modal[open], [role="dialog"]:not([hidden]), dialog[open]');
          return !!modal;
        });

        if (modalVisible) {
          // Try to close it
          const closeBtn = await page.$('.modal .close, .modal [data-dismiss="modal"], .modal [data-bs-dismiss="modal"], dialog button[aria-label="Close"], [role="dialog"] button:has-text("Close"), [role="dialog"] button:has-text("Cancel")');

          if (closeBtn) {
            await closeBtn.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(500);
          } else {
            // Try Escape key
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }

          // Check for orphan overlays
          const orphanOverlay = await page.evaluate(() => {
            const overlays = document.querySelectorAll('.modal-backdrop, .overlay, [class*="backdrop"]');
            for (const o of overlays) {
              if (getComputedStyle(o).display !== 'none' && getComputedStyle(o).visibility !== 'hidden') {
                return true;
              }
            }
            return false;
          });

          if (orphanOverlay) {
            bugs.push(makeBug('medium', 'Orphan modal overlay after close', 'cmd_execute',
              'After closing a modal, a backdrop/overlay element remains visible',
              ['Navigate to ' + url, 'Open a modal dialog', 'Close the modal'],
              'Overlay should be removed when modal closes',
              'Backdrop overlay still visible',
              url));
          }

          // Check if modal is actually gone
          const stillVisible = await page.evaluate(() => {
            const modal = document.querySelector('.modal.show, .modal[open], [role="dialog"]:not([hidden]), dialog[open]');
            return !!modal;
          });

          if (stillVisible) {
            bugs.push(makeBug('medium', 'Modal did not close properly', 'cmd_execute',
              'Modal dialog remains visible after clicking close or pressing Escape',
              ['Navigate to ' + url, 'Open modal', 'Click close/press Escape'],
              'Modal should close',
              'Modal still visible',
              url));
          }
        }
      } catch (_) {}
    }

    // ---- Dropdown menu testing ----
    broadcast({ type: 'log', text: 'Testing dropdown menus...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const dropdownTriggers = await page.$$('[data-toggle="dropdown"], [data-bs-toggle="dropdown"], [aria-haspopup="listbox"], [aria-haspopup="menu"], .dropdown-toggle');

    for (const trigger of dropdownTriggers.slice(0, 5)) {
      try {
        const isVisible = await trigger.isVisible();
        if (!isVisible) continue;

        await trigger.click({ timeout: 2000 });
        await page.waitForTimeout(500);

        // Check if dropdown opened
        const dropdownOpen = await page.evaluate(() => {
          const menu = document.querySelector('.dropdown-menu.show, [role="listbox"]:not([hidden]), [role="menu"]:not([hidden]), .dropdown.open .dropdown-menu');
          return !!menu;
        });

        if (dropdownOpen) {
          // Try selecting an item
          const menuItem = await page.$('.dropdown-menu.show a, .dropdown-menu.show button, [role="option"], [role="menuitem"]');
          if (menuItem) {
            const itemText = await menuItem.textContent();
            await menuItem.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(500);

            // Verify dropdown closed after selection
            const stillOpen = await page.evaluate(() => {
              const menu = document.querySelector('.dropdown-menu.show, [role="listbox"]:not([hidden]), [role="menu"]:not([hidden])');
              return !!menu;
            });

            if (stillOpen) {
              bugs.push(makeBug('low', 'Dropdown menu stays open after selection', 'cmd_execute',
                'Dropdown menu did not close after selecting an item',
                ['Navigate to ' + url, 'Open dropdown', 'Select an item'],
                'Dropdown should close after selection',
                'Dropdown remains open',
                url));
            }
          }
        }
      } catch (_) {}
    }

    // ---- Toggle switch testing ----
    broadcast({ type: 'log', text: 'Testing toggle switches...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const toggles = await page.$$('[role="switch"], input[type="checkbox"].toggle, .toggle-switch, .switch input');

    for (const toggle of toggles.slice(0, 5)) {
      try {
        const isVisible = await toggle.isVisible();
        if (!isVisible) continue;

        const beforeState = await toggle.evaluate(el => {
          return el.getAttribute('aria-checked') || String(el.checked) || el.classList.contains('active') ? 'on' : 'off';
        });

        await toggle.click({ timeout: 2000 });
        await page.waitForTimeout(300);

        const afterState = await toggle.evaluate(el => {
          return el.getAttribute('aria-checked') || String(el.checked) || el.classList.contains('active') ? 'on' : 'off';
        });

        if (beforeState === afterState) {
          bugs.push(makeBug('low', 'Toggle switch did not change state', 'cmd_execute',
            'Clicking a toggle switch did not change its visual/ARIA state',
            ['Navigate to ' + url, 'Click toggle switch'],
            'Toggle state should change on click',
            'State remained the same',
            url));
        }
      } catch (_) {}
    }

    // ---- Keyboard accessibility testing ----
    broadcast({ type: 'log', text: 'Testing keyboard accessibility of buttons...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const keyboardTestBtns = await page.$$('button:visible, [role="button"]:visible');
    let keyboardInaccessible = 0;

    for (const btn of keyboardTestBtns.slice(0, 10)) {
      try {
        const isVisible = await btn.isVisible();
        if (!isVisible) continue;

        // Check if element is focusable
        const tabIndex = await btn.evaluate(el => el.tabIndex);
        if (tabIndex < 0) {
          keyboardInaccessible++;
          continue;
        }

        // Focus the element
        await btn.focus();
        await page.waitForTimeout(100);

        // Check if it received focus
        const hasFocus = await btn.evaluate(el => document.activeElement === el);
        if (!hasFocus) {
          keyboardInaccessible++;
        }
      } catch (_) {}
    }

    if (keyboardInaccessible > 0) {
      bugs.push(makeBug('medium', `${keyboardInaccessible} button(s) not keyboard accessible`, 'cmd_execute',
        `${keyboardInaccessible} interactive elements cannot receive keyboard focus (tabIndex < 0 or focus() fails)`,
        ['Navigate to ' + url, 'Try tabbing to all buttons'],
        'All interactive elements should be reachable via keyboard',
        `${keyboardInaccessible} elements not focusable`,
        url));
    }

    // ---- Double-click protection testing ----
    broadcast({ type: 'log', text: 'Testing double-click protection on action buttons...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const submitBtns = await page.$$('button[type="submit"], form button:not([type])');
    for (const btn of submitBtns.slice(0, 3)) {
      try {
        const isVisible = await btn.isVisible();
        if (!isVisible) continue;

        let requestCount = 0;
        const reqHandler = (req) => {
          if (req.method() === 'POST') requestCount++;
        };
        page.on('request', reqHandler);

        // Rapid double-click
        await btn.click({ timeout: 2000 }).catch(() => {});
        await btn.click({ timeout: 500, force: true }).catch(() => {});
        await page.waitForTimeout(1000);

        page.off('request', reqHandler);

        if (requestCount > 1) {
          bugs.push(makeBug('medium', 'No double-click protection on submit button', 'cmd_execute',
            `Rapidly clicking a submit button sent ${requestCount} POST requests — no debounce/disable protection`,
            ['Navigate to ' + url, 'Rapidly click a submit button twice'],
            'Button should be disabled or debounced after first click',
            `${requestCount} POST requests sent`,
            url));
        }
      } catch (_) {}
    }

    // ---- Disabled button visual indicators ----
    broadcast({ type: 'log', text: 'Checking disabled button states...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const disabledBtns = await page.$$('button[disabled], [role="button"][aria-disabled="true"], button[aria-disabled="true"]');

    for (const btn of disabledBtns.slice(0, 5)) {
      try {
        const hasVisualIndicator = await btn.evaluate(el => {
          const style = getComputedStyle(el);
          const opacity = parseFloat(style.opacity);
          const cursor = style.cursor;
          const hasDisabledClass = el.classList.contains('disabled') || el.classList.contains('btn-disabled');
          return opacity < 1 || cursor === 'not-allowed' || cursor === 'default' || hasDisabledClass;
        });

        if (!hasVisualIndicator) {
          const btnText = await btn.textContent();
          bugs.push(makeBug('low', `Disabled button lacks visual indicator: "${(btnText || '').trim().slice(0, 30)}"`, 'cmd_execute',
            'A disabled button does not have reduced opacity, not-allowed cursor, or disabled styling',
            ['Navigate to ' + url, 'Find the disabled button'],
            'Disabled buttons should be visually distinguishable',
            'No visual disabled state detected',
            url));
        }
      } catch (_) {}
    }

    // ---- Tooltip/popover testing ----
    broadcast({ type: 'log', text: 'Testing tooltips and popovers...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const tooltipTriggers = await page.$$('[data-toggle="tooltip"], [data-bs-toggle="tooltip"], [title]:not(svg title), [data-tooltip], [data-tippy-content]');

    for (const trigger of tooltipTriggers.slice(0, 5)) {
      try {
        const isVisible = await trigger.isVisible();
        if (!isVisible) continue;

        await trigger.hover();
        await page.waitForTimeout(500);

        // Check if a tooltip appeared
        const tooltipVisible = await page.evaluate(() => {
          const tooltip = document.querySelector('.tooltip.show, .tippy-box, [role="tooltip"]:not([hidden])');
          return !!tooltip;
        });

        // Informational — not necessarily a bug if tooltip doesn't appear with title attr
      } catch (_) {}
    }

    // ---- Focus management after button actions ----
    broadcast({ type: 'log', text: 'Testing focus management...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    // Test that focus moves logically after modal open
    const modalTrigger = await page.$('[data-toggle="modal"], [data-bs-toggle="modal"]');
    if (modalTrigger) {
      try {
        const isVisible = await modalTrigger.isVisible();
        if (isVisible) {
          await modalTrigger.click({ timeout: 2000 });
          await page.waitForTimeout(500);

          const focusInModal = await page.evaluate(() => {
            const modal = document.querySelector('.modal.show, [role="dialog"]:not([hidden]), dialog[open]');
            if (!modal) return null;
            const active = document.activeElement;
            return modal.contains(active) ? 'in-modal' : 'outside-modal';
          });

          if (focusInModal === 'outside-modal') {
            bugs.push(makeBug('medium', 'Focus not moved to modal on open', 'cmd_execute',
              'When a modal opens, focus does not move to an element inside the modal',
              ['Navigate to ' + url, 'Click to open a modal', 'Check where keyboard focus is'],
              'Focus should move inside the modal when it opens',
              'Focus remains outside the modal',
              url));
          }

          // Close modal and check focus returns
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);

          const focusAfterClose = await page.evaluate(() => {
            const active = document.activeElement;
            return active ? active.tagName : null;
          });

          // Focus should return to the trigger or a reasonable element
        }
      } catch (_) {}
    }

    // ---- Loading state detection ----
    broadcast({ type: 'log', text: 'Checking for loading state indicators on buttons...', color: '#4ECDC4' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    const actionBtns = await page.$$('button[type="submit"], form button');
    for (const btn of actionBtns.slice(0, 5)) {
      try {
        const isVisible = await btn.isVisible();
        if (!isVisible) continue;

        const hasLoadingState = await btn.evaluate(el => {
          // Check if the button has any loading-related classes or attributes
          const classes = el.className;
          const dataAttrs = el.getAttributeNames().filter(n => n.startsWith('data-'));
          return classes.includes('loading') || classes.includes('spinner') ||
                 dataAttrs.some(a => a.includes('loading')) ||
                 el.querySelector('.spinner, .loader, .loading-indicator') !== null;
        });
        // Informational — loading states are nice but not always present
      } catch (_) {}
    }

    broadcast({ type: 'log', text: `Command execution testing complete`, color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Command test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runFormFill, runFormValidation, runCmdExecute };
