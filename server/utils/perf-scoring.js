/**
 * Deterministic Performance Scoring
 *
 * Computes an overall score (0-100) and grade from Core Web Vitals + Security.
 * No AI involved — pure math, fully reproducible.
 *
 * Scoring uses linear interpolation between thresholds:
 *   100 = at or below "good" threshold
 *    50 = at "needs-improvement" boundary
 *     0 = at or above "poor" threshold
 *
 * Weights:
 *   LCP:      25%  (largest visual element — most impactful)
 *   FCP:      15%  (first paint)
 *   CLS:      10%  (visual stability)
 *   TTFB:     15%  (server speed)
 *   INP:      10%  (interactivity — always null in synthetic)
 *   TBT:      10%  (thread blocking)
 *   Security: 15%  (HTTP security headers)
 */

const THRESHOLDS = {
  lcp:  { good: 2500, poor: 4000 },
  fcp:  { good: 1800, poor: 3000 },
  cls:  { good: 0.1,  poor: 0.25 },
  ttfb: { good: 800,  poor: 1800 },
  inp:  { good: 200,  poor: 500 },
  tbt:  { good: 200,  poor: 600 },
};

const WEIGHTS = {
  lcp:      0.25,
  fcp:      0.15,
  cls:      0.10,
  ttfb:     0.15,
  inp:      0.10,
  tbt:      0.10,
  security: 0.15,
};

/**
 * Score a single metric value on a 0-100 scale.
 * Lower values are better for all metrics.
 *
 * Three zones:
 *   0 to "good" threshold  → 70-100 (differentiates fast from very fast)
 *   "good" to "poor"       → 30-70  (needs improvement range)
 *   above "poor"           → 0-30   (poor, degrades to 0)
 *
 * @param {string} metricName - lcp, fcp, cls, ttfb, inp, tbt
 * @param {number|null} value - The measured value
 * @returns {number|null} Score 0-100, or null if value is null
 */
function scoreMetric(metricName, value) {
  if (value === null || value === undefined) return null;

  const t = THRESHOLDS[metricName];
  if (!t) return null;

  if (value <= 0) return 100;

  if (value <= t.good) {
    // Zone 1: Below "good" threshold → score 70-100
    return Math.round(70 + 30 * (1 - value / t.good));
  }

  if (value <= t.poor) {
    // Zone 2: Between "good" and "poor" → score 30-70
    const range = t.poor - t.good;
    const normalized = (value - t.good) / range;
    return Math.round(70 - 40 * normalized);
  }

  // Zone 3: Above "poor" threshold → score 0-30
  const overshoot = (value - t.poor) / t.poor;
  return Math.max(0, Math.round(30 - 30 * Math.min(overshoot, 1)));
}

/**
 * Compute overall score from a vitals object + optional security score.
 *
 * @param {object} vitals - { lcp: { median }, fcp: { median }, ... }
 * @param {number|null} securityScore - 0-100 from security-scoring.js
 * @returns {{ overallScore: number, grade: string, metricScores: object }}
 */
function computeOverallScore(vitals, securityScore = null) {
  const metricScores = {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [metric, weight] of Object.entries(WEIGHTS)) {
    if (metric === 'security') {
      // Security score is passed directly as 0-100 (no threshold mapping)
      metricScores.security = {
        value: securityScore,
        score: securityScore,
        weight,
        rating: securityScore >= 70 ? 'good' : securityScore >= 40 ? 'needs-improvement' : 'poor',
      };
      if (securityScore !== null) {
        weightedSum += securityScore * weight;
        totalWeight += weight;
      }
      continue;
    }

    const vitalData = vitals[metric];
    const value = vitalData?.median ?? null;
    const score = scoreMetric(metric, value);

    metricScores[metric] = {
      value,
      score,
      weight,
      rating: vitalData?.rating || 'unknown',
    };

    if (score !== null) {
      weightedSum += score * weight;
      totalWeight += weight;
    }
  }

  // Normalize if some metrics are missing (e.g., INP is always null in synthetic)
  // If less than 40% of weight is covered, cap score — insufficient data
  const coverageRatio = totalWeight / Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  let overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  if (coverageRatio < 0.4) {
    overallScore = Math.min(overallScore, 50);
  }
  const grade = scoreToGrade(overallScore);

  return { overallScore, grade, metricScores };
}

/**
 * Convert a numeric score to a letter grade.
 * @param {number} score - 0-100
 * @returns {string}
 */
function scoreToGrade(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 75) return 'C+';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

module.exports = { scoreMetric, computeOverallScore, scoreToGrade, THRESHOLDS, WEIGHTS };
