/**
 * Security Header Scoring
 *
 * Deterministic analysis of HTTP security headers.
 * No AI involved — pure header presence/absence checks.
 *
 * Checks: HTTPS, HSTS, CSP, X-Content-Type-Options,
 *         X-Frame-Options, Referrer-Policy, Permissions-Policy
 */

const SECURITY_CHECKS = [
  {
    key: 'https',
    label: 'HTTPS',
    maxPoints: 15,
    description: 'Site served over HTTPS',
    check: (_headers, finalUrl) => finalUrl?.startsWith('https://'),
  },
  {
    key: 'hsts',
    label: 'HSTS',
    maxPoints: 20,
    description: 'Strict-Transport-Security header present',
    check: (headers) => !!headers['strict-transport-security'],
  },
  {
    key: 'csp',
    label: 'CSP',
    maxPoints: 20,
    description: 'Content-Security-Policy header present',
    check: (headers) => !!headers['content-security-policy'],
  },
  {
    key: 'xcto',
    label: 'X-Content-Type-Options',
    maxPoints: 10,
    description: 'Prevents MIME-type sniffing (nosniff)',
    check: (headers) => headers['x-content-type-options']?.toLowerCase() === 'nosniff',
  },
  {
    key: 'xfo',
    label: 'X-Frame-Options',
    maxPoints: 10,
    description: 'Clickjacking protection',
    check: (headers) => {
      if (headers['x-frame-options']) return true;
      // CSP frame-ancestors also provides clickjacking protection
      const csp = headers['content-security-policy'] || '';
      return csp.includes('frame-ancestors');
    },
  },
  {
    key: 'referrer',
    label: 'Referrer-Policy',
    maxPoints: 15,
    description: 'Controls referrer information leakage',
    check: (headers) => !!headers['referrer-policy'],
  },
  {
    key: 'permissions',
    label: 'Permissions-Policy',
    maxPoints: 10,
    description: 'Controls browser feature access',
    check: (headers) => !!headers['permissions-policy'],
  },
];

/**
 * Compute a deterministic security score from response headers.
 *
 * @param {object} headers - Response headers from the main document
 * @param {string} finalUrl - The final URL after redirects
 * @returns {{ securityScore: number, findings: Array, grade: string }}
 */
function computeSecurityScore(headers = {}, finalUrl = '') {
  let totalPoints = 0;
  const maxTotal = SECURITY_CHECKS.reduce((sum, c) => sum + c.maxPoints, 0);

  const findings = SECURITY_CHECKS.map((check) => {
    const present = check.check(headers, finalUrl);
    const points = present ? check.maxPoints : 0;
    totalPoints += points;

    return {
      key: check.key,
      label: check.label,
      description: check.description,
      present,
      value: check.key === 'https' ? (present ? 'Yes' : 'No') : (headers[check.header] || null),
      points,
      maxPoints: check.maxPoints,
    };
  });

  const securityScore = Math.round((totalPoints / maxTotal) * 100);

  return { securityScore, findings };
}

module.exports = { computeSecurityScore, SECURITY_CHECKS };
