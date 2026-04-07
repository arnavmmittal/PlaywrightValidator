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

  // Normalize URL to homepage
  let normalizedUrl;
  let domain;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    domain = parsed.hostname.replace(/^www\./, '');
    normalizedUrl = `https://${domain}/`;
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // Check if already benchmarked recently
  if (store.wasBenchmarkedRecently(domain)) {
    const existing = store.getEntryByDomain(domain);
    return res.json({
      status: 'already_benchmarked',
      message: 'This site was benchmarked within the last 24 hours.',
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

    // Phase 2: Deterministic scoring
    const { overallScore, grade, metricScores } = computeOverallScore(collectionResult.vitals);
    broadcast({ type: 'scoring_complete', overallScore, grade });

    // Phase 3: AI analysis
    let findings = null;
    let aiStats = { turns: 0, toolCalls: 0, model: 'none', cost: 0 };

    if (process.env.ANTHROPIC_API_KEY) {
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
      aiAnalysis: findings?.summary || null,
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
