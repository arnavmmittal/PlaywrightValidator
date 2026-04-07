import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle, Bug, Clock, AlertCircle, Circle, Play, Brain, Zap } from 'lucide-react';

export function ExecutionPanel({ url, progress, currentTest, logs, isComplete, testResults, bugsFound, selectedTests, isAiMode, aiState }) {
  const logContainerRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Elapsed timer
  useEffect(() => {
    startTimeRef.current = Date.now();
    setElapsed(0);

    if (isComplete) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isComplete]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // Estimate remaining time
  const completedCount = testResults ? [...testResults.values()].filter(t => t.status === 'complete' || t.status === 'error').length : 0;
  const totalCount = selectedTests?.length || 0;
  const estimatedRemaining = completedCount > 0 && totalCount > 0 && !isComplete
    ? Math.round((elapsed / completedCount) * (totalCount - completedCount))
    : null;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <Loader2 size={14} className="text-[#E8FF47] animate-spin shrink-0" />;
      case 'complete':
        return <CheckCircle size={14} className="text-[#4ECDC4] shrink-0" />;
      case 'error':
        return <AlertCircle size={14} className="text-[#FF2D2D] shrink-0" />;
      default:
        return <Circle size={14} className="text-[#2A2A2A] shrink-0" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {isComplete ? (
            <CheckCircle size={28} className="text-[#E8FF47]" />
          ) : isAiMode ? (
            <Brain size={28} className="text-[#A78BFA] animate-pulse" />
          ) : (
            <Loader2 size={28} className="text-[#E8FF47] animate-spin" />
          )}
          <div>
            <h2 className="text-lg font-semibold">
              {isComplete ? 'Generating Report...' : isAiMode ? 'AI Agent Running...' : 'Executing Tests...'}
            </h2>
            <p className="text-[#7B8794] font-mono text-sm">{url}</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-[#7B8794]">
            <Clock size={14} />
            <span className="font-mono">{formatTime(elapsed)}</span>
          </div>
          {!isAiMode && estimatedRemaining !== null && (
            <div className="text-[#3A3A3A] text-xs font-mono">
              ~{formatTime(estimatedRemaining)} remaining
            </div>
          )}
          {isAiMode && aiState && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[#A78BFA]">
                <Brain size={14} />
                <span className="font-mono text-xs">Turn {aiState.turn || 0}/{aiState.maxTurns || 40}</span>
              </div>
              <div className="flex items-center gap-2 text-[#E8FF47]">
                <Zap size={14} />
                <span className="font-mono text-xs">{aiState.toolCalls || 0} tools</span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Bug size={14} className={bugsFound > 0 ? 'text-[#FF6B35]' : 'text-[#7B8794]'} />
            <span className="font-mono">{bugsFound ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {!isAiMode && (
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#7B8794]">
              {completedCount} / {totalCount} tests
            </span>
            <span className="font-mono">{progress}%</span>
          </div>
          <div className="h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
            <div
              className="h-full progress-gradient transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* AI Agent Status Bar */}
      {isAiMode && aiState && (
        <div className="mb-6 bg-[#A78BFA]/5 border border-[#A78BFA]/20 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-[#4ECDC4]' : 'bg-[#A78BFA] animate-pulse'}`} />
            <span className="text-sm font-medium text-[#A78BFA]">
              {aiState.status === 'launching' ? 'Launching browser...' :
               aiState.status === 'navigating' ? 'Navigating to target...' :
               aiState.status === 'analyzing' ? 'Analyzing application...' :
               aiState.status === 'finishing' ? 'Finalizing results...' :
               aiState.status === 'complete' ? 'Testing complete' :
               aiState.status === 'limit_reached' ? 'Turn limit reached' :
               'AI agent is working...'}
            </span>
          </div>
          {aiState.lastReasoning && !isComplete && (
            <p className="text-xs text-[#7B8794] italic ml-5 truncate">
              {aiState.lastReasoning}
            </p>
          )}
        </div>
      )}

      {/* Split Layout: Test List + Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Left: Test Progress Sidebar / AI Stats */}
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2A2A2A]">
            <span className="text-sm font-medium text-[#7B8794]">
              {isAiMode ? 'AI Agent Stats' : 'Test Progress'}
            </span>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {isAiMode ? (
              <div className="p-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#7B8794]">Status</span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                      isComplete ? 'bg-[#4ECDC4]/10 text-[#4ECDC4]' : 'bg-[#A78BFA]/10 text-[#A78BFA]'
                    }`}>
                      {aiState?.status || 'initializing'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#7B8794]">Reasoning Turns</span>
                    <span className="text-sm font-mono text-white">{aiState?.turn || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#7B8794]">Tool Calls</span>
                    <span className="text-sm font-mono text-[#E8FF47]">{aiState?.toolCalls || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#7B8794]">Bugs Found</span>
                    <span className="text-sm font-mono text-[#FF6B35]">{bugsFound}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#7B8794]">Elapsed</span>
                    <span className="text-sm font-mono text-white">{formatTime(elapsed)}</span>
                  </div>
                </div>
                {/* Cost Tracker */}
                {aiState?.totalCost !== undefined && (
                  <div className="pt-3 border-t border-[#2A2A2A] space-y-2">
                    <span className="text-xs text-[#7B8794] block">Cost</span>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#7B8794]">Total</span>
                      <span className="text-sm font-mono text-[#4ECDC4]">${aiState.totalCost?.toFixed(4) || '0.0000'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#7B8794]">Input tokens</span>
                      <span className="text-xs font-mono text-white">{(aiState.totalInputTokens || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#7B8794]">Output tokens</span>
                      <span className="text-xs font-mono text-white">{(aiState.totalOutputTokens || 0).toLocaleString()}</span>
                    </div>
                    {aiState.model && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[#7B8794]">Model</span>
                        <span className="text-xs font-mono text-[#A78BFA]">{aiState.model}</span>
                      </div>
                    )}
                  </div>
                )}
                {aiState?.lastTool && (
                  <div className="pt-3 border-t border-[#2A2A2A]">
                    <span className="text-xs text-[#7B8794] block mb-1">Last Tool</span>
                    <div className="flex items-center gap-2">
                      <Zap size={12} className="text-[#E8FF47]" />
                      <span className="text-xs font-mono text-[#E8FF47]">{aiState.lastTool}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : selectedTests && selectedTests.length > 0 ? (
              selectedTests.map(testId => {
                const result = testResults?.get(testId);
                const status = result?.status || 'pending';
                const label = result?.label || testId;
                const bugs = result?.bugsFound || 0;

                return (
                  <div
                    key={testId}
                    className={`flex items-center gap-3 px-4 py-2.5 border-b border-[#1A1A1A] text-sm ${
                      status === 'running' ? 'bg-[#E8FF47]/5' : ''
                    }`}
                  >
                    {getStatusIcon(status)}
                    <span className={`flex-1 truncate ${
                      status === 'running' ? 'text-[#E8FF47]' :
                      status === 'complete' ? 'text-white' :
                      status === 'error' ? 'text-[#FF2D2D]' :
                      'text-[#3A3A3A]'
                    }`}>
                      {label}
                    </span>
                    {bugs > 0 && (
                      <span className="text-xs font-mono text-[#FF6B35] bg-[#FF6B35]/10 px-1.5 py-0.5 rounded">
                        {bugs}
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-[#3A3A3A] text-sm text-center">
                Waiting for tests...
              </div>
            )}
          </div>
        </div>

        {/* Right: Terminal Log */}
        <div className="bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2A2A2A]">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
            <div className="w-3 h-3 rounded-full bg-[#27CA40]" />
            <span className="ml-2 text-xs text-[#7B8794]">playwright test --config=qa-suite.config.ts</span>
          </div>
          <div
            ref={logContainerRef}
            className="p-4 font-mono text-sm h-[480px] overflow-y-auto"
          >
            {logs.map((log, idx) => (
              <div key={idx} style={{ color: log.color }} className="leading-relaxed">
                {log.text}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-[#7B8794]">Waiting for test output...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
