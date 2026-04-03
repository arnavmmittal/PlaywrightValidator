import { Shield, Code, Globe, AlertTriangle, FileText, Layers } from 'lucide-react';

const METRIC_CONFIG = [
  {
    key: 'thirdPartyScripts',
    label: 'Third-party Scripts',
    icon: Code,
    tooltip: 'Number of external JavaScript files loaded from third-party domains. High counts increase page load time and attack surface.',
    threshold: { good: 5, warn: 10 },
    getValue: (a) => a.thirdPartyScripts,
  },
  {
    key: 'analyticsCount',
    label: 'Analytics Providers',
    icon: Globe,
    tooltip: 'Number of analytics/tracking services detected on the page. Multiple providers add overhead and privacy concerns.',
    threshold: { good: 2, warn: 4 },
    getValue: (a) => a.analyticsProviders?.length || 0,
  },
  {
    key: 'inlineEventHandlers',
    label: 'Inline Handlers',
    icon: AlertTriangle,
    tooltip: 'Number of inline event handlers (onclick, onload, etc.) found in HTML. These bypass CSP and indicate legacy code patterns.',
    threshold: { good: 3, warn: 10 },
    getValue: (a) => a.inlineEventHandlers,
  },
  {
    key: 'consoleErrors',
    label: 'Console Errors',
    icon: AlertTriangle,
    tooltip: 'JavaScript errors captured in the browser console during testing. Any console errors indicate runtime issues.',
    threshold: { good: 0, warn: 3 },
    getValue: (a) => a.consoleErrors,
  },
  {
    key: 'missingMetaTags',
    label: 'Missing Meta Tags',
    icon: FileText,
    tooltip: 'Essential meta tags (description, viewport, og:title, etc.) not found. Missing tags affect SEO and social sharing.',
    threshold: { good: 0, warn: 2 },
    getValue: (a) => a.missingMetaTags?.length || 0,
  },
  {
    key: 'totalDomNodes',
    label: 'Total DOM Nodes',
    icon: Layers,
    tooltip: 'Total number of HTML elements in the DOM. Google recommends under 1,500 nodes for optimal performance.',
    threshold: { good: 800, warn: 1500 },
    getValue: (a) => a.totalDomNodes || 0,
    format: (v) => (typeof v === 'number' ? v.toLocaleString() : v),
  },
];

function getSeverityIndicator(value, threshold) {
  if (value <= threshold.good) return { color: '#4ECDC4', label: 'Good' };
  if (value <= threshold.warn) return { color: '#F5A623', label: 'Warning' };
  return { color: '#FF2D2D', label: 'Critical' };
}

const PROVIDER_COLORS = [
  '#E8FF47', '#4ECDC4', '#FF6B35', '#F5A623', '#FF2D2D',
  '#7B8794', '#A78BFA', '#F472B6', '#34D399', '#60A5FA',
];

export function SourceAuditCard({ audit }) {
  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield size={18} className="text-[#E8FF47]" />
          Source Audit
        </h3>
      </div>

      {/* Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {METRIC_CONFIG.map(({ key, label, icon: Icon, tooltip, threshold, getValue, format }) => {
          const rawValue = getValue(audit);
          const severity = getSeverityIndicator(rawValue, threshold);
          const displayValue = format ? format(rawValue) : rawValue;

          return (
            <div
              key={key}
              className="bg-[#0D0D0D] rounded-lg p-3 border border-[#1E1E1E] hover:border-[#2A2A2A] transition-colors"
              title={tooltip}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon size={13} className="text-[#555]" />
                  <span className="text-[10px] text-[#7B8794] uppercase tracking-wider">{label}</span>
                </div>
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: severity.color }}
                  title={severity.label}
                />
              </div>
              <div className="text-xl font-mono font-bold text-white">
                {displayValue}
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Providers */}
      {audit.analyticsProviders?.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] text-[#7B8794] uppercase tracking-wider mb-2">
            Detected Analytics Providers
          </div>
          <div className="flex flex-wrap gap-2">
            {audit.analyticsProviders.map((provider, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-full text-xs font-medium border"
                style={{
                  color: PROVIDER_COLORS[i % PROVIDER_COLORS.length],
                  borderColor: `${PROVIDER_COLORS[i % PROVIDER_COLORS.length]}40`,
                  backgroundColor: `${PROVIDER_COLORS[i % PROVIDER_COLORS.length]}10`,
                }}
              >
                {provider}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing Meta Tags */}
      {audit.missingMetaTags?.length > 0 && (
        <div>
          <div className="text-[10px] text-[#7B8794] uppercase tracking-wider mb-2">
            Missing Meta Tags
          </div>
          <div className="flex flex-wrap gap-2">
            {audit.missingMetaTags.map((tag, i) => (
              <span
                key={i}
                className="px-2.5 py-1 bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]/20 rounded-full text-xs font-mono"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
