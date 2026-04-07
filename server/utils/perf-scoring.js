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
 * Three zones:
 *   0 to "good" threshold  → 70-100 (differentiates fast from very fast)
 *   "good" to "poor"       → 30-70  (needs improvement range)
 *   above "poor"           → 0-30   (poor, degrades to 0)
 *
 * This prevents the "everything is 100" problem where all good sites
 * cluster at the top with identical scores. A site with 200ms LCP should
 * visibly outscore one with 2400ms LCP, even though both are "good."
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
    // Linear: 0 → 100, good threshold → 70
    return Math.round(70 + 30 * (1 - value / t.good));
  }

  if (value <= t.poor) {
    // Zone 2: Between "good" and "poor" → score 30-70
    const range = t.poor - t.good;
    const normalized = (value - t.good) / range;
    return Math.round(70 - 40 * normalized);
  }

  // Zone 3: Above "poor" threshold → score 0-30
  // Degrades from 30 towards 0 as value increases past poor
  const overshoot = (value - t.poor) / t.poor;
  return Math.max(0, Math.round(30 - 30 * Math.min(overshoot, 1)));
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
