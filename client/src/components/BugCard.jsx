import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Copy, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { SEVERITY_COLORS } from '../utils/constants';
import { generateBugMarkdown } from '../utils/reportUtils';

const IMPACT_CONFIG = {
  critical: { label: 'Immediate attention required', icon: AlertTriangle, color: '#FF2D2D' },
  high: { label: 'Immediate attention required', icon: AlertTriangle, color: '#FF6B35' },
  medium: { label: 'Should be addressed', icon: AlertCircle, color: '#F5A623' },
  low: { label: 'For consideration', icon: Info, color: '#4ECDC4' },
  info: { label: 'For consideration', icon: Info, color: '#7B8794' },
};

const BORDER_COLORS = {
  critical: '#FF2D2D',
  high: '#FF6B35',
  medium: '#F5A623',
  low: '#4ECDC4',
  info: '#7B8794',
};

export function BugCard({ bug, onCopyToast }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);
  const sevColor = SEVERITY_COLORS[bug.severity] || SEVERITY_COLORS.info;
  const impact = IMPACT_CONFIG[bug.severity] || IMPACT_CONFIG.info;
  const ImpactIcon = impact.icon;

  useEffect(() => {
    if (isExpanded && contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isExpanded]);

  const handleCopyBug = (e) => {
    e.stopPropagation();
    const md = generateBugMarkdown(bug);
    navigator.clipboard.writeText(md);
    onCopyToast?.();
  };

  return (
    <div
      className="bg-[#141414] border border-[#2A2A2A] rounded-lg overflow-hidden"
      style={{ borderLeftWidth: '3px', borderLeftColor: BORDER_COLORS[bug.severity] || '#7B8794' }}
    >
      {/* Collapsed Row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-4 p-4 hover:bg-[#1A1A1A] transition-colors text-left"
      >
        {/* Severity Badge */}
        <span
          className="px-2.5 py-1 rounded text-xs font-semibold uppercase whitespace-nowrap"
          style={{ backgroundColor: sevColor.bg, color: sevColor.text }}
        >
          {bug.severity}
        </span>

        {/* Bug ID */}
        <span className="font-mono text-xs text-[#555] whitespace-nowrap">
          {bug.id?.slice(0, 8) || '---'}
        </span>

        {/* Title */}
        <span className="flex-1 font-medium truncate">{bug.title}</span>

        {/* Impact Indicator */}
        <span
          className="hidden sm:flex items-center gap-1.5 text-xs whitespace-nowrap"
          style={{ color: impact.color }}
        >
          <ImpactIcon size={13} />
          <span className="hidden lg:inline">{impact.label}</span>
        </span>

        {/* Category Tag */}
        <span className="px-2 py-1 bg-[#2A2A2A] rounded text-xs text-[#7B8794] whitespace-nowrap">
          {bug.category}
        </span>

        {/* Copy Button */}
        <button
          onClick={handleCopyBug}
          className="p-1.5 rounded hover:bg-[#2A2A2A] transition-colors text-[#7B8794] hover:text-[#E8FF47]"
          title="Copy bug as markdown"
        >
          <Copy size={14} />
        </button>

        {/* Expand Icon */}
        {isExpanded ? (
          <ChevronDown size={18} className="text-[#7B8794] shrink-0" />
        ) : (
          <ChevronRight size={18} className="text-[#7B8794] shrink-0" />
        )}
      </button>

      {/* Expanded Content with smooth transition */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? `${contentHeight + 40}px` : '0px',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div ref={contentRef} className="px-4 pb-4 border-t border-[#2A2A2A]">
          {/* Description */}
          <p className="mt-4 text-[#9CA3AF] leading-relaxed">{bug.description}</p>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {/* Steps to Reproduce */}
            <div>
              <h4 className="text-xs font-semibold text-[#7B8794] uppercase tracking-wider mb-2">
                Steps to Reproduce
              </h4>
              <div className="bg-[#0D0D0D] rounded-lg p-3 font-mono text-sm space-y-1">
                {bug.stepsToReproduce?.map((step, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-[#555] select-none">{i + 1}.</span>
                    <span className="text-[#D1D5DB]">{step}</span>
                  </div>
                )) || <span className="text-[#7B8794]">No steps provided</span>}
              </div>
            </div>

            {/* Expected / Actual */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-[#4ECDC4] uppercase tracking-wider mb-2">
                  Expected
                </h4>
                <div className="bg-[#0D0D0D] border-l-2 border-[#4ECDC4] rounded-lg p-3 text-sm text-[#D1D5DB]">
                  {bug.expected}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#FF6B35] uppercase tracking-wider mb-2">
                  Actual
                </h4>
                <div className="bg-[#0D0D0D] border-l-2 border-[#FF6B35] rounded-lg p-3 text-sm text-[#D1D5DB]">
                  {bug.actual}
                </div>
              </div>
            </div>
          </div>

          {/* Console Output */}
          {bug.consoleOutput && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-[#7B8794] uppercase tracking-wider mb-2">
                Console Output
              </h4>
              <pre className="bg-[#0D0D0D] rounded-lg p-3 font-mono text-xs text-[#FF6B35] overflow-x-auto">
                {bug.consoleOutput}
              </pre>
            </div>
          )}

          {/* URL + Screenshot row */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#2A2A2A]">
            {bug.url && (
              <a
                href={bug.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[#E8FF47] hover:underline"
              >
                <ExternalLink size={14} />
                {bug.url.length > 60 ? bug.url.slice(0, 60) + '...' : bug.url}
              </a>
            )}
            <span className="flex-1" />
            <span className="font-mono text-xs text-[#555]">
              {bug.testName || bug.category}
            </span>
          </div>

          {/* Screenshot */}
          {bug.screenshot && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-[#7B8794] uppercase tracking-wider mb-2">
                Screenshot
              </h4>
              <img
                src={`/${bug.screenshot}`}
                alt="Bug screenshot"
                className="max-w-full rounded-lg border border-[#2A2A2A]"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
