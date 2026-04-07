#!/usr/bin/env node
/**
 * Seed Leaderboard
 *
 * Benchmarks the initial set of sites for the leaderboard.
 * Run once before launch to populate data.
 *
 * Usage:
 *   node server/scripts/seed-leaderboard.js
 *   node server/scripts/seed-leaderboard.js --no-ai       # Skip AI analysis (faster)
 *   node server/scripts/seed-leaderboard.js --sites 5     # Only first N sites
 */

require('dotenv').config();

const { v4: uuidv4 } = require('uuid');
const { collectPerformanceData, _extractDomain } = require('../benchmark/collector');
const { computeOverallScore } = require('../utils/perf-scoring');
const { analyzePerformance } = require('../benchmark/analyzer');
const store = require('../benchmark/leaderboard-store');

// ── Seed Sites ───────────────────────────────────────────────────────────────

const SEED_SITES = [
  { url: 'https://google.com/',              category: 'search' },
  { url: 'https://news.ycombinator.com/',    category: 'community' },
  { url: 'https://github.com/',              category: 'dev-tools' },
  { url: 'https://wikipedia.org/',           category: 'reference' },
  { url: 'https://dev.to/',                    category: 'community' },
  { url: 'https://cnn.com/',                 category: 'news' },
  { url: 'https://stripe.com/',              category: 'infra' },
  { url: 'https://huggingface.co/',           category: 'ai' },
  { url: 'https://docs.anthropic.com/',      category: 'ai' },
  { url: 'https://vercel.com/',              category: 'infra' },
  { url: 'https://linear.app/',              category: 'dev-tools' },
  { url: 'https://shopify.com/',              category: 'e-commerce' },
  { url: 'https://nytimes.com/',             category: 'news' },
  { url: 'https://fly.io/',                  category: 'infra' },
  { url: 'https://x.com/',                   category: 'social' },
];

// ── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const noAI = args.includes('--no-ai');
const sitesIdx = args.indexOf('--sites');
const maxSites = sitesIdx >= 0 ? parseInt(args[sitesIdx + 1], 10) : SEED_SITES.length;
const sites = SEED_SITES.slice(0, maxSites);

function log(msg) {
  console.log(`\x1b[36m[seed]\x1b[0m ${msg}`);
}
function success(msg) {
  console.log(`\x1b[32m[seed]\x1b[0m ${msg}`);
}
function warn(msg) {
  console.log(`\x1b[33m[seed]\x1b[0m ${msg}`);
}
function fail(msg) {
  console.log(`\x1b[31m[seed]\x1b[0m ${msg}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  log(`Seeding leaderboard with ${sites.length} sites...`);
  if (noAI) warn('AI analysis disabled (--no-ai). Entries will have no AI findings.');
  if (!process.env.ANTHROPIC_API_KEY && !noAI) {
    warn('ANTHROPIC_API_KEY not set. AI analysis will be skipped.');
  }

  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  let totalCost = 0;

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    const domain = _extractDomain(site.url);
    const siteStart = Date.now();

    log(`\n[${i + 1}/${sites.length}] Benchmarking ${domain}...`);

    try {
      // Phase 1: Collect
      const collectionResult = await collectPerformanceData(site.url, (msg) => {
        if (msg.type === 'collector_status') {
          log(`  ${msg.message}`);
        }
      });

      // Phase 2: Score (skip for error pages)
      const isErrorPage = collectionResult.isErrorPage;
      let overallScore, grade, metricScores;
      if (isErrorPage) {
        overallScore = 0;
        grade = 'F';
        metricScores = {};
        warn(`  HTTP ${collectionResult.httpStatus} — error page detected`);
      } else {
        const securityScore = collectionResult.security?.securityScore ?? null;
        ({ overallScore, grade, metricScores } = computeOverallScore(collectionResult.vitals, securityScore));
      }

      // Phase 3: AI Analysis (skip for error pages)
      let findings = null;
      let aiStats = { turns: 0, toolCalls: 0, model: 'none', cost: 0 };

      if (!noAI && process.env.ANTHROPIC_API_KEY && !isErrorPage) {
        log('  Running AI analysis...');
        const analysis = await analyzePerformance(collectionResult, { model: 'haiku' });
        findings = analysis.findings;
        aiStats = analysis.aiStats;
        totalCost += aiStats.cost;
      }

      // Build entry
      const entry = {
        id: uuidv4(),
        url: site.url,
        domain,
        category: site.category,
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
        source: 'seed',
        rendering: collectionResult.rendering,
        resources: collectionResult.resources,
        thirdParty: collectionResult.thirdParty,
        dom: collectionResult.dom,
        caching: collectionResult.caching,
        screenshot: collectionResult.screenshot,
        navTiming: collectionResult.navTiming,
        aiStats,
      };

      await store.upsertEntry(entry);

      const elapsed = ((Date.now() - siteStart) / 1000).toFixed(1);
      success(`  ${domain}: ${overallScore}/100 (${grade}) — ${elapsed}s, AI: $${aiStats.cost}`);
      successCount++;

    } catch (err) {
      const elapsed = ((Date.now() - siteStart) / 1000).toFixed(1);
      fail(`  ${domain}: FAILED — ${err.message} (${elapsed}s)`);
      failCount++;
    }
  }

  // Summary
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log('\n' + '═'.repeat(60));
  log(`Seeding complete in ${totalElapsed}s`);
  success(`  Success: ${successCount}/${sites.length}`);
  if (failCount > 0) fail(`  Failed: ${failCount}/${sites.length}`);
  log(`  Total AI cost: $${totalCost.toFixed(4)}`);
  log(`  Leaderboard entries: ${store.getCount()}`);

  // Print leaderboard
  console.log('\n' + '═'.repeat(60));
  log('Leaderboard:');
  const entries = store.getEntries();
  entries.forEach((e, i) => {
    const color = e.grade.startsWith('A') ? '\x1b[32m' :
                  e.grade.startsWith('B') ? '\x1b[33m' :
                  e.grade.startsWith('C') ? '\x1b[33m' : '\x1b[31m';
    console.log(`  ${String(i + 1).padStart(2)}. ${color}${e.grade.padEnd(3)}\x1b[0m ${String(e.overallScore).padStart(3)}/100  ${e.domain}`);
  });
}

seed().catch(err => {
  fail(`Fatal error: ${err.message}`);
  process.exit(1);
});
