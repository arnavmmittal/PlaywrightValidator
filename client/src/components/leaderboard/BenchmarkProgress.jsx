/**
 * BenchmarkProgress — Replaces hero when a benchmark is running.
 * Three-phase progress: collecting (1/3, 2/3, 3/3) → scoring → AI analyzing.
 * Shows streaming AI reasoning text and live cost ticker.
 */

import { useState, useEffect } from 'react';
import { Loader2, Check, X, DollarSign, Brain, Gauge } from 'lucide-react';
import { StreamingText } from './StreamingText';

// These match the actual messages broadcast by the collector
const COLLECTOR_PHASES = {
  starting: 'Launching browser...',
  collecting: null, // Dynamic: "Collecting metrics (run X/3)..."
  complete: 'Data collection complete',
};

function PhaseIndicator({ phase, currentPhase }) {
  const isComplete = currentPhase > phase;
  const isActive = currentPhase === phase;

  return (
    <div className="flex items-center gap-2">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono border transition-all ${
        isComplete
          ? 'bg-[#4ECDC4]/20 border-[#4ECDC4]/40 text-[#4ECDC4]'
          : isActive
            ? 'bg-[#E8FF47]/20 border-[#E8FF47]/40 text-[#E8FF47] animate-pulse'
            : 'bg-[#141414] border-[#2A2A2A] text-[#3A3A3A]'
      }`}>
        {isComplete ? <Check className="w-3 h-3" /> : phase}
      </div>
      <div className={`h-px flex-1 transition-colors ${
        isComplete ? 'bg-[#4ECDC4]/30' : 'bg-[#1A1A1A]'
      }`} />
    </div>
  );
}

export function BenchmarkProgress({ domain, messages = [], onCancel }) {
  const [collectorMessages, setCollectorMessages] = useState([]);
  const [currentRun, setCurrentRun] = useState(0);
  const [totalRuns, setTotalRuns] = useState(3);
  const [aiLines, setAiLines] = useState([]);
  const [phase, setPhase] = useState(1); // 1=collecting, 2=scoring, 3=AI
  const [cost, setCost] = useState(0);

  // Process ALL incoming WebSocket messages (not just latest)
  useEffect(() => {
    for (const msg of messages) {
      switch (msg.type) {
        case 'benchmark_started':
          setPhase(1);
          break;
        case 'collector_status':
          setCollectorMessages(prev => {
            if (prev.some(m => m === msg.message)) return prev;
            return [...prev, msg.message];
          });
          if (msg.run) {
            setCurrentRun(msg.run);
            setTotalRuns(msg.totalRuns || 3);
          }
          if (msg.phase === 'complete') setPhase(2);
          break;
        case 'scoring_complete':
          setPhase(2);
          setTimeout(() => setPhase(3), 500);
          break;
        case 'ai_thinking':
          setPhase(3);
          setAiLines(prev => {
            if (prev.includes(msg.message)) return prev;
            return [...prev, msg.message];
          });
          break;
        case 'ai_commentary':
          setAiLines(prev => [...prev, msg.text]);
          break;
        case 'ai_tool_call':
          setAiLines(prev => [...prev, `→ Called ${msg.tool}${msg.input?.grade ? ` (${msg.input.grade}, ${msg.input.score}/100)` : ''}`]);
          break;
        case 'ai_cost_update':
          setCost(msg.totalCost || 0);
          break;
      }
    }
  }, [messages.length]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-semibold text-lg">
            Benchmarking <span className="text-[#E8FF47]">{domain}</span>
          </h2>
          <p className="text-xs text-[#3A3A3A] mt-0.5">This takes about 30-45 seconds</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Cost ticker */}
          <div className="flex items-center gap-1 bg-[#141414] border border-[#1A1A1A] rounded-md px-2.5 py-1">
            <DollarSign className="w-3 h-3 text-[#4ECDC4]" />
            <span className="font-mono text-xs text-[#4ECDC4]">{cost.toFixed(4)}</span>
          </div>
          {/* Cancel */}
          <button
            onClick={onCancel}
            className="flex items-center gap-1 text-xs text-[#3A3A3A] hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      </div>

      {/* Phase Progress Bar */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <PhaseIndicator phase={1} currentPhase={phase} />
        <PhaseIndicator phase={2} currentPhase={phase} />
        <PhaseIndicator phase={3} currentPhase={phase} />
      </div>
      <div className="flex justify-between text-[10px] text-[#3A3A3A] mb-6 -mt-4 px-1">
        <span>Collect</span>
        <span>Score</span>
        <span>AI Analysis</span>
      </div>

      {/* Phase 1: Collector Progress */}
      {phase === 1 && (
        <div className="bg-[#141414] border border-[#1A1A1A] rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-[#E8FF47]" />
              <span className="text-sm text-white font-medium">Collecting performance data...</span>
            </div>
            {currentRun > 0 && (
              <span className="text-xs font-mono text-[#E8FF47]">
                Run {currentRun}/{totalRuns}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-[#1A1A1A] rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-[#E8FF47] rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.max(5, (currentRun / totalRuns) * 100)}%` }}
            />
          </div>

          {/* Status messages */}
          <div className="space-y-1">
            {collectorMessages.map((msg, i) => (
              <div key={i} className="flex items-center gap-2">
                <Check className="w-3 h-3 text-[#4ECDC4] flex-shrink-0" />
                <span className="text-xs text-[#A0A0A0]">{msg}</span>
              </div>
            ))}
            {collectorMessages.length === 0 && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 text-[#E8FF47] animate-spin" />
                <span className="text-xs text-[#3A3A3A]">Starting browser...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phase 2: Scoring (brief) */}
      {phase === 2 && (
        <div className="bg-[#141414] border border-[#1A1A1A] rounded-lg p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[#E8FF47] animate-spin" />
          <span className="text-sm text-white">Computing deterministic score...</span>
        </div>
      )}

      {/* Phase 3: AI Analysis */}
      {phase === 3 && (
        <div className="bg-[#141414] border border-[#1A1A1A] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-[#A78BFA]" />
            <span className="text-sm text-white font-medium">AI is analyzing...</span>
            <span className="text-[10px] text-[#3A3A3A] font-mono ml-auto">Haiku 4.5</span>
          </div>
          <StreamingText lines={aiLines} isStreaming={true} maxHeight="160px" />
        </div>
      )}
    </div>
  );
}
