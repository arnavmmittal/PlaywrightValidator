#!/usr/bin/env node
/**
 * CLI test for the benchmark pipeline: collector → scorer → analyzer
 *
 * Usage:
 *   node server/scripts/test-pipeline.js [url]
 *   node server/scripts/test-pipeline.js google.com
 *   node server/scripts/test-pipeline.js --collector-only google.com
 *
 * Env: ANTHROPIC_API_KEY must be set for the analyzer phase.
 */

require('dotenv').config();

const { collectPerformanceData } = require('../benchmark/collector');
const { computeOverallScore } = require('../utils/perf-scoring');
const { analyzePerformance } = require('../benchmark/analyzer');

const args = process.argv.slice(2);
const collectorOnly = args.includes('--collector-only');
const url = args.filter(a => !a.startsWith('--'))[0] || 'https://google.com';
const fullUrl = url.startsWith('http') ? url : `https://${url}`;

function log(msg) {
  console.log(`\x1b[36m[pipeline]\x1b[0m ${msg}`);
}

async function run() {
  const startTime = Date.now();

  // Phase 1: Deterministic Collection
  log(`Collecting performance data for ${fullUrl}...`);
  const collectionResult = await collectPerformanceData(fullUrl, (msg) => {
    if (msg.type === 'collector_status') {
      log(`  ${msg.message}`);
    }
  });

  // Phase 2: Deterministic Scoring
  log('Computing score...');
  const { overallScore, grade, metricScores } = computeOverallScore(collectionResult.vitals);

  console.log('\n\x1b[33m═══ Collection Results ═══\x1b[0m');
  console.log(`URL:     ${collectionResult.url}`);
  console.log(`Domain:  ${collectionResult.domain}`);
  console.log(`Score:   ${overallScore}/100 (${grade})`);
  console.log('\nVitals:');
  for (const [name, data] of Object.entries(collectionResult.vitals)) {
    const ms = data.median !== null ? `${data.median}${name === 'cls' ? '' : 'ms'}` : 'N/A';
    const rating = data.rating;
    const color = rating === 'good' ? '\x1b[32m' : rating === 'needs-improvement' ? '\x1b[33m' : '\x1b[31m';
    console.log(`  ${name.toUpperCase().padEnd(5)} ${color}${ms.padEnd(10)} ${rating}\x1b[0m`);
  }

  console.log('\nResources:');
  const r = collectionResult.resources;
  console.log(`  Total: ${(r.totalSize / 1024).toFixed(0)}KB (${r.totalCount} requests)`);
  console.log(`  JS: ${(r.jsSize / 1024).toFixed(0)}KB (${r.jsCount}), CSS: ${(r.cssSize / 1024).toFixed(0)}KB (${r.cssCount})`);
  console.log(`  Images: ${(r.imageSize / 1024).toFixed(0)}KB (${r.imageCount}), Fonts: ${(r.fontSize / 1024).toFixed(0)}KB (${r.fontCount})`);

  console.log('\nRendering:');
  console.log(`  Strategy: ${collectionResult.rendering.strategy}, Framework: ${collectionResult.rendering.framework || 'none'}`);
  console.log(`  Hydration: ${collectionResult.rendering.hydration}`);

  console.log(`\nThird-party domains: ${collectionResult.thirdParty.length}`);
  for (const tp of collectionResult.thirdParty.slice(0, 5)) {
    console.log(`  ${tp.domain}: ${tp.requests} reqs, ${tp.scripts} scripts`);
  }

  console.log(`\nDOM: ${collectionResult.dom.nodeCount} nodes, depth ${collectionResult.dom.maxDepth}, ${collectionResult.dom.iframes} iframes`);
  console.log(`Caching: ${collectionResult.caching.immutableAssets} immutable, ${collectionResult.caching.noCacheAssets} no-cache, CDN: ${collectionResult.caching.cdnDetected || 'none'}`);

  if (collectorOnly) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`\nDone in ${elapsed}s (collector only)`);
    return;
  }

  // Phase 3: AI Analysis
  if (!process.env.ANTHROPIC_API_KEY) {
    log('\nSkipping AI analysis (ANTHROPIC_API_KEY not set). Use --collector-only or set the key.');
    return;
  }

  log('\nRunning AI analysis...');
  const { findings, aiStats } = await analyzePerformance(collectionResult, {
    model: 'haiku',
    broadcast: (msg) => {
      if (msg.type === 'ai_thinking') log(`  ${msg.message}`);
      if (msg.type === 'ai_commentary') log(`  AI: ${msg.text.substring(0, 150)}...`);
      if (msg.type === 'ai_cost_update') log(`  Cost so far: $${msg.totalCost}`);
    },
  });

  if (findings) {
    console.log('\n\x1b[33m═══ AI Analysis ═══\x1b[0m');
    console.log(`AI Score: ${findings.overallScore}/100 (${findings.grade})`);
    console.log(`\nSummary:\n${findings.summary}`);

    console.log('\nKey Findings:');
    for (const f of findings.keyFindings) {
      const color = f.verdict === 'good' ? '\x1b[32m' : f.verdict === 'needs-improvement' ? '\x1b[33m' : '\x1b[31m';
      console.log(`  ${color}[${f.area}] ${f.verdict}\x1b[0m — ${f.explanation.substring(0, 120)}`);
    }

    console.log('\nArchitecture:');
    for (const [key, val] of Object.entries(findings.architectureAnalysis)) {
      console.log(`  ${key}: ${val.substring(0, 120)}`);
    }

    console.log('\nRecommendations:');
    for (const rec of findings.topRecommendations) {
      console.log(`  [${rec.effort}] ${rec.action}`);
    }

    console.log(`\nAI Stats: ${aiStats.turns} turns, ${aiStats.toolCalls} tool calls, $${aiStats.cost}`);
  } else {
    console.log('\n\x1b[31mAI did not produce findings.\x1b[0m');
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`\nTotal pipeline time: ${elapsed}s`);
}

run().catch(err => {
  console.error('\x1b[31mPipeline error:\x1b[0m', err.message);
  process.exit(1);
});
