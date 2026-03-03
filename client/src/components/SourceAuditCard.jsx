export function SourceAuditCard({ audit }) {
  const items = [
    { label: 'Third-party Scripts', value: audit.thirdPartyScripts, warn: audit.thirdPartyScripts > 10 },
    { label: 'Analytics Providers', value: audit.analyticsProviders?.length || 0 },
    { label: 'Inline Event Handlers', value: audit.inlineEventHandlers, warn: audit.inlineEventHandlers > 10 },
    { label: 'Console Errors', value: audit.consoleErrors, warn: audit.consoleErrors > 0 },
    { label: 'Missing Meta Tags', value: audit.missingMetaTags?.length || 0, warn: audit.missingMetaTags?.length > 2 },
    { label: 'Total DOM Nodes', value: audit.totalDomNodes?.toLocaleString() || '0', warn: audit.totalDomNodes > 1500 },
  ];

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Source Audit Summary</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {items.map(({ label, value, warn }) => (
          <div key={label}>
            <div className="text-xs text-[#7B8794] mb-1">{label}</div>
            <div className={`text-xl font-mono font-bold ${warn ? 'text-[#FF6B35]' : 'text-white'}`}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Providers List */}
      {audit.analyticsProviders?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#2A2A2A]">
          <div className="text-xs text-[#7B8794] mb-2">Analytics Providers</div>
          <div className="flex flex-wrap gap-2">
            {audit.analyticsProviders.map((provider, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-[#2A2A2A] rounded text-xs"
              >
                {provider}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing Meta Tags List */}
      {audit.missingMetaTags?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#2A2A2A]">
          <div className="text-xs text-[#7B8794] mb-2">Missing Meta Tags</div>
          <div className="flex flex-wrap gap-2">
            {audit.missingMetaTags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-[#FF6B35]/20 text-[#FF6B35] rounded text-xs"
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
