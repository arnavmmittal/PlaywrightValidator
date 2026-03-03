import { useState } from 'react';
import { Copy, FileDown, Share2, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import { SEVERITY_COLORS, VITALS_THRESHOLDS } from '../utils/constants';
import { BugCard } from './BugCard';
import { VitalsCard } from './VitalsCard';
import { SourceAuditCard } from './SourceAuditCard';

export function ReportPanel({ report, onNewTests }) {
  const [severityFilter, setSeverityFilter] = useState(null);

  if (!report) return null;

  const { url, timestamp, duration_ms, testsRun, summary, vitals, sourceAudit, bugs, sessionId } = report;
  const totalIssues = Object.values(summary).reduce((a, b) => a + b, 0);
  const filteredBugs = severityFilter
    ? bugs.filter(b => b.severity === severityFilter)
    : bugs;

  const copyToClipboard = () => {
    const md = generateMarkdownReport(report);
    navigator.clipboard.writeText(md);
    alert('Report copied to clipboard!');
  };

  const exportPDF = async () => {
    try {
      const response = await fetch(`/api/report/${sessionId}/pdf`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qa-report-${sessionId}.pdf`;
        a.click();
      } else {
        alert('Failed to generate PDF');
      }
    } catch (e) {
      alert('PDF export error: ' + e.message);
    }
  };

  const shareReport = () => {
    // For now, just copy the URL
    const shareUrl = `${window.location.origin}?session=${sessionId}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Share link copied to clipboard!');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">
            Bug Report — <span className="font-mono text-[#E8FF47]">{url}</span>
          </h1>
          <div className="flex gap-4 text-sm text-[#7B8794]">
            <span>{new Date(timestamp).toLocaleString()}</span>
            <span>•</span>
            <span>{totalIssues} issues</span>
            <span>•</span>
            <span>{testsRun} tests</span>
            <span>•</span>
            <span>{(duration_ms / 1000).toFixed(1)}s</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg hover:border-[#E8FF47] transition-colors"
          >
            <Copy size={16} />
            Copy
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg hover:border-[#E8FF47] transition-colors"
          >
            <FileDown size={16} />
            Export PDF
          </button>
          <button
            onClick={shareReport}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg hover:border-[#E8FF47] transition-colors"
          >
            <Share2 size={16} />
            Share
          </button>
        </div>
      </div>

      {/* Severity Summary */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {['critical', 'high', 'medium', 'low', 'info'].map(sev => (
          <button
            key={sev}
            onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)}
            className={`bg-[#141414] border rounded-lg p-4 text-center transition-all ${
              severityFilter === sev ? 'border-[#E8FF47]' : 'border-[#2A2A2A] hover:border-[#3A3A3A]'
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: SEVERITY_COLORS[sev].bg }}
              />
              <span className="text-sm capitalize text-[#7B8794]">{sev}</span>
            </div>
            <div className="text-2xl font-mono font-bold">{summary[sev]}</div>
          </button>
        ))}
      </div>

      {/* Vitals & Source Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <VitalsCard vitals={vitals} />
        <SourceAuditCard audit={sourceAudit} />
      </div>

      {/* Issues List */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">
          Issues {severityFilter && <span className="text-[#7B8794]">({severityFilter})</span>}
        </h2>
        {filteredBugs.length === 0 ? (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-8 text-center text-[#7B8794]">
            {severityFilter ? 'No issues at this severity level' : 'No issues found!'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBugs
              .sort((a, b) => {
                const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
                return order[a.severity] - order[b.severity];
              })
              .map(bug => (
                <BugCard key={bug.id} bug={bug} />
              ))}
          </div>
        )}
      </div>

      {/* Back Button */}
      <div className="text-center">
        <button
          onClick={onNewTests}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg hover:border-[#E8FF47] transition-colors"
        >
          <ArrowLeft size={18} />
          Run New Tests
        </button>
      </div>
    </div>
  );
}

function generateMarkdownReport(report) {
  const { url, timestamp, duration_ms, testsRun, summary, vitals, sourceAudit, bugs } = report;

  let md = `# Playwright QA Suite — Bug Report\n\n`;
  md += `**URL:** ${url}\n`;
  md += `**Date:** ${new Date(timestamp).toLocaleString()}\n`;
  md += `**Duration:** ${(duration_ms / 1000).toFixed(1)}s\n`;
  md += `**Tests Run:** ${testsRun}\n\n`;

  md += `## Summary\n\n`;
  md += `| Severity | Count |\n|----------|-------|\n`;
  Object.entries(summary).forEach(([sev, count]) => {
    md += `| ${sev.charAt(0).toUpperCase() + sev.slice(1)} | ${count} |\n`;
  });
  md += `\n`;

  md += `## Core Web Vitals\n\n`;
  Object.entries(vitals).forEach(([name, data]) => {
    md += `- **${name.toUpperCase()}:** ${data.value}${data.unit} (${data.rating})\n`;
  });
  md += `\n`;

  md += `## Issues\n\n`;
  bugs.forEach(bug => {
    md += `### [${bug.severity.toUpperCase()}] ${bug.title}\n\n`;
    md += `${bug.description}\n\n`;
    md += `**Steps to Reproduce:**\n`;
    bug.stepsToReproduce?.forEach((step, i) => {
      md += `${i + 1}. ${step}\n`;
    });
    md += `\n**Expected:** ${bug.expected}\n`;
    md += `**Actual:** ${bug.actual}\n\n---\n\n`;
  });

  return md;
}
