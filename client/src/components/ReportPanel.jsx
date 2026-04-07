import { useState, useMemo, useCallback } from 'react';
import {
  Copy, FileDown, Share2, ArrowLeft, Search, SortDesc,
  TrendingUp, TrendingDown, Minus, RotateCcw,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { SEVERITY_COLORS } from '../utils/constants';
import { generateMarkdownReport } from '../utils/reportUtils';
import { BugCard } from './BugCard';
import { VitalsCard } from './VitalsCard';
import { SourceAuditCard } from './SourceAuditCard';
import { ScoreGauge } from './ScoreGauge';
import { ToastContainer, useToasts } from './Toast';

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const SORT_OPTIONS = [
  { value: 'severity', label: 'Severity' },
  { value: 'category', label: 'Category' },
  { value: 'title', label: 'Title' },
];

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs shadow-xl">
      <span className="capitalize">{d.name}</span>: <strong>{d.value}</strong>
    </div>
  );
}

export function ReportPanel({ report, previousReport, onNewTests }) {
  const [severityFilter, setSeverityFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('severity');
  const [toasts, addToast, removeToast] = useToasts();

  if (!report) return null;

  const {
    url, timestamp, duration_ms, testsRun, vitals, sourceAudit,
    bugs = [], sessionId, healthScore, grade,
  } = report;

  // Normalize summary — AI reports may use severityCounts (legacy) or summary
  const summary = report.summary || report.severityCounts || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const totalIssues = Object.values(summary).reduce((a, b) => a + b, 0);

  // --- Derived: filtered + sorted bugs ---
  const filteredBugs = useMemo(() => {
    let result = bugs;

    if (severityFilter) {
      result = result.filter((b) => b.severity === severityFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title?.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q) ||
          b.category?.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'severity') {
        return (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5);
      }
      if (sortBy === 'category') {
        return (a.category || '').localeCompare(b.category || '');
      }
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return 0;
    });

    return result;
  }, [bugs, severityFilter, searchQuery, sortBy]);

  // --- Pie chart data ---
  const pieData = useMemo(() => {
    return Object.entries(summary)
      .filter(([, count]) => count > 0)
      .map(([sev, count]) => ({
        name: sev,
        value: count,
        color: SEVERITY_COLORS[sev]?.bg || '#7B8794',
      }));
  }, [summary]);

  // --- Comparison data ---
  const comparison = useMemo(() => {
    if (!previousReport) return null;

    const prevTotal = Object.values(previousReport.summary).reduce((a, b) => a + b, 0);
    const prevBugIds = new Set(previousReport.bugs.map((b) => b.id));
    const currBugIds = new Set(bugs.map((b) => b.id));

    return {
      scoreDelta: (healthScore ?? 0) - (previousReport.healthScore ?? 0),
      issueDelta: totalIssues - prevTotal,
      newBugs: bugs.filter((b) => !prevBugIds.has(b.id)).length,
      fixedBugs: previousReport.bugs.filter((b) => !currBugIds.has(b.id)).length,
      persistentBugs: bugs.filter((b) => prevBugIds.has(b.id)).length,
    };
  }, [previousReport, bugs, healthScore, totalIssues]);

  // --- Actions ---
  const copyToClipboard = useCallback(() => {
    const md = generateMarkdownReport(report);
    navigator.clipboard.writeText(md);
    addToast('Report copied to clipboard', 'success');
  }, [report, addToast]);

  const exportPDF = useCallback(async () => {
    try {
      const response = await fetch(`/api/report/${sessionId}/pdf`);
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `qa-report-${sessionId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        addToast('PDF downloaded', 'success');
      } else {
        addToast('Failed to generate PDF', 'error');
      }
    } catch (e) {
      addToast('PDF export error: ' + e.message, 'error');
    }
  }, [sessionId, addToast]);

  const shareReport = useCallback(() => {
    const shareUrl = `${window.location.origin}?session=${sessionId}`;
    navigator.clipboard.writeText(shareUrl);
    addToast('Share link copied to clipboard', 'success');
  }, [sessionId, addToast]);

  const handleBugCopy = useCallback(() => {
    addToast('Bug copied to clipboard', 'success');
  }, [addToast]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* ================================================================ */}
      {/* HERO: Health Score + Title                                       */}
      {/* ================================================================ */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-8 mb-6">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          {/* Score Gauge */}
          {healthScore !== undefined && (
            <ScoreGauge score={healthScore} grade={grade || 'N/A'} size={180} />
          )}

          {/* Title + Meta */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-2xl font-semibold mb-1">
              {report.mode === 'ai-agent' ? 'AI Agent Report' : 'QA Report'}
            </h1>
            {report.mode === 'ai-agent' && (
              <span className="inline-block text-xs font-mono px-2 py-0.5 rounded bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20 mb-2">
                {report.agentMode?.toUpperCase()} MODE • {report.stats?.model || 'AI'}
              </span>
            )}
            <div className="font-mono text-[#E8FF47] text-sm mb-3 break-all">{url}</div>
            <div className="flex flex-wrap justify-center lg:justify-start gap-x-4 gap-y-1 text-sm text-[#7B8794]">
              <span>{new Date(timestamp).toLocaleString()}</span>
              <span className="hidden sm:inline">|</span>
              <span>
                {report.mode === 'ai-agent'
                  ? `${report.stats?.aiTurns || 0} AI turns • ${report.stats?.toolCalls || 0} tool calls`
                  : `${testsRun} tests executed`}
              </span>
              <span className="hidden sm:inline">|</span>
              <span>{((duration_ms || 0) / 1000).toFixed(1)}s duration</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {[
              { label: 'Copy Markdown', icon: Copy, action: copyToClipboard },
              { label: 'Export PDF', icon: FileDown, action: exportPDF },
              { label: 'Share', icon: Share2, action: shareReport },
            ].map(({ label, icon: Icon, action }) => (
              <button
                key={label}
                onClick={action}
                className="flex items-center gap-2 px-4 py-2 bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg hover:border-[#E8FF47] hover:text-[#E8FF47] transition-colors text-sm text-[#9CA3AF] whitespace-nowrap"
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* EXECUTIVE SUMMARY BAR                                            */}
      {/* ================================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Issues', value: totalIssues, accent: totalIssues > 0 ? '#FF6B35' : '#4ECDC4' },
          report.mode === 'ai-agent'
            ? { label: 'AI Turns', value: report.stats?.aiTurns || 0, accent: '#A78BFA' }
            : { label: 'Tests Run', value: testsRun, accent: '#E8FF47' },
          { label: 'Duration', value: `${((duration_ms || 0) / 1000).toFixed(1)}s`, accent: '#7B8794' },
          report.mode === 'ai-agent' && report.stats?.totalCost
            ? { label: 'API Cost', value: `$${report.stats.totalCost.toFixed(4)}`, accent: '#4ECDC4', mono: true }
            : { label: 'Session', value: sessionId?.slice(0, 8) || 'N/A', accent: '#7B8794', mono: true },
        ].map(({ label, value, accent, mono }) => (
          <div key={label} className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4">
            <div className="text-[10px] text-[#7B8794] uppercase tracking-wider mb-1">{label}</div>
            <div
              className={`text-2xl font-bold ${mono ? 'font-mono text-base' : ''}`}
              style={{ color: accent }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ================================================================ */}
      {/* SEVERITY DISTRIBUTION (Pie) + FILTER PILLS                       */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Pie chart */}
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-5 flex flex-col items-center justify-center">
          <div className="text-[10px] text-[#7B8794] uppercase tracking-wider mb-3">Severity Distribution</div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-[#7B8794] text-sm py-8">No issues found</div>
          )}
        </div>

        {/* Severity filter pills */}
        <div className="lg:col-span-2 bg-[#141414] border border-[#2A2A2A] rounded-lg p-5">
          <div className="text-[10px] text-[#7B8794] uppercase tracking-wider mb-3">Filter by Severity</div>
          <div className="flex flex-wrap gap-3">
            {['critical', 'high', 'medium', 'low', 'info'].map((sev) => {
              const isActive = severityFilter === sev;
              const sevColor = SEVERITY_COLORS[sev];
              return (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(isActive ? null : sev)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all"
                  style={{
                    backgroundColor: isActive ? `${sevColor.bg}15` : '#0D0D0D',
                    borderColor: isActive ? sevColor.bg : '#2A2A2A',
                  }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: sevColor.bg }}
                  />
                  <span className="text-sm capitalize text-[#D1D5DB]">{sev}</span>
                  <span
                    className="font-mono text-sm font-bold ml-1"
                    style={{ color: isActive ? sevColor.bg : '#9CA3AF' }}
                  >
                    {summary[sev]}
                  </span>
                </button>
              );
            })}
            {severityFilter && (
              <button
                onClick={() => setSeverityFilter(null)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs text-[#7B8794] hover:text-white transition-colors"
              >
                <RotateCcw size={12} />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* COMPARISON (only if previousReport is provided)                   */}
      {/* ================================================================ */}
      {comparison && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-5 mb-6">
          <div className="text-[10px] text-[#7B8794] uppercase tracking-wider mb-4">
            Comparison with Previous Run
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              {
                label: 'Score Delta',
                value: `${comparison.scoreDelta >= 0 ? '+' : ''}${comparison.scoreDelta}`,
                color: comparison.scoreDelta >= 0 ? '#4ECDC4' : '#FF2D2D',
                icon: comparison.scoreDelta > 0 ? TrendingUp : comparison.scoreDelta < 0 ? TrendingDown : Minus,
              },
              {
                label: 'Issue Delta',
                value: `${comparison.issueDelta >= 0 ? '+' : ''}${comparison.issueDelta}`,
                color: comparison.issueDelta <= 0 ? '#4ECDC4' : '#FF2D2D',
                icon: comparison.issueDelta < 0 ? TrendingDown : comparison.issueDelta > 0 ? TrendingUp : Minus,
              },
              { label: 'New Bugs', value: comparison.newBugs, color: comparison.newBugs > 0 ? '#FF6B35' : '#4ECDC4' },
              { label: 'Fixed', value: comparison.fixedBugs, color: comparison.fixedBugs > 0 ? '#4ECDC4' : '#7B8794' },
              { label: 'Persistent', value: comparison.persistentBugs, color: '#F5A623' },
            ].map(({ label, value, color, icon: DeltaIcon }) => (
              <div key={label} className="text-center">
                <div className="text-[10px] text-[#7B8794] uppercase tracking-wider mb-1">{label}</div>
                <div className="flex items-center justify-center gap-1">
                  {DeltaIcon && <DeltaIcon size={14} style={{ color }} />}
                  <span className="text-xl font-mono font-bold" style={{ color }}>
                    {value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* VITALS + SOURCE AUDIT                                            */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <VitalsCard vitals={vitals} previousVitals={previousReport?.vitals} />
        <SourceAuditCard audit={sourceAudit} />
      </div>

      {/* ================================================================ */}
      {/* ISSUES LIST                                                      */}
      {/* ================================================================ */}
      <div className="mb-6">
        {/* Issues header with search and sort */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Issues</h2>
            <span className="text-xs text-[#7B8794] bg-[#1A1A1A] px-2.5 py-1 rounded-full font-mono">
              Showing {filteredBugs.length} of {bugs.length}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search issues..."
                className="w-full sm:w-56 pl-9 pr-3 py-2 bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#E8FF47]/50 transition-colors"
              />
            </div>

            {/* Sort */}
            <div className="relative">
              <SortDesc size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none pl-9 pr-8 py-2 bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg text-sm text-white focus:outline-none focus:border-[#E8FF47]/50 transition-colors cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Bug list */}
        {filteredBugs.length === 0 ? (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-8 text-center text-[#7B8794]">
            {searchQuery
              ? 'No issues match your search'
              : severityFilter
                ? 'No issues at this severity level'
                : 'No issues found — looking good!'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBugs.map((bug) => (
              <BugCard key={bug.id} bug={bug} onCopyToast={handleBugCopy} />
            ))}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* RUN NEW TESTS                                                    */}
      {/* ================================================================ */}
      <div className="text-center pt-4 pb-2">
        <button
          onClick={onNewTests}
          className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-[#E8FF47] text-[#0D0D0D] font-semibold rounded-lg hover:bg-[#d4eb3a] transition-colors"
        >
          <ArrowLeft size={18} />
          Run New Tests
        </button>
      </div>
    </div>
  );
}
