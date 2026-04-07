/**
 * SiteDetailDrawer — Bottom drawer overlay showing full site analysis.
 * Shows score gauge, vitals grid, AI analysis, recommendations, screenshot.
 */

import { useEffect, useState } from 'react';
import { X, ExternalLink, Clock, ChevronDown, Zap, Globe, Link2, Check } from 'lucide-react';
import { ScoreArc } from './ScoreArc';
import { GradeBadge } from './GradeBadge';
import { MetricDot } from './MetricDot';
import { CategoryPill } from './CategoryPill';
import { FaviconCell } from './FaviconCell';

const VITALS_META = {
  lcp: { label: 'Largest Contentful Paint', unit: 'ms', description: 'Time until the largest element is rendered' },
  fcp: { label: 'First Contentful Paint', unit: 'ms', description: 'Time until first content is painted' },
  cls: { label: 'Cumulative Layout Shift', unit: '', description: 'Visual stability score (lower is better)' },
  ttfb: { label: 'Time to First Byte', unit: 'ms', description: 'Server response time' },
  inp: { label: 'Interaction to Next Paint', unit: 'ms', description: 'Input responsiveness' },
  tbt: { label: 'Total Blocking Time', unit: 'ms', description: 'Main thread blocking time' },
};

const IMPACT_COLORS = {
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  low: 'text-green-400 bg-green-500/10 border-green-500/20',
};

