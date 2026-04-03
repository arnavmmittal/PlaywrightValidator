import { useState, useEffect, useCallback } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { ExecutionPanel } from './components/ExecutionPanel';
import { ReportPanel } from './components/ReportPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

const TABS = [
  { id: 'configure', label: 'Configure' },
  { id: 'execution', label: 'Execution' },
  { id: 'report', label: 'Report' },
  { id: 'history', label: 'History' },
];

const TOAST_ICONS = {
  success: CheckCircle,
  error: AlertTriangle,
  info: Info,
};

const TOAST_COLORS = {
  success: { bg: 'bg-[#4ECDC4]', text: 'text-[#0D0D0D]' },
  error: { bg: 'bg-[#FF2D2D]', text: 'text-white' },
  info: { bg: 'bg-[#E8FF47]', text: 'text-[#0D0D0D]' },
};

function App() {
  const [activeTab, setActiveTab] = useState('configure');
  const [sessionId, setSessionId] = useState(null);
  const [testConfig, setTestConfig] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [reportHistory, setReportHistory] = useState([]);
  const [previousReport, setPreviousReport] = useState(null);

  const [isAiMode, setIsAiMode] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);

  const { progress, currentTest, logs, report, error, bugsFound, testResults, aiState, reset } = useWebSocket(sessionId);

  // Check AI availability on mount
  useEffect(() => {
    fetch('/api/ai/status')
      .then(r => r.json())
      .then(data => setAiAvailable(data.available))
      .catch(() => setAiAvailable(false));
  }, []);

  // Toast system
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, timestamp: Date.now() }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Auto-remove toasts after 3s
  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map(toast => {
      const remaining = 3000 - (Date.now() - toast.timestamp);
      if (remaining <= 0) {
        removeToast(toast.id);
        return null;
      }
      return setTimeout(() => removeToast(toast.id), remaining);
    });

    return () => {
      timers.forEach(t => { if (t) clearTimeout(t); });
    };
  }, [toasts, removeToast]);

  // Auto-transition to report when complete
  useEffect(() => {
    if (report) {
      const timer = setTimeout(() => {
        setActiveTab('report');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [report]);

  // Fetch history for comparison when report arrives
  useEffect(() => {
    if (report?.url) {
      fetchHistoryForComparison(report.url);
    }
  }, [report]);

  const fetchHistoryForComparison = async (url) => {
    try {
      const response = await fetch('/api/reports/history');
      if (!response.ok) return;
      const data = await response.json();
      const history = data.reports || [];
      setReportHistory(history);

      // Find the most recent previous report for the same URL
      const prev = history.find(r =>
        r.url === url && r.sessionId !== sessionId
      );
      setPreviousReport(prev || null);
    } catch {
      // Non-critical, don't bother the user
    }
  };

  // Show WS errors as toasts
  useEffect(() => {
    if (error) {
      addToast(error, 'error');
    }
  }, [error, addToast]);

  const handleStartTests = async (config) => {
    try {
      setTestConfig(config);
      setPreviousReport(null);
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
      setIsAiMode(false);
      setActiveTab('execution');
      addToast('Test suite started', 'success');
    } catch (e) {
      addToast('Error starting tests: ' + e.message, 'error');
    }
  };

  const handleStartAiTests = async (config) => {
    try {
      setTestConfig(config);
      setPreviousReport(null);
      reset();

      const response = await fetch('/api/test/ai-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start AI tests');
      }

      const { sessionId: newSessionId } = await response.json();
      setSessionId(newSessionId);
      setIsAiMode(true);
      setActiveTab('execution');
      addToast(`AI ${config.agentMode} agent launched`, 'success');
    } catch (e) {
      addToast('Error: ' + e.message, 'error');
    }
  };

  const handleNewTests = () => {
    setSessionId(null);
    setTestConfig(null);
    setPreviousReport(null);
    reset();
    setActiveTab('configure');
  };

  const handleLoadReport = async (historicSessionId) => {
    try {
      const response = await fetch(`/api/report/${historicSessionId}`);
      if (!response.ok) throw new Error('Failed to load report');
      const data = await response.json();

      // Find previous report for comparison
      const prev = reportHistory.find(r =>
        r.url === data.report?.url && r.sessionId !== historicSessionId
      );
      setPreviousReport(prev || null);

      // Set the loaded report by resetting websocket state and manually setting
      reset();
      setSessionId(null);
      setTestConfig({ url: data.report?.url, tests: [] });

      // We need to trigger the report view — use a small wrapper
      // The report comes from the API, so we set it via a dedicated state path
      setLoadedReport(data.report);
      setActiveTab('report');
      addToast('Report loaded from history', 'info');
    } catch (e) {
      addToast('Failed to load report: ' + e.message, 'error');
    }
  };

  // Support loading historical reports
  const [loadedReport, setLoadedReport] = useState(null);
  const activeReport = report || loadedReport;

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
                (tab.id === 'report' && !activeReport);

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
          <ConfigPanel
            onStartTests={handleStartTests}
            onStartAiTests={handleStartAiTests}
            aiAvailable={aiAvailable}
          />
        )}
        {activeTab === 'execution' && (
          <ExecutionPanel
            url={testConfig?.url}
            progress={progress}
            currentTest={currentTest}
            logs={logs}
            isComplete={report !== null}
            testResults={testResults}
            bugsFound={bugsFound}
            selectedTests={testConfig?.tests}
            isAiMode={isAiMode}
            aiState={aiState}
          />
        )}
        {activeTab === 'report' && (
          <ReportPanel
            report={activeReport}
            previousReport={previousReport}
            onNewTests={handleNewTests}
            addToast={addToast}
          />
        )}
        {activeTab === 'history' && (
          <HistoryPanel onLoadReport={handleLoadReport} />
        )}
      </main>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => {
          const ToastIcon = TOAST_ICONS[toast.type] || Info;
          const colors = TOAST_COLORS[toast.type] || TOAST_COLORS.info;

          return (
            <div
              key={toast.id}
              className={`${colors.bg} ${colors.text} px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 pointer-events-auto animate-slide-in-right max-w-sm`}
            >
              <ToastIcon size={16} className="shrink-0" />
              <span className="text-sm font-medium flex-1">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="opacity-70 hover:opacity-100 transition-opacity shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
