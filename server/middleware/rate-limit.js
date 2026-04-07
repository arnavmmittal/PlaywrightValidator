/**
 * IP-Based Rate Limiter
 *
 * In-memory rate limiting for benchmark and compare endpoints.
 * Resets on server restart — acceptable for v1.
 *
 * Limits:
 * - 2 benchmarks per IP per 24 hours
 * - 5 comparisons per IP per 24 hours
 */

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const LIMITS = {
  benchmark: 2,
  compare: 5,
};

// Map<string, { benchmark: number[], compare: number[] }>
// Each value is an array of timestamps
const store = new Map();

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of store.entries()) {
    data.benchmark = data.benchmark.filter(t => now - t < WINDOW_MS);
    data.compare = data.compare.filter(t => now - t < WINDOW_MS);
    if (data.benchmark.length === 0 && data.compare.length === 0) {
      store.delete(ip);
    }
  }
}, CLEANUP_INTERVAL_MS);

function _getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';
}

function _getRecord(ip) {
  if (!store.has(ip)) {
    store.set(ip, { benchmark: [], compare: [] });
  }
  return store.get(ip);
}

function _cleanExpired(timestamps) {
  const now = Date.now();
  return timestamps.filter(t => now - t < WINDOW_MS);
}

/**
 * Express middleware factory for rate limiting.
 * @param {'benchmark'|'compare'} type
 */
function rateLimitMiddleware(type) {
  const limit = LIMITS[type];

  return (req, res, next) => {
    const ip = _getIP(req);
    const record = _getRecord(ip);

    // Clean expired entries
    record[type] = _cleanExpired(record[type]);

    if (record[type].length >= limit) {
      const oldestTimestamp = record[type][0];
      const resetMs = WINDOW_MS - (Date.now() - oldestTimestamp);
      const resetHours = Math.ceil(resetMs / (60 * 60 * 1000));

      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `You can run ${limit} ${type}s per day. Next available in ~${resetHours}h.`,
        limit,
        remaining: 0,
        resetInMs: resetMs,
      });
    }

    // Don't record yet — let the route confirm the action succeeded.
    // Attach a helper so the route can call req.recordRateLimit() after success.
    req.recordRateLimit = () => {
      record[type].push(Date.now());
    };

    // Add remaining count to response headers (optimistic — assumes it will be consumed)
    res.set('X-RateLimit-Limit', String(limit));
    res.set('X-RateLimit-Remaining', String(Math.max(0, limit - record[type].length - 1)));

    next();
  };
}

/**
 * Get rate limit status for an IP (for frontend display).
 */
function getRateLimitStatus(req) {
  const ip = _getIP(req);
  const record = _getRecord(ip);
  const now = Date.now();

  const result = {};
  for (const type of ['benchmark', 'compare']) {
    const cleaned = _cleanExpired(record[type]);
    record[type] = cleaned;
    const limit = LIMITS[type];
    const remaining = Math.max(0, limit - cleaned.length);

    let resetInMs = 0;
    if (cleaned.length > 0) {
      resetInMs = WINDOW_MS - (now - cleaned[0]);
    }

    result[type] = { limit, used: cleaned.length, remaining, resetInMs };
  }

  return result;
}

module.exports = { rateLimitMiddleware, getRateLimitStatus };
