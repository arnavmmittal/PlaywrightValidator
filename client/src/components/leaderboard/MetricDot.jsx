/**
 * MetricDot — Tiny colored circle indicator for good/needs-improvement/poor.
 */

const RATING_COLORS = {
  good: 'bg-[#4ECDC4]',
  'needs-improvement': 'bg-[#F5A623]',
  poor: 'bg-[#FF2D2D]',
};

export function MetricDot({ rating }) {
  const color = RATING_COLORS[rating] || 'bg-[#3A3A3A]';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${color} flex-shrink-0`}
      title={rating}
    />
  );
}
