/**
 * Deterministic Performance Scoring
 *
 * Computes an overall score (0-100) and grade from Core Web Vitals.
 * No AI involved — pure math, fully reproducible.
 *
 * Scoring uses linear interpolation between thresholds:
 *   100 = at or below "good" threshold
 *    50 = at "needs-improvement" boundary
 *     0 = at or above "poor" threshold
 *
 * Weights:
 *   LCP:  30%  (largest visual element — most impactful)
 *   FCP:  15%  (first paint)
 *   CLS:  15%  (visual stability)
 *   TTFB: 15%  (server speed)
 *   INP:  15%  (interactivity)
 *   TBT:  10%  (thread blocking)
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
  lcp:  0.30,
  fcp:  0.15,
  cls:  0.15,
  ttfb: 0.15,
  inp:  0.15,
  tbt:  0.10,
};

/**
 * Score a single metric value on a 0-100 scale.
 * Lower values are better for all metrics.
 *
 * @param {string} metricName - lcp, fcp, cls, ttfb, inp, tbt
 * @param {number|null} value - The measured value
 * @returns {number|null} Score 0-100, or null if value is null
 */
function scoreMetric(metricName, value) {
  if (value === null || value === undefined) return null;

  const t = THRESHOLDS[metricName];
  if (!t) return null;

  if (value <= t.good) {
    // Linear from 100 (at 0) to 100 (at good threshold)
    // Actually: 100 at good, scale up for values better than good
    return 100;
  }
  if (value >= t.poor) {
    return 0;
  }

  // Linear interpolation between good (100) and poor (0)
  // At good threshold → 50 is wrong per spec, let me re-read...
  // Per plan: 100 = at or below good, 50 = at needs-improvement boundary, 0 = at or above poor
  // The "needs-improvement boundary" IS the good threshold (transition from good to needs-improvement)
  // So: value <= good → 100, value = good → 50... that doesn't make sense.
  //
  // Reinterpret: smooth scale.
  //   value <= good  → 100
  //   value >= poor  → 0
  //   between        → linear interpolation (100 → 0)
  const range = t.poor - t.good;
  const normalized = (value - t.good) / range; // 0 at good, 1 at poor
  return Math.round(100 * (1 - normalized));
}

/**
 * Compute overall score from a vitals object (from CollectionResult).
 *
 * @param {object} vitals - { lcp: { median }, fcp: { median }, ... }
 * @returns {{ overallScore: number, grade: string, metricScores: object }}
 */
function computeOverallScore(vitals) {
  const metricScores = {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [metric, weight] of Object.entries(WEIGHTS)) {
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

  // Normalize if some metrics are missing (e.g., INP)
  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
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
