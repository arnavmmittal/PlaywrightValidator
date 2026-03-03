import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { SEVERITY_COLORS } from '../utils/constants';

export function BugCard({ bug }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sevColor = SEVERITY_COLORS[bug.severity] || SEVERITY_COLORS.info;

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg overflow-hidden">
      {/* Collapsed Row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-4 p-4 hover:bg-[#1A1A1A] transition-colors text-left"
      >
        {/* Severity Badge */}
        <span
          className="px-2 py-1 rounded text-xs font-semibold uppercase whitespace-nowrap"
          style={{ backgroundColor: sevColor.bg, color: sevColor.text }}
        >
          {bug.severity}
        </span>

        {/* Title */}
        <span className="flex-1 font-medium truncate">{bug.title}</span>

        {/* Category Tag */}
        <span className="px-2 py-1 bg-[#2A2A2A] rounded text-xs text-[#7B8794] whitespace-nowrap">
          {bug.category}
        </span>

        {/* Expand Icon */}
        {isExpanded ? (
          <ChevronDown size={18} className="text-[#7B8794]" />
        ) : (
          <ChevronRight size={18} className="text-[#7B8794]" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-[#2A2A2A]">
          {/* Description */}
          <p className="mt-4 text-[#7B8794] leading-relaxed">{bug.description}</p>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {/* Steps to Reproduce */}
            <div>
              <h4 className="text-sm font-semibold text-[#7B8794] mb-2">Steps to Reproduce</h4>
              <div className="bg-[#0D0D0D] rounded p-3 font-mono text-sm">
                {bug.stepsToReproduce?.map((step, i) => (
                  <div key={i} className="mb-1">
                    <span className="text-[#7B8794]">{i + 1}.</span> {step}
                  </div>
                )) || <span className="text-[#7B8794]">No steps provided</span>}
              </div>
            </div>

            {/* Expected / Actual */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-[#4ECDC4] mb-2">Expected</h4>
                <div className="bg-[#0D0D0D] border-l-2 border-[#4ECDC4] rounded p-3 text-sm">
                  {bug.expected}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#FF6B35] mb-2">Actual</h4>
                <div className="bg-[#0D0D0D] border-l-2 border-[#FF6B35] rounded p-3 text-sm">
                  {bug.actual}
                </div>
              </div>
            </div>
          </div>

          {/* Console Output (if available) */}
          {bug.consoleOutput && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-[#7B8794] mb-2">Console Output</h4>
              <pre className="bg-[#0D0D0D] rounded p-3 font-mono text-xs text-[#FF6B35] overflow-x-auto">
                {bug.consoleOutput}
              </pre>
            </div>
          )}

          {/* URL Link */}
          {bug.url && (
            <div className="mt-4 pt-4 border-t border-[#2A2A2A]">
              <a
                href={bug.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[#E8FF47] hover:underline"
              >
                <ExternalLink size={14} />
                {bug.url.length > 60 ? bug.url.slice(0, 60) + '...' : bug.url}
              </a>
            </div>
          )}

          {/* Screenshot (if available) */}
          {bug.screenshot && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-[#7B8794] mb-2">Screenshot</h4>
              <img
                src={`/${bug.screenshot}`}
                alt="Bug screenshot"
                className="max-w-full rounded border border-[#2A2A2A]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
