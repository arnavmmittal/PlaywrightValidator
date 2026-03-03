import { useState, useEffect } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { ExecutionPanel } from './components/ExecutionPanel';
import { ReportPanel } from './components/ReportPanel';
import { useWebSocket } from './hooks/useWebSocket';

const TABS = [
  { id: 'configure', label: 'Configure' },
  { id: 'execution', label: 'Execution' },
  { id: 'report', label: 'Report' },
];

function App() {
  const [activeTab, setActiveTab] = useState('configure');
  const [sessionId, setSessionId] = useState(null);
  const [testConfig, setTestConfig] = useState(null);

  const { progress, currentTest, logs, report, error, reset } = useWebSocket(sessionId);

  // Auto-transition to report when complete
  useEffect(() => {
    if (report) {
      const timer = setTimeout(() => {
        setActiveTab('report');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [report]);

  const handleStartTests = async (config) => {
    try {
      setTestConfig(config);
      reset();

      const response = await fetch('/api/test/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to start tests');
      }

      const { sessionId: newSessionId } = await response.json();
      setSessionId(newSessionId);
      setActiveTab('execution');
    } catch (e) {
      alert('Error starting tests: ' + e.message);
    }
  };

  const handleNewTests = () => {
    setSessionId(null);
    setTestConfig(null);
    reset();
    setActiveTab('configure');
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0D0D0D] border-b border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎭</span>
            <span className="text-xl font-semibold">Playwright QA Suite</span>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              const isDisabled =
                (tab.id === 'execution' && !sessionId) ||
                (tab.id === 'report' && !report);

              return (
                <button
                  key={tab.id}
                  onClick={() => !isDisabled && setActiveTab(tab.id)}
                  disabled={isDisabled}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    isActive
                      ? 'bg-[#E8FF47]/10 text-[#E8FF47] border border-[#E8FF47]'
                      : isDisabled
                      ? 'text-[#3A3A3A] cursor-not-allowed'
                      : 'text-[#7B8794] hover:text-white hover:bg-[#1A1A1A]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {activeTab === 'configure' && (
          <ConfigPanel onStartTests={handleStartTests} />
        )}
        {activeTab === 'execution' && (
          <ExecutionPanel
            url={testConfig?.url}
            progress={progress}
            currentTest={currentTest}
            logs={logs}
            isComplete={report !== null}
          />
        )}
        {activeTab === 'report' && (
          <ReportPanel
            report={report}
            onNewTests={handleNewTests}
          />
        )}
      </main>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-[#FF2D2D] text-white px-4 py-3 rounded-lg shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}

export default App;
