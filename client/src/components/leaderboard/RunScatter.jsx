/**
 * RunScatter — SVG scatter plot showing individual run values for a metric.
 * Renders p50/p95 reference lines and color-coded dots by rating threshold.
 */

const METRIC_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  fcp: { good: 1800, poor: 3000 },
  ttfb: { good: 800, poor: 1800 },
  tbt: { good: 200, poor: 600 },
  cls: { good: 0.1, poor: 0.25 },
};

const DOT_COLORS = {
  good: '#4ECDC4',
  mid: '#FBBF24',
  poor: '#FF2D2D',
};

function rateValue(metric, value) {
  const t = METRIC_THRESHOLDS[metric];
  if (!t) return 'good';
  if (value <= t.good) return 'good';
  if (value >= t.poor) return 'poor';
  return 'mid';
}

export function RunScatter({ metric, values = [], p50, p95, unit = 'ms' }) {
  if (!values.length || values.length < 2) return null;

  const W = 280, H = 80;
  const PAD = { top: 8, right: 12, bottom: 16, left: 36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  // Add 10% padding to y range
  const yMin = Math.max(0, min - range * 0.1);
  const yMax = max + range * 0.1;
  const yRange = yMax - yMin || 1;

  const toX = (i) => PAD.left + (i / (values.length - 1)) * plotW;
  const toY = (v) => PAD.top + plotH - ((v - yMin) / yRange) * plotH;

  const isCls = metric === 'cls';
  const formatVal = (v) => isCls ? v.toFixed(3) : Math.round(v).toLocaleString();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '80px' }}>
      {/* Grid lines */}
      {[0, 0.5, 1].map(frac => {
        const y = PAD.top + plotH * (1 - frac);
        const val = yMin + yRange * frac;
        return (
          <g key={frac}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1A1A1A" strokeWidth="0.5" />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="#3A3A3A" fontSize="7" fontFamily="monospace">
              {formatVal(val)}
            </text>
          </g>
        );
      })}

      {/* P50 reference line */}
      {p50 != null && (
        <g>
          <line
            x1={PAD.left} y1={toY(p50)} x2={W - PAD.right} y2={toY(p50)}
            stroke="#4ECDC4" strokeWidth="0.75" strokeDasharray="3,2" opacity="0.6"
          />
          <text x={W - PAD.right + 2} y={toY(p50) + 3} fill="#4ECDC4" fontSize="6" fontFamily="monospace">p50</text>
        </g>
      )}

      {/* P95 reference line */}
      {p95 != null && (
        <g>
          <line
            x1={PAD.left} y1={toY(p95)} x2={W - PAD.right} y2={toY(p95)}
            stroke="#FF2D2D" strokeWidth="0.75" strokeDasharray="3,2" opacity="0.4"
          />
          <text x={W - PAD.right + 2} y={toY(p95) + 3} fill="#FF2D2D" fontSize="6" fontFamily="monospace">p95</text>
        </g>
      )}

      {/* Data points */}
      {values.map((v, i) => {
        const rating = rateValue(metric, v);
        return (
          <circle
            key={i}
            cx={toX(i)}
            cy={toY(v)}
            r="3"
            fill={DOT_COLORS[rating]}
            opacity="0.85"
          >
            <title>Run {i + 1}: {formatVal(v)}{unit}</title>
          </circle>
        );
      })}

      {/* X axis label */}
      <text x={PAD.left + plotW / 2} y={H - 2} textAnchor="middle" fill="#3A3A3A" fontSize="7" fontFamily="monospace">
        runs (1–{values.length})
      </text>
    </svg>
  );
}
