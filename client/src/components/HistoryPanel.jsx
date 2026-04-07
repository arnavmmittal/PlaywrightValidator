import { useState, useEffect } from 'react';
import { Search, Clock, Bug, ExternalLink, Inbox } from 'lucide-react';
import { SEVERITY_COLORS } from '../utils/constants';

export function HistoryPanel({ onLoadReport }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/reports/history');
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setReports(data.reports || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = reports
    .filter(r => {
      if (!searchQuery) return true;
      return r.url?.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const formatDuration = (ms) => {
    if (!ms) return '--';
    const seconds = ms / 1000;
    return seconds < 60
      ? `${seconds.toFixed(1)}s`
      : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  };

  const getTotalBugs = (summary) => {
    if (!summary) return 0;
    return Object.values(summary).reduce((a, b) => a + b, 0);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-[#7B8794] text-sm">Loading history...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-8 text-center">
          <p className="text-[#FF6B35] mb-3">Failed to load history</p>
          <p className="text-[#7B8794] text-sm mb-4">{error}</p>
          <button
            onClick={fetchHistory}
            className="px-4 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg hover:border-[#E8FF47] transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Search & Sort Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B8794]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by URL..."
            className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg pl-10 pr-4 py-2.5 text-sm font-mono placeholder-[#7B8794] focus:outline-none focus:border-[#E8FF47] transition-colors"
          />
        </div>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="bg-[#141414] border border-[#2A2A2A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#E8FF47] transition-colors"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-12 text-center">
          <Inbox size={48} className="mx-auto mb-4 text-[#2A2A2A]" />
          <p className="text-[#7B8794] mb-1">
            {searchQuery ? 'No reports match your search' : 'No report history yet'}
          </p>
          <p className="text-sm text-[#3A3A3A]">
            {searchQuery ? 'Try a different URL filter' : 'Run your first test suite to see results here'}
          </p>
        </div>
      )}

      {/* Report List */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((report) => {
            const totalBugs = getTotalBugs(report.summary);
            return (
              <button
                key={report.sessionId}
                onClick={() => onLoadReport(report.sessionId)}
                className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg p-4 hover:border-[#3A3A3A] hover:bg-[#1A1A1A] transition-all text-left group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* URL */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm text-[#E8FF47] truncate">
                        {report.url}
                      </span>
                      <ExternalLink
                        size={12}
                        className="text-[#3A3A3A] group-hover:text-[#7B8794] transition-colors shrink-0"
                      />
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#7B8794]">
                      {report.mode === 'ai-agent' && (
                        <span className="text-[#A78BFA] bg-[#A78BFA]/10 px-1.5 py-0.5 rounded font-mono">
                          AI {report.agentMode || 'agent'}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(report.timestamp).toLocaleString()}
                      </span>
                      <span>{formatDuration(report.duration_ms)}</span>
                      <span>{report.mode === 'ai-agent' ? `${report.testsRun ?? 0} turns` : `${report.testsRun ?? '--'} tests`}</span>
                    </div>
                  </div>

                  {/* Severity Dots */}
                  <div className="flex items-center gap-2 shrink-0">
                    {report.summary && ['critical', 'high', 'medium', 'low', 'info'].map(sev => {
                      const count = report.summary[sev] || 0;
                      if (count === 0) return null;
                      return (
                        <div key={sev} className="flex items-center gap-1">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: SEVERITY_COLORS[sev].bg }}
                          />
                          <span className="text-xs font-mono">{count}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-1 ml-2 pl-2 border-l border-[#2A2A2A]">
                      <Bug size={14} className={totalBugs > 0 ? 'text-[#FF6B35]' : 'text-[#4ECDC4]'} />
                      <span className="text-sm font-mono font-semibold">{totalBugs}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
