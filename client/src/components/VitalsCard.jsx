import { VITALS_THRESHOLDS } from '../utils/constants';

export function VitalsCard({ vitals }) {
  const getRatingColor = (rating) => {
    switch (rating) {
      case 'good':
        return '#4ECDC4';
      case 'needs-improvement':
        return '#F5A623';
      case 'poor':
        return '#FF2D2D';
      default:
        return '#7B8794';
    }
  };

  const metrics = [
    { key: 'lcp', label: 'LCP', fullName: 'Largest Contentful Paint' },
    { key: 'fid', label: 'FID', fullName: 'First Input Delay' },
    { key: 'cls', label: 'CLS', fullName: 'Cumulative Layout Shift' },
    { key: 'ttfb', label: 'TTFB', fullName: 'Time to First Byte' },
    { key: 'fcp', label: 'FCP', fullName: 'First Contentful Paint' },
  ];

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Core Web Vitals</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {metrics.map(({ key, label, fullName }) => {
          const data = vitals[key] || { value: 0, unit: '', rating: 'unknown' };
          const threshold = VITALS_THRESHOLDS[key] || { label: '' };

          return (
            <div key={key} className="text-center">
              <div className="text-xs text-[#7B8794] mb-1" title={fullName}>
                {label}
              </div>
              <div
                className="text-2xl font-mono font-bold mb-1"
                style={{ color: getRatingColor(data.rating) }}
              >
                {typeof data.value === 'number'
                  ? data.value < 1
                    ? data.value.toFixed(2)
                    : data.value.toLocaleString()
                  : data.value}
                <span className="text-sm">{data.unit}</span>
              </div>
              <div className="text-xs text-[#7B8794]">{threshold.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
