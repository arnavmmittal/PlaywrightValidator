/**
 * Leaderboard API Routes
 *
 * All /api/leaderboard/* endpoints.
 * Handles benchmark submission, leaderboard queries, and queue status.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { collectPerformanceData, _extractDomain } = require('../benchmark/collector');
const { computeOverallScore } = require('../utils/perf-scoring');
const { analyzePerformance } = require('../benchmark/analyzer');
const { benchmarkQueue } = require('../benchmark/queue');
const store = require('../benchmark/leaderboard-store');
const { rateLimitMiddleware, getRateLimitStatus } = require('../middleware/rate-limit');
const { detectCategory } = require('../utils/categories');

const router = express.Router();

// ── GET /api/leaderboard ─────────────────────────────────────────────────────
// Public. Returns all entries sorted by score.
router.get('/', (req, res) => {
  const entries = store.getEntries();

  // Add rank
  const ranked = entries.map((entry, i) => ({ ...entry, rank: i + 1 }));

  // Optional category filter
  const { category } = req.query;
  const filtered = category
    ? ranked.filter(e => e.category === category)
    : ranked;

  res.json({
    entries: filtered,
    total: entries.length,
    lastUpdated: entries[0]?.benchmarkedAt || null,
  });
});

// ── GET /api/leaderboard/rate-limit ──────────────────────────────────────────
// Returns rate limit status for the requesting IP.
router.get('/rate-limit', (req, res) => {
  res.json(getRateLimitStatus(req));
});

// ── GET /api/leaderboard/:id ─────────────────────────────────────────────────
// Public. Returns a single entry with full AI analysis.
router.get('/:id', (req, res) => {
  const entry = store.getEntryById(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'Entry not found' });
  }
  res.json(entry);
});

// ── POST /api/leaderboard/benchmark ──────────────────────────────────────────
// Rate-limited. Runs the full pipeline: collector → scorer → analyzer.
// Returns immediately with a jobId; real-time progress via WebSocket.
router.post('/benchmark', rateLimitMiddleware('benchmark'), (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Parse and validate URL (supports full paths + query strings)
  let normalizedUrl;
  let domain;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only HTTP(S) URLs allowed' });
    }
    const hostname = parsed.hostname;
    // Block private/internal IPs and ranges (SSRF protection)
    const blocked = [
      /^localhost$/i, /^127\./, /^10\./, /^0\./, /^::1$/,
      /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^169\.254\./,
      /^fc00:/i, /^fe80:/i, /^fd/i,
    ];
    if (blocked.some((r) => r.test(hostname))) {
      return res.status(400).json({ error: 'Private/internal URLs are not allowed' });
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i.test(hostname)) {
      return res.status(400).json({ error: 'Invalid domain name' });
    }
    domain = hostname.replace(/^www\./, '');
    // Preserve full path + query, just normalize protocol and strip www
    normalizedUrl = `https://${domain}${parsed.pathname}${parsed.search}`;
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // Check if this exact URL was benchmarked recently
  if (store.wasBenchmarkedRecently(normalizedUrl)) {
    const existing = store.getEntryByUrl(normalizedUrl);
    return res.json({
      status: 'already_benchmarked',
      message: 'This URL was benchmarked within the last 24 hours.',
      entry: existing,
    });
  }

  // Get the broadcast function from the parent app (set in index.js)
  const broadcastToSession = req.app.get('broadcastToSession');

  // Enqueue the benchmark job
  const result = benchmarkQueue.enqueue(async (jobId) => {
    const sessionId = jobId; // Use jobId as sessionId for WebSocket
    const broadcast = (msg) => {
      if (broadcastToSession) broadcastToSession(sessionId, msg);
    };

    broadcast({ type: 'benchmark_started', domain, url: normalizedUrl });

    // Phase 1: Deterministic collection
    const collectionResult = await collectPerformanceData(normalizedUrl, broadcast);

    // Check for error pages (403, 404, 500, etc.)
    const isErrorPage = collectionResult.isErrorPage;

    // Phase 2: Deterministic scoring (skip for error pages)
    let overallScore, grade, metricScores;
    if (isErrorPage) {
      overallScore = 0;
      grade = 'F';
      metricScores = {};
      broadcast({ type: 'error_page_detected', httpStatus: collectionResult.httpStatus });
    } else {
      const securityScore = collectionResult.security?.securityScore ?? null;
      ({ overallScore, grade, metricScores } = computeOverallScore(collectionResult.vitals, securityScore));
    }
    broadcast({ type: 'scoring_complete', overallScore, grade });

    // Phase 3: AI analysis (skip for error pages — waste of tokens)
    let findings = null;
    let aiStats = { turns: 0, toolCalls: 0, model: 'none', cost: 0 };

    if (process.env.ANTHROPIC_API_KEY && !isErrorPage) {
      const analysis = await analyzePerformance(collectionResult, {
        model: 'haiku',
        broadcast,
      });
      findings = analysis.findings;
      aiStats = analysis.aiStats;
    }

    // Build leaderboard entry
    const entry = {
      id: uuidv4(),
      url: normalizedUrl,
      domain,
      category: detectCategory(domain),
      vitals: collectionResult.vitals,
      overallScore,
      grade,
      metricScores,
      httpStatus: collectionResult.httpStatus,
      status: isErrorPage ? 'error' : 'ok',
      throttleProfile: collectionResult.throttleProfile,
      security: collectionResult.security,
      aiAnalysis: isErrorPage
        ? `Site returned HTTP ${collectionResult.httpStatus}. Performance data is not meaningful for error pages.`
        : (findings?.summary || null),
      aiFindings: findings,
      aiScore: findings?.overallScore || null,
      benchmarkedAt: new Date().toISOString(),
      source: 'community',
      rendering: collectionResult.rendering,
      resources: collectionResult.resources,
      thirdParty: collectionResult.thirdParty,
      dom: collectionResult.dom,
      caching: collectionResult.caching,
      screenshot: collectionResult.screenshot,
      navTiming: collectionResult.navTiming,
      aiStats,
    };

    // Save to leaderboard
    await store.upsertEntry(entry);

    broadcast({ type: 'benchmark_complete', entry });
    return entry;
  });

  if (!result) {
    // Don't consume rate limit token — queue was full, user didn't get a benchmark
    return res.status(503).json({
      error: 'Queue is full',
      message: 'Too many benchmarks in progress. Please try again in a few minutes.',
      queue: benchmarkQueue.getStatus(),
    });
  }

  // Successfully enqueued — now record the rate limit usage
  if (req.recordRateLimit) req.recordRateLimit();

  res.json({
    status: 'queued',
    jobId: result.jobId,
    position: result.position,
    queue: benchmarkQueue.getStatus(),
    message: `Benchmark queued. Connect to WebSocket /ws/${result.jobId} for real-time progress.`,
  });
});

// ── GET /api/queue/status ────────────────────────────────────────────────────
router.get('/queue/status', (req, res) => {
  res.json(benchmarkQueue.getStatus());
});

module.exports = router;
