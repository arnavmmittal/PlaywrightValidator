import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { HeroSection } from './components/leaderboard/HeroSection';
import { LeaderboardTable } from './components/leaderboard/LeaderboardTable';
import { BenchmarkProgress } from './components/leaderboard/BenchmarkProgress';
import { SiteDetailDrawer } from './components/leaderboard/SiteDetailDrawer';
import { X, CheckCircle, AlertTriangle, Info, Zap, Github } from 'lucide-react';

const API_BASE = '';

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
  // Leaderboard state
  const [entries, setEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Benchmark state
  const [benchmarkJobId, setBenchmarkJobId] = useState(null);
  const [benchmarkDomain, setBenchmarkDomain] = useState(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [rateLimitRemaining, setRateLimitRemaining] = useState(2);

  // Deep link support
  const [deepLinkDomain, setDeepLinkDomain] = useState(null);

  // WebSocket for real-time benchmark progress
  const { messages, report, error, reset } = useWebSocket(benchmarkJobId);
  const handledCompletionRef = useRef(null); // Track which jobId we've already handled

  // Toast system
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, timestamp: Date.now() }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map(toast => {
      const remaining = 3000 - (Date.now() - toast.timestamp);
      if (remaining <= 0) { removeToast(toast.id); return null; }
      return setTimeout(() => removeToast(toast.id), remaining);
    });
    return () => timers.forEach(t => { if (t) clearTimeout(t); });
  }, [toasts, removeToast]);

  // Show WS errors as toasts
  useEffect(() => {
    if (error) addToast(error, 'error');
  }, [error, addToast]);

  // Fetch leaderboard on mount + handle /site/:domain deep links
  useEffect(() => {
    fetchLeaderboard().then(() => {
      // Check if URL is a /site/:domain deep link
      const match = window.location.pathname.match(/^\/site\/(.+)/);
      if (match) {
        const domain = decodeURIComponent(match[1]);
        // Will be resolved after entries load (see next effect)
        setDeepLinkDomain(domain);
      }
    });
    fetchRateLimit();
  }, []);

  // Resolve deep link once entries are available
  useEffect(() => {
    if (deepLinkDomain && entries.length > 0) {
      const entry = entries.find(e => e.domain === deepLinkDomain);
      if (entry) setSelectedEntry(entry);
      setDeepLinkDomain(null);
    }
  }, [deepLinkDomain, entries]);

  // Update browser URL when drawer opens/closes (no page reload)
  useEffect(() => {
    if (selectedEntry) {
      window.history.replaceState(null, '', `/site/${selectedEntry.domain}`);
    } else if (window.location.pathname.startsWith('/site/')) {
      window.history.replaceState(null, '', '/');
    }
  }, [selectedEntry]);

  // When benchmark completes via WebSocket, refresh leaderboard (guard against double-fire)
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.type === 'benchmark_complete' && handledCompletionRef.current !== benchmarkJobId) {
      handledCompletionRef.current = benchmarkJobId;
      setIsBenchmarking(false);
      setBenchmarkJobId(null);
      addToast(`${lastMsg.entry.domain} benchmarked: ${lastMsg.entry.grade} (${lastMsg.entry.overallScore}/100)`, 'success');
      fetchLeaderboard();
      fetchRateLimit();
      setSelectedEntry(lastMsg.entry);
    }
  }, [messages]);

  async function fetchLeaderboard() {
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard`);
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      // Silent fail on initial load
    }
  }

  async function fetchRateLimit() {
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard/rate-limit`);
      if (!res.ok) return;
      const data = await res.json();
      setRateLimitRemaining(data.benchmark?.remaining ?? 2);
    } catch {
      // Default to 2
    }
  }

  async function handleBenchmark(url) {
    if (isBenchmarking) return;

    try {
      reset();
      setIsBenchmarking(true);

      const res = await fetch(`${API_BASE}/api/leaderboard/benchmark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setIsBenchmarking(false);
        if (res.status === 429) {
          addToast(data.message || 'Rate limit exceeded', 'error');
          setRateLimitRemaining(0);
        } else {
          addToast(data.error || 'Benchmark failed', 'error');
        }
        return;
      }

      // Already benchmarked recently
      if (data.status === 'already_benchmarked') {
        setIsBenchmarking(false);
        addToast(data.message, 'info');
        if (data.entry) setSelectedEntry(data.entry);
        return;
      }

      // Queued — connect WebSocket
      setBenchmarkJobId(data.jobId);
      // Extract domain for progress display
      try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        setBenchmarkDomain(parsed.hostname.replace(/^www\./, ''));
      } catch {
        setBenchmarkDomain(url);
      }

      addToast(`Benchmark queued (position ${data.position})`, 'info');
    } catch (e) {
      setIsBenchmarking(false);
      addToast('Network error: ' + e.message, 'error');
    }
  }

  function handleCancelBenchmark() {
    setIsBenchmarking(false);
    setBenchmarkJobId(null);
    setBenchmarkDomain(null);
    reset();
  }

  // Build recent sites for hero ticker from first 6 entries
  const recentSites = entries.slice(0, 6).map(e => ({
    domain: e.domain,
    grade: e.grade,
    score: e.overallScore,
  }));

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0D0D0D]/80 backdrop-blur-md border-b border-[#1A1A1A]">
        <div className="px-6 lg:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="w-5 h-5 text-[#E8FF47]" />
            <span className="font-bold text-base tracking-tight">PerfRank</span>
            <span className="text-[10px] text-[#3A3A3A] bg-[#1A1A1A] px-1.5 py-0.5 rounded font-mono">beta</span>
          </div>
          <div className="flex items-center gap-5">
            <span className="text-xs text-[#3A3A3A] hidden sm:block">{entries.length} sites ranked</span>
            <a
              href="https://github.com/arnavmmittal/PlaywrightValidator"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3A3A3A] hover:text-white transition-colors"
            >
              <Github className="w-4.5 h-4.5" />
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero / Benchmark Progress — full width */}
        {isBenchmarking ? (
          <div className="py-12 px-6">
            <BenchmarkProgress
              domain={benchmarkDomain}
              messages={messages}
              onCancel={handleCancelBenchmark}
            />
          </div>
        ) : (
          <HeroSection
            onBenchmark={handleBenchmark}
            recentSites={recentSites}
            isLoading={isBenchmarking}
            rateLimitRemaining={rateLimitRemaining}
          />
        )}

        {/* Leaderboard — full width with padding */}
        <section className="py-12 px-6 lg:px-12 min-h-[50vh]">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-lg font-semibold text-white">Leaderboard</h2>
            <div className="flex-1 h-px bg-[#1A1A1A]" />
            <span className="text-xs text-[#3A3A3A] font-mono">{entries.length} sites</span>
          </div>
          <LeaderboardTable
            entries={entries}
            onSelectEntry={setSelectedEntry}
          />
        </section>
      </main>

      {/* Site Detail Drawer */}
      {selectedEntry && (
        <SiteDetailDrawer
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => {
          const ToastIcon = TOAST_ICONS[toast.type] || Info;
          const colors = TOAST_COLORS[toast.type] || TOAST_COLORS.info;
          return (
            <div
              key={toast.id}
              className={`${colors.bg} ${colors.text} px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 pointer-events-auto max-w-sm`}
              style={{ animation: 'slide-in-right 0.3s ease-out' }}
            >
              <ToastIcon size={16} className="shrink-0" />
              <span className="text-sm font-medium flex-1">{toast.message}</span>
              <button onClick={() => removeToast(toast.id)} className="opacity-70 hover:opacity-100 shrink-0">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1A1A1A] mt-12">
        <div className="px-6 lg:px-12 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#3A3A3A]">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[#E8FF47]" />
            <span>PerfRank — Deterministic benchmarks + AI analysis</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Playwright collector</span>
            <span className="text-[#1A1A1A]">|</span>
            <span>Claude AI analyst</span>
            <span className="text-[#1A1A1A]">|</span>
            <span>Open source</span>
          </div>
        </div>
      </footer>

      {/* Global animations */}
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default App;
