import { VITALS_THRESHOLDS } from '../utils/constants';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const RATING_COLORS = {
  good: '#4ECDC4',
  'needs-improvement': '#F5A623',
  poor: '#FF2D2D',
  unknown: '#7B8794',
};

const RATING_BORDER = {
  good: 'border-[#4ECDC4]/30',
  'needs-improvement': 'border-[#F5A623]/30',
  poor: 'border-[#FF2D2D]/30',
  unknown: 'border-[#2A2A2A]',
};

const METRICS = [
  { key: 'lcp', label: 'LCP', fullName: 'Largest Contentful Paint' },
  { key: 'fid', label: 'FID', fullName: 'First Input Delay' },
  { key: 'cls', label: 'CLS', fullName: 'Cumulative Layout Shift' },
  { key: 'ttfb', label: 'TTFB', fullName: 'Time to First Byte' },
  { key: 'fcp', label: 'FCP', fullName: 'First Contentful Paint' },
];

/**
 * Radial progress ring using CSS conic-gradient.
 */
function RadialProgress({ value, max, color, size = 48 }) {
  const pct = Math.min((value / max) * 100, 100);
  const strokeSize = 4;

  return (
    <div
      className="rounded-full flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${pct * 3.6}deg, #1E1E1E ${pct * 3.6}deg)`,
      }}
    >
      <div
        className="rounded-full bg-[#141414] flex items-center justify-center"
        style={{
          width: size - strokeSize * 2,
          height: size - strokeSize * 2,
        }}
      >
        <span className="font-mono text-[10px] font-bold" style={{ color }}>
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-white font-medium">{d.fullName}</div>
      <div className="text-[#7B8794] mt-0.5">
        {d.displayValue} — {Math.round(d.pct)}% of threshold
      </div>
    </div>
  );
}

export function VitalsCard({ vitals, previousVitals }) {
  // Build chart data
  const chartData = METRICS.map(({ key, label, fullName }) => {
    const data = vitals[key] || { value: 0, unit: '', rating: 'unknown' };
    const threshold = VITALS_THRESHOLDS[key];
    const numericValue = typeof data.value === 'number' ? data.value : parseFloat(data.value) || 0;
    const pct = threshold ? (numericValue / threshold.good) * 100 : 0;

    return {
      key,
      label,
      fullName,
      value: numericValue,
      displayValue: `${data.value < 1 ? data.value.toFixed(2) : (typeof data.value === 'number' ? data.value.toLocaleString() : data.value)}${data.unit}`,
      pct,
      rating: data.rating,
      color: RATING_COLORS[data.rating] || RATING_COLORS.unknown,
      unit: data.unit,
      thresholdGood: threshold?.good || 0,
    };
  });

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold">Core Web Vitals</h3>
        <span className="text-xs text-[#7B8794]">vs. good thresholds</span>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {chartData.map((m) => {
          const prevData = previousVitals?.[m.key];
          const hasTrend = prevData && typeof prevData.value === 'number';
          // For most metrics, lower is better (except CLS which is also lower-is-better)
          const delta = hasTrend ? m.value - prevData.value : 0;
          const improved = delta < 0;

          return (
            <div
              key={m.key}
              className={`bg-[#0D0D0D] border rounded-lg p-3 flex flex-col items-center gap-2 ${RATING_BORDER[m.rating]}`}
              title={`${m.fullName}: ${m.displayValue}`}
            >
              <RadialProgress
                value={m.value}
                max={m.thresholdGood}
                color={m.color}
              />
              <div className="text-center">
                <div className="text-[10px] text-[#7B8794] uppercase tracking-wider">{m.fullName}</div>
                <div className="font-mono text-lg font-bold mt-0.5" style={{ color: m.color }}>
                  {m.displayValue}
                </div>
                {hasTrend && delta !== 0 && (
                  <div
                    className="text-[10px] font-mono mt-0.5"
                    style={{ color: improved ? '#4ECDC4' : '#FF2D2D' }}
                  >
                    {improved ? '\u25BC' : '\u25B2'} {Math.abs(delta).toFixed(m.key === 'cls' ? 3 : 0)}
                    {m.unit}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bar chart comparing metrics to thresholds */}
      <div className="bg-[#0D0D0D] rounded-lg p-3">
        <div className="text-[10px] text-[#7B8794] uppercase tracking-wider mb-2">
          Metric values relative to good thresholds (100% = threshold)
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={chartData} layout="horizontal" barSize={20}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#7B8794', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
            />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={entry.color} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
