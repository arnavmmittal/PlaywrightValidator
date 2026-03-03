import { useState } from 'react';
import { Play, Settings } from 'lucide-react';
import { TEST_CATEGORIES, getTotalTestCount } from '../utils/constants';

export function ConfigPanel({ onStartTests }) {
  const [url, setUrl] = useState('https://copilot.microsoft.com');
  const [selectedTests, setSelectedTests] = useState(new Set());
  const [options, setOptions] = useState({
    headless: true,
    screenshots: true,
    timeout: 30,
  });

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

  const handleRun = () => {
    if (selectedCount === 0 || !url) return;
    onStartTests({
      url,
      tests: Array.from(selectedTests),
      options,
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
          <div className="flex items-end">
            <button
              onClick={handleRun}
              disabled={selectedCount === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                selectedCount > 0
                  ? 'bg-[#E8FF47] text-[#0D0D0D] hover:bg-[#D4EB3F]'
                  : 'bg-[#2A2A2A] text-[#7B8794] cursor-not-allowed'
              }`}
            >
              <Play size={18} />
              Run {selectedCount} Test{selectedCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-[#2A2A2A]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.headless}
              onChange={(e) => setOptions(prev => ({ ...prev, headless: e.target.checked }))}
              className="w-4 h-4 rounded bg-[#1A1A1A] border-[#2A2A2A] text-[#E8FF47] focus:ring-[#E8FF47]"
            />
            <span className="text-sm">Headless mode</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.screenshots}
              onChange={(e) => setOptions(prev => ({ ...prev, screenshots: e.target.checked }))}
              className="w-4 h-4 rounded bg-[#1A1A1A] border-[#2A2A2A] text-[#E8FF47] focus:ring-[#E8FF47]"
            />
            <span className="text-sm">Capture screenshots</span>
          </label>
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
