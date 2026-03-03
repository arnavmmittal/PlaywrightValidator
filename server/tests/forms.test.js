const { v4: uuidv4 } = require('uuid');

/**
 * Forms & Interaction Tests
 * - Form auto-fill & submit
 * - Form validation checks
 * - Command/button execution
 */

const TEST_DATA = {
  text: 'Test User',
  email: 'test@example.com',
  password: 'TestPass123!',
  tel: '555-123-4567',
  number: '42',
  url: 'https://example.com',
  search: 'test query',
};

async function runFormFill(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing form auto-fill and submit...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const forms = await page.$$('form');
    broadcast({ type: 'log', text: `Found ${forms.length} forms on page`, color: '#4ECDC4' });

    for (const form of forms.slice(0, 3)) {
      try {
        // Find inputs in this form
        const inputs = await form.$$('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');

        if (inputs.length === 0) continue;

        broadcast({ type: 'log', text: `Filling form with ${inputs.length} fields...`, color: '#4ECDC4' });

        for (const input of inputs) {
          try {
            const type = await input.getAttribute('type') || 'text';
            const tagName = await input.evaluate(el => el.tagName.toLowerCase());

            if (tagName === 'select') {
              // Select first non-empty option
              const options = await input.$$('option');
              if (options.length > 1) {
                await input.selectOption({ index: 1 });
              }
            } else if (type === 'checkbox' || type === 'radio') {
              const isChecked = await input.isChecked();
              if (!isChecked) {
                await input.check({ timeout: 1000 }).catch(() => {});
              }
            } else if (tagName === 'textarea') {
              await input.fill('This is a test message for form validation.');
            } else {
              const testValue = TEST_DATA[type] || TEST_DATA.text;
              await input.fill(testValue);
            }
          } catch (e) {
            // Field might not be fillable
          }
        }

        // Try to submit
        const submitBtn = await form.$('button[type="submit"], input[type="submit"], button:not([type])');
        const beforeUrl = page.url();

        if (submitBtn) {
          await submitBtn.click({ timeout: 3000 }).catch(() => {});
        } else {
          // Try pressing Enter on last input
          await page.keyboard.press('Enter');
        }

        await page.waitForTimeout(2000);

        // Check for errors
        const errorElements = await page.$$('.error, .alert-danger, [role="alert"], .form-error, .validation-error');
        const pageContent = await page.content();

        const hasError = errorElements.length > 0 ||
                        pageContent.toLowerCase().includes('error') ||
                        pageContent.toLowerCase().includes('failed');

        if (hasError && !pageContent.toLowerCase().includes('success')) {
          bugs.push({
            id: uuidv4(),
            severity: 'medium',
            title: 'Form submission error',
            category: 'Forms & Interaction',
            testId: 'form_fill',
            description: 'Form submission resulted in an error with valid test data',
            stepsToReproduce: ['Navigate to ' + url, 'Fill form with test data', 'Submit form'],
            expected: 'Form should submit successfully with valid data',
            actual: 'Error message displayed after submission',
            url,
            timestamp: new Date().toISOString()
          });
        }

        // Navigate back for next form
        await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
      } catch (e) {
        broadcast({ type: 'log', text: `Form test error: ${e.message}`, color: '#F5A623' });
      }
    }

    broadcast({ type: 'log', text: 'Form fill testing complete', color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Form fill error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runFormValidation(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing form validation...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    const forms = await page.$$('form');

    for (const form of forms.slice(0, 2)) {
      try {
        // Test 1: Submit empty form
        const submitBtn = await form.$('button[type="submit"], input[type="submit"], button:not([type])');

        if (submitBtn) {
          await submitBtn.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(500);

          // Check for validation messages
          const hasValidation = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input, textarea');
            for (const input of inputs) {
              if (input.validationMessage || input.validity?.valid === false) {
                return true;
              }
            }
            return document.querySelector('.error, .invalid, [aria-invalid="true"]') !== null;
          });

          if (!hasValidation) {
            // Form submitted without validation
            const pageContent = await page.content();
            if (!pageContent.includes('required') && !pageContent.includes('validation')) {
              bugs.push({
                id: uuidv4(),
                severity: 'medium',
                title: 'Missing form validation',
                category: 'Forms & Interaction',
                testId: 'form_validation',
                description: 'Form can be submitted without filling required fields',
                stepsToReproduce: ['Navigate to ' + url, 'Click submit without filling form'],
                expected: 'Validation errors should appear for required fields',
                actual: 'Form submitted or no validation messages shown',
                url,
                timestamp: new Date().toISOString()
              });
            }
          }
        }

        // Test 2: Invalid email format
        const emailInput = await form.$('input[type="email"]');
        if (emailInput) {
          await emailInput.fill('not-an-email');
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);

          const isInvalid = await emailInput.evaluate(el => !el.validity.valid);
          if (!isInvalid) {
            bugs.push({
              id: uuidv4(),
              severity: 'low',
              title: 'Email validation bypass',
              category: 'Forms & Interaction',
              testId: 'form_validation',
              description: 'Invalid email format accepted without validation error',
              stepsToReproduce: ['Navigate to ' + url, 'Enter invalid email format', 'Tab out of field'],
              expected: 'Email field should show validation error',
              actual: 'Invalid email accepted',
              url,
              timestamp: new Date().toISOString()
            });
          }
        }

        // Reset for next form
        await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
      } catch (e) {
        // Continue with next form
      }
    }

    broadcast({ type: 'log', text: 'Form validation testing complete', color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Validation test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

async function runCmdExecute(page, url, options, broadcast) {
  const bugs = [];

  broadcast({ type: 'log', text: 'Testing button/command execution...', color: '#4ECDC4' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (options.timeout || 30) * 1000 });

    // Find all clickable elements
    const buttons = await page.$$('button, [role="button"], a.btn, .button, input[type="button"]');
    broadcast({ type: 'log', text: `Found ${buttons.length} clickable elements`, color: '#4ECDC4' });

    let unresponsiveCount = 0;

    for (const button of buttons.slice(0, 10)) {
      try {
        const buttonText = await button.textContent();
        const isVisible = await button.isVisible();

        if (!isVisible) continue;

        // Skip navigation links
        const href = await button.getAttribute('href');
        if (href && (href.startsWith('http') || href.startsWith('/'))) continue;

        const beforeContent = await page.content();
        const beforeUrl = page.url();

        // Click the button
        await button.click({ timeout: 2000 });
        await page.waitForTimeout(500);

        const afterContent = await page.content();
        const afterUrl = page.url();

        // Check if anything changed
        const contentChanged = beforeContent !== afterContent;
        const urlChanged = beforeUrl !== afterUrl;

        // Check for network requests (simplified - just check if something happened)
        if (!contentChanged && !urlChanged) {
          unresponsiveCount++;
        }
      } catch (e) {
        // Button might not be clickable or visible
      }
    }

    if (unresponsiveCount > 3) {
      bugs.push({
        id: uuidv4(),
        severity: 'low',
        title: `${unresponsiveCount} unresponsive buttons`,
        category: 'Forms & Interaction',
        testId: 'cmd_execute',
        description: 'Multiple buttons appear to have no effect when clicked',
        stepsToReproduce: ['Navigate to ' + url, 'Click various buttons', 'Observe no response'],
        expected: 'Buttons should have visible effect or feedback',
        actual: `${unresponsiveCount} buttons showed no response`,
        url,
        timestamp: new Date().toISOString()
      });
    }

    broadcast({ type: 'log', text: `Command execution test complete (${unresponsiveCount} unresponsive)`, color: '#4ECDC4' });
  } catch (error) {
    broadcast({ type: 'log', text: `Command test error: ${error.message}`, color: '#FF6B35' });
  }

  return bugs;
}

module.exports = { runFormFill, runFormValidation, runCmdExecute };
