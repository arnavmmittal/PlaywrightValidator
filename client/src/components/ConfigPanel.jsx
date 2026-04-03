import { useState } from 'react';
import { Play, Settings, Eye, Monitor, RotateCcw, Brain, Sparkles } from 'lucide-react';
import { TEST_CATEGORIES, TEST_PRESETS, BROWSER_OPTIONS, getTotalTestCount } from '../utils/constants';

const AI_MODES = [
  { id: 'comprehensive', label: 'Comprehensive', icon: '🔬', desc: 'Full-spectrum testing across all domains' },
  { id: 'security', label: 'Security Audit', icon: '🛡️', desc: 'Focused penetration testing — XSS, SQLi, headers' },
  { id: 'performance', label: 'Performance', icon: '⚡', desc: 'Core Web Vitals, resource analysis, optimization' },
  { id: 'accessibility', label: 'Accessibility', icon: '♿', desc: 'WCAG 2.1 AA compliance audit' },
  { id: 'exploratory', label: 'Exploratory', icon: '🧭', desc: 'Creative edge-case discovery and UX testing' },
];

export function ConfigPanel({ onStartTests, onStartAiTests, aiAvailable }) {
  const [url, setUrl] = useState('https://copilot.microsoft.com');
  const [selectedTests, setSelectedTests] = useState(new Set());
  const [useAiMode, setUseAiMode] = useState(false);
  const [selectedAiMode, setSelectedAiMode] = useState('comprehensive');
  const [options, setOptions] = useState({
    headless: true,
    screenshots: true,
    timeout: 30,
    slowMo: 250,
    browser: 'chromium',
    parallel: false,
    retries: 0,
  });
  const [watchMode, setWatchMode] = useState(false);

  const totalTests = getTotalTestCount();
  const selectedCount = selectedTests.size;

  const toggleTest = (testId) => {
    setSelectedTests(prev => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  const toggleCategory = (category) => {
    const categoryTestIds = category.tests.map(t => t.id);
    const allSelected = categoryTestIds.every(id => selectedTests.has(id));

    setSelectedTests(prev => {
      const next = new Set(prev);
      categoryTestIds.forEach(id => {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  };

  const selectAll = () => {
    if (selectedCount === totalTests) {
      setSelectedTests(new Set());
    } else {
      const allIds = TEST_CATEGORIES.flatMap(cat => cat.tests.map(t => t.id));
      setSelectedTests(new Set(allIds));
    }
  };

  const applyPreset = (preset) => {
    setSelectedTests(new Set(preset.testIds));
  };

  const handleRun = () => {
    if (useAiMode) {
      if (!url) return;
      onStartAiTests({
        url,
        agentMode: selectedAiMode,
        options: {
          ...options,
          headless: !watchMode,
          slowMo: watchMode ? 250 : 0,
        },
      });
      return;
    }
    if (selectedCount === 0 || !url) return;
    onStartTests({
      url,
      tests: Array.from(selectedTests),
      options: {
        ...options,
        headless: !watchMode,
        slowMo: watchMode ? 250 : 0,
      },
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* URL Input Section */}
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-[#7B8794] text-sm mb-2">Target URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3 font-mono text-[#E8FF47] placeholder-[#7B8794] focus:outline-none focus:border-[#E8FF47] transition-colors"
            />
          </div>
          <div className="flex items-end gap-3">
            <button
              onClick={handleRun}
              disabled={useAiMode ? !url : (selectedCount === 0)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                (useAiMode ? url : selectedCount > 0)
                  ? useAiMode
                    ? 'bg-gradient-to-r from-[#A78BFA] to-[#E8FF47] text-[#0D0D0D] hover:opacity-90'
                    : 'bg-[#E8FF47] text-[#0D0D0D] hover:bg-[#D4EB3F]'
                  : 'bg-[#2A2A2A] text-[#7B8794] cursor-not-allowed'
              }`}
            >
              {useAiMode ? <Brain size={18} /> : <Play size={18} />}
              {useAiMode ? 'Launch AI Agent' : `Run ${selectedCount} Test${selectedCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>

        {/* Options Row */}
        <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-[#2A2A2A]">
          {/* Watch Mode */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={watchMode}
              onChange={(e) => setWatchMode(e.target.checked)}
              className="w-4 h-4 rounded bg-[#1A1A1A] border-[#2A2A2A] text-[#E8FF47] focus:ring-[#E8FF47]"
            />
            <Eye size={14} className={watchMode ? 'text-[#E8FF47]' : 'text-[#7B8794]'} />
            <span className={`text-sm ${watchMode ? 'text-[#E8FF47]' : ''}`}>
              Watch Mode
              <span className="text-xs text-[#7B8794] ml-1">(see browser)</span>
            </span>
          </label>

          {/* Screenshots */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.screenshots}
              onChange={(e) => setOptions(prev => ({ ...prev, screenshots: e.target.checked }))}
              className="w-4 h-4 rounded bg-[#1A1A1A] border-[#2A2A2A] text-[#E8FF47] focus:ring-[#E8FF47]"
            />
            <span className="text-sm">Capture screenshots</span>
          </label>

          {/* Parallel */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.parallel}
              onChange={(e) => setOptions(prev => ({ ...prev, parallel: e.target.checked }))}
              className="w-4 h-4 rounded bg-[#1A1A1A] border-[#2A2A2A] text-[#E8FF47] focus:ring-[#E8FF47]"
            />
            <span className="text-sm">Parallel execution</span>
          </label>

          {/* Timeout */}
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-[#7B8794]" />
            <span className="text-sm text-[#7B8794]">Timeout:</span>
            <input
              type="number"
              value={options.timeout}
              onChange={(e) => setOptions(prev => ({ ...prev, timeout: parseInt(e.target.value) || 30 }))}
              className="w-16 bg-[#1A1A1A] border border-[#2A2A2A] rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-[#E8FF47]"
            />
            <span className="text-sm text-[#7B8794]">sec</span>
          </div>

          {/* Browser */}
          <div className="flex items-center gap-2">
            <Monitor size={14} className="text-[#7B8794]" />
            <span className="text-sm text-[#7B8794]">Browser:</span>
            <select
              value={options.browser}
              onChange={(e) => setOptions(prev => ({ ...prev, browser: e.target.value }))}
              className="bg-[#1A1A1A] border border-[#2A2A2A] rounded px-2 py-1 text-sm focus:outline-none focus:border-[#E8FF47]"
            >
              {BROWSER_OPTIONS.map(b => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </div>

          {/* Retries */}
          <div className="flex items-center gap-2">
            <RotateCcw size={14} className="text-[#7B8794]" />
            <span className="text-sm text-[#7B8794]">Retries:</span>
            <select
              value={options.retries}
              onChange={(e) => setOptions(prev => ({ ...prev, retries: parseInt(e.target.value) }))}
              className="bg-[#1A1A1A] border border-[#2A2A2A] rounded px-2 py-1 text-sm focus:outline-none focus:border-[#E8FF47]"
            >
              {[0, 1, 2, 3].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* AI Mode Toggle */}
      {aiAvailable && (
        <div className="bg-gradient-to-r from-[#A78BFA]/10 to-[#E8FF47]/5 border border-[#A78BFA]/30 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Sparkles size={20} className="text-[#A78BFA]" />
              <div>
                <span className="font-semibold text-[#A78BFA]">AI-Powered Testing</span>
                <p className="text-xs text-[#7B8794] mt-0.5">
                  Claude autonomously explores and tests your site using browser tools
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useAiMode}
                onChange={(e) => setUseAiMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#2A2A2A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#7B8794] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#A78BFA] peer-checked:after:bg-white"></div>
            </label>
          </div>

          {useAiMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {AI_MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setSelectedAiMode(mode.id)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    selectedAiMode === mode.id
                      ? 'bg-[#A78BFA]/20 border-[#A78BFA] text-[#A78BFA]'
                      : 'bg-[#141414] border-[#2A2A2A] hover:border-[#A78BFA]/50 hover:bg-[#1A1A1A]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{mode.icon}</span>
                    <span className="font-medium text-sm">{mode.label}</span>
                  </div>
                  <p className="text-xs text-[#7B8794] leading-relaxed">{mode.desc}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Test Presets */}
      <div className="mb-6">
        <span className="text-[#7B8794] text-sm mb-3 block">Quick Presets</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TEST_PRESETS.map(preset => {
            const isActive = preset.testIds.length === selectedCount &&
              preset.testIds.every(id => selectedTests.has(id));

            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`text-left p-4 rounded-lg border transition-all ${
                  isActive
                    ? 'bg-[#E8FF47]/10 border-[#E8FF47] text-[#E8FF47]'
                    : 'bg-[#141414] border-[#2A2A2A] hover:border-[#3A3A3A] hover:bg-[#1A1A1A]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{preset.icon}</span>
                  <span className="font-medium text-sm">{preset.label}</span>
                </div>
                <p className="text-xs text-[#7B8794] leading-relaxed">{preset.description}</p>
                <span className="text-xs font-mono text-[#3A3A3A] mt-2 block">
                  {preset.testIds.length} test{preset.testIds.length !== 1 ? 's' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Select All Bar */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[#7B8794]">
          Test Suite — <span className="text-white">{selectedCount} of {totalTests}</span> selected
        </span>
        <button
          onClick={selectAll}
          className="text-sm text-[#E8FF47] hover:underline"
        >
          {selectedCount === totalTests ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Test Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {TEST_CATEGORIES.map(category => {
          const categorySelected = category.tests.filter(t => selectedTests.has(t.id)).length;
          const categoryTotal = category.tests.length;

          return (
            <div
              key={category.id}
              className="bg-[#141414] border border-[#2A2A2A] rounded-lg overflow-hidden"
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-4 hover:bg-[#1A1A1A] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{category.icon}</span>
                  <span className="font-medium">{category.label}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-sm font-mono ${
                    categorySelected > 0
                      ? 'bg-[#E8FF47] text-[#0D0D0D]'
                      : 'bg-[#2A2A2A] text-[#7B8794]'
                  }`}
                >
                  {categorySelected}/{categoryTotal}
                </span>
              </button>

              {/* Tests */}
              <div className="border-t border-[#2A2A2A]">
                {category.tests.map(test => (
                  <label
                    key={test.id}
                    className="flex items-start gap-3 p-3 hover:bg-[#1A1A1A] cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTests.has(test.id)}
                      onChange={() => toggleTest(test.id)}
                      className="mt-1 w-4 h-4 rounded bg-[#1A1A1A] border-[#2A2A2A] text-[#E8FF47] focus:ring-[#E8FF47]"
                    />
                    <div>
                      <div className="text-sm font-medium">{test.label}</div>
                      <div className="text-xs text-[#7B8794]">{test.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