function formatVitalValue(key, vital) {
  const val = vital?.value ?? vital?.median;
  if (val == null) return '—';
  if (key === 'cls') return val.toFixed(3);
  return `${Math.round(val)}${VITALS_META[key]?.unit || ''}`;
}

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SiteDetailDrawer({ entry, onClose }) {
  // Close on Escape + lock body scroll
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const [copied, setCopied] = useState(false);

  if (!entry) return null;

  const findings = entry.aiFindings;
  const arch = findings?.architectureAnalysis;

  const shareUrl = `${window.location.origin}/site/${entry.domain}`;
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] bg-[#0D0D0D] border-t border-[#2A2A2A] rounded-t-2xl overflow-hidden animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-[#2A2A2A] rounded-full" />
        </div>

        <div className="overflow-y-auto max-h-[calc(85vh-20px)] px-4 md:px-8 pb-8">
          {/* Header */}
          <div className="flex items-start gap-4 md:gap-6 py-4 border-b border-[#1A1A1A]">
            {/* Score */}
            <ScoreArc score={entry.overallScore} size={80} />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <FaviconCell domain={entry.domain} size="lg" />
                <GradeBadge grade={entry.grade} size="lg" />
                <CategoryPill category={entry.category || 'other'} />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#3A3A3A] mt-2">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Benchmarked {timeAgo(entry.benchmarkedAt)}
                </span>
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-[#666666] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Visit site
                </a>
                {entry.source && (
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {entry.source === 'seed' ? 'Seed data' : 'Community'}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopyLink}
                className="p-2 rounded-lg hover:bg-[#141414] text-[#3A3A3A] hover:text-white transition-colors"
                title="Copy share link"
              >
                {copied ? <Check className="w-4 h-4 text-[#4ECDC4]" /> : <Link2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[#141414] text-[#3A3A3A] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Vitals Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 py-6">
            {Object.entries(VITALS_META).map(([key, meta]) => {
              const vital = entry.vitals?.[key];
              return (
                <div key={key} className="bg-[#141414] border border-[#1A1A1A] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#3A3A3A] uppercase tracking-wider font-medium">{key}</span>
                    <MetricDot rating={vital?.rating} />
                  </div>
                  <div className="font-mono text-lg font-bold text-white mb-0.5">
                    {formatVitalValue(key, vital)}
                  </div>
                  <div className="text-[10px] text-[#3A3A3A] leading-tight">{meta.description}</div>
                </div>
              );
            })}
          </div>

          {/* AI Analysis Summary */}
          {entry.aiAnalysis && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white mb-3">AI Analysis</h3>
              <div className="bg-[#141414] border border-[#1A1A1A] rounded-lg p-4 text-sm text-[#A0A0A0] leading-relaxed">
                {entry.aiAnalysis}
              </div>
            </div>
          )}

          {/* Architecture Analysis */}
          {arch && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white mb-3">Architecture</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { label: 'Rendering Strategy', value: arch.renderingStrategy },
                  { label: 'Bundle Efficiency', value: arch.bundleEfficiency },
                  { label: 'CDN & Caching', value: arch.cdnAndCaching },
                  { label: 'Image Optimization', value: arch.imageOptimization },
                  { label: 'Third-Party Impact', value: arch.thirdPartyImpact },
                ].filter(item => item.value).map(item => (
                  <div key={item.label} className="bg-[#141414] border border-[#1A1A1A] rounded-lg p-3">
                    <div className="text-[10px] text-[#3A3A3A] uppercase tracking-wider font-medium mb-1">{item.label}</div>
                    <div className="text-xs text-[#A0A0A0] leading-relaxed">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Findings */}
          {findings?.keyFindings?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white mb-3">Key Findings</h3>
              <div className="space-y-2">
                {findings.keyFindings.map((finding, i) => (
                  <div key={i} className="flex items-start gap-3 bg-[#141414] border border-[#1A1A1A] rounded-lg p-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      IMPACT_COLORS[finding.impact] || IMPACT_COLORS.medium
                    }`}>
                      {finding.impact}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white font-medium mb-0.5">{finding.area}: {finding.verdict}</div>
                      <div className="text-[11px] text-[#666666] leading-relaxed">{finding.explanation}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {findings?.topRecommendations?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white mb-3">Recommendations</h3>
              <div className="space-y-2">
                {findings.topRecommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 bg-[#141414] border border-[#1A1A1A] rounded-lg p-3">
                    <span className="font-mono text-[#E8FF47] text-xs font-bold mt-0.5">{i + 1}</span>
                    <div className="flex-1">
                      <div className="text-xs text-white font-medium mb-0.5">{rec.action}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-[#4ECDC4]">Impact: {rec.impact}</span>
                        <span className="text-[10px] text-[#3A3A3A]">|</span>
                        <span className="text-[10px] text-[#666666]">Effort: {rec.effort}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Screenshot */}
          {entry.screenshot && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white mb-3">Screenshot</h3>
              {entry.screenshot?.blocked ? (
                <div className="bg-[#141414] border border-[#1A1A1A] rounded-lg p-6 flex flex-col items-center gap-2">
                  <Globe className="w-8 h-8 text-[#2A2A2A]" />
                  <span className="text-xs text-[#3A3A3A]">{entry.screenshot.message || 'Site blocked automated browser access'}</span>
                  <span className="text-[10px] text-[#2A2A2A]">Performance data was still collected successfully</span>
                </div>
              ) : (
                <div className="bg-[#141414] border border-[#1A1A1A] rounded-lg overflow-hidden">
                  <img
                    src={typeof entry.screenshot === 'string' && entry.screenshot.startsWith('/')
                      ? entry.screenshot
                      : `data:image/png;base64,${entry.screenshot}`}
                    alt={`Screenshot of ${entry.domain}`}
                    className="w-full max-h-[300px] object-contain object-top"
                  />
                </div>
              )}
            </div>
          )}

          {/* Raw Data Toggle */}
          <details className="mb-6">
            <summary className="text-xs text-[#3A3A3A] hover:text-[#666666] cursor-pointer transition-colors flex items-center gap-1">
              <ChevronDown className="w-3 h-3" />
              Raw collection data
            </summary>
            <pre className="mt-2 bg-[#141414] border border-[#1A1A1A] rounded-lg p-3 text-[10px] text-[#666666] font-mono overflow-x-auto max-h-[300px] overflow-y-auto">
              {JSON.stringify(entry, null, 2)}
            </pre>
          </details>
        </div>
      </div>

      {/* Slide-up animation */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
