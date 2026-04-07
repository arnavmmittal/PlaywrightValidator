/**
 * LeaderboardTable — Data-dense sortable table with category filters and search.
 * Linear-inspired aesthetic: clean, data-dense, not cluttered.
 */

import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Eye } from 'lucide-react';
import { GradeBadge } from './GradeBadge';
import { MetricDot } from './MetricDot';
import { CategoryPill } from './CategoryPill';
import { FaviconCell } from './FaviconCell';

const CATEGORIES = [
  'all', 'search', 'news', 'social', 'dev-tools', 'ai', 'infra', 'e-commerce', 'reference', 'community',
];

function vitalVal(v) { return v?.value ?? v?.median ?? null; }

const METRIC_COLUMNS = [
  { key: 'lcp', label: 'LCP', unit: 'ms', format: (v) => vitalVal(v) != null ? `${Math.round(vitalVal(v))}` : '—' },
  { key: 'fcp', label: 'FCP', unit: 'ms', format: (v) => vitalVal(v) != null ? `${Math.round(vitalVal(v))}` : '—' },
  { key: 'cls', label: 'CLS', unit: '', format: (v) => vitalVal(v) != null ? vitalVal(v).toFixed(3) : '—' },
  { key: 'ttfb', label: 'TTFB', unit: 'ms', format: (v) => vitalVal(v) != null ? `${Math.round(vitalVal(v))}` : '—' },
];

const SORTABLE_COLUMNS = [
  { key: 'overallScore', label: 'Score' },
  { key: 'lcp', label: 'LCP' },
  { key: 'fcp', label: 'FCP' },
  { key: 'cls', label: 'CLS' },
  { key: 'ttfb', label: 'TTFB' },
];

function getVitalValue(entry, key) {
  return entry.vitals?.[key]?.value ?? entry.vitals?.[key]?.median ?? null;
}

export function LeaderboardTable({ entries = [], onSelectEntry }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortKey, setSortKey] = useState('overallScore');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      // Score sorts desc by default, metrics sort asc (lower is better)
      setSortDir(key === 'overallScore' ? 'desc' : 'asc');
    }
  };

  const filtered = useMemo(() => {
    let result = [...entries];

    // Category filter
    if (activeCategory !== 'all') {
      result = result.filter(e => e.category === activeCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => e.domain?.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      let aVal, bVal;
      if (sortKey === 'overallScore') {
        aVal = a.overallScore ?? 0;
        bVal = b.overallScore ?? 0;
      } else {
        aVal = getVitalValue(a, sortKey);
        bVal = getVitalValue(b, sortKey);
        if (aVal == null) aVal = Infinity;
        if (bVal == null) bVal = Infinity;
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [entries, activeCategory, searchQuery, sortKey, sortDir]);

  const SortIcon = ({ column }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 text-[#3A3A3A]" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-[#E8FF47]" />
      : <ArrowDown className="w-3 h-3 text-[#E8FF47]" />;
  };

  return (
    <div className="w-full">
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                activeCategory === cat
                  ? 'bg-[#E8FF47] text-black'
                  : 'bg-[#141414] text-[#666666] border border-[#1A1A1A] hover:border-[#2A2A2A] hover:text-[#A0A0A0]'
              }`}
            >
              {cat === 'all' ? 'All' : cat.replace(/-/g, ' ')}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:ml-auto w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#3A3A3A]" />
          <input
            type="text"
            placeholder="Filter domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141414] border border-[#1A1A1A] rounded-md text-xs text-white placeholder:text-[#3A3A3A] pl-8 pr-3 py-1.5 outline-none focus:border-[#2A2A2A]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-[#1A1A1A] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#1A1A1A] bg-[#0D0D0D]">
                <th className="px-3 py-2.5 text-[10px] font-medium text-[#3A3A3A] uppercase tracking-wider w-12">#</th>
                <th className="px-3 py-2.5 text-[10px] font-medium text-[#3A3A3A] uppercase tracking-wider min-w-[160px]">Site</th>
                <th className="px-3 py-2.5 text-[10px] font-medium text-[#3A3A3A] uppercase tracking-wider hidden md:table-cell">Category</th>
                <th
                  className="px-3 py-2.5 text-[10px] font-medium text-[#3A3A3A] uppercase tracking-wider cursor-pointer select-none hover:text-[#666666] transition-colors"
                  onClick={() => handleSort('overallScore')}
                >
                  <span className="inline-flex items-center gap-1">
                    Score <SortIcon column="overallScore" />
                  </span>
                </th>
                <th className="px-3 py-2.5 text-[10px] font-medium text-[#3A3A3A] uppercase tracking-wider">Grade</th>
                {METRIC_COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className="px-3 py-2.5 text-[10px] font-medium text-[#3A3A3A] uppercase tracking-wider cursor-pointer select-none hover:text-[#666666] transition-colors hidden lg:table-cell"
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label} <SortIcon column={col.key} />
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6 + METRIC_COLUMNS.length} className="text-center text-[#3A3A3A] text-sm py-12">
                    {entries.length === 0 ? 'No sites benchmarked yet.' : 'No results match your filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((entry, i) => (
                  <tr
                    key={entry.id}
                    onClick={() => onSelectEntry?.(entry)}
                    className="border-b border-[#1A1A1A] last:border-b-0 bg-[#0D0D0D] hover:bg-[#141414] cursor-pointer transition-colors group"
                  >
                    {/* Rank */}
                    <td className="px-3 py-3 text-xs font-mono text-[#3A3A3A]">
                      {i + 1}
                    </td>

                    {/* Domain */}
                    <td className="px-3 py-3">
                      <FaviconCell domain={entry.domain} />
                    </td>

                    {/* Category */}
                    <td className="px-3 py-3 hidden md:table-cell">
                      <CategoryPill category={entry.category || 'other'} />
                    </td>

                    {/* Score */}
                    <td className="px-3 py-3">
                      <span className={`font-mono font-bold text-sm ${
                        entry.overallScore >= 90 ? 'text-emerald-400' :
                        entry.overallScore >= 70 ? 'text-lime-400' :
                        entry.overallScore >= 50 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>
                        {entry.overallScore}
                      </span>
                    </td>

                    {/* Grade */}
                    <td className="px-3 py-3">
                      <GradeBadge grade={entry.grade} size="sm" />
                    </td>

                    {/* Vitals */}
                    {METRIC_COLUMNS.map(col => {
                      const vital = entry.vitals?.[col.key];
                      return (
                        <td key={col.key} className="px-3 py-3 hidden lg:table-cell">
                          <div className="inline-flex items-center gap-1.5">
                            <MetricDot rating={vital?.rating} />
                            <span className="font-mono text-xs text-[#A0A0A0]">
                              {col.format(vital)}
                            </span>
                          </div>
                        </td>
                      );
                    })}

                    {/* Action */}
                    <td className="px-3 py-3">
                      <Eye className="w-3.5 h-3.5 text-[#2A2A2A] group-hover:text-[#666666] transition-colors" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 text-[10px] text-[#3A3A3A]">
        <span>{filtered.length} of {entries.length} sites</span>
        <span>Sorted by {SORTABLE_COLUMNS.find(c => c.key === sortKey)?.label || sortKey} ({sortDir === 'desc' ? 'high→low' : 'low→high'})</span>
      </div>
    </div>
  );
}
