/**
 * BenchmarkProgress — Replaces hero when a benchmark is running.
 * Three-phase progress: collecting (1/3, 2/3, 3/3) → scoring → AI analyzing.
 * Shows streaming AI reasoning text and live cost ticker.
 */

import { useState, useEffect, useRef } from 'react';
import { Loader2, Check, X, DollarSign, Brain, Gauge } from 'lucide-react';
import { StreamingText } from './StreamingText';

const COLLECTOR_STEPS = [
  'Launching browser',
  'Navigating to site',
  'Measuring Core Web Vitals',
  'Analyzing network requests',
  'Detecting rendering strategy',
  'Auditing images & resources',
  'Checking caching & CDN',
  'Taking screenshot',
];

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
  const [collectorSteps, setCollectorSteps] = useState([]);
  const [aiLines, setAiLines] = useState([]);
  const [phase, setPhase] = useState(1); // 1=collecting, 2=scoring, 3=AI
  const [cost, setCost] = useState(0);

  // Process incoming WebSocket messages
  useEffect(() => {
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];

    switch (latest.type) {
      case 'benchmark_started':
        setPhase(1);
        break;
      case 'collector_status':
        setCollectorSteps(prev => {
          if (prev.includes(latest.message)) return prev;
          return [...prev, latest.message];
        });
        break;
      case 'scoring_complete':
        setPhase(2);
        // Auto-advance to AI phase after brief pause
        setTimeout(() => setPhase(3), 500);
        break;
      case 'ai_thinking':
        setPhase(3);
        setAiLines(prev => [...prev, latest.message]);
        break;
      case 'ai_commentary':
        setAiLines(prev => [...prev, latest.text]);
        break;
      case 'ai_tool_call':
        setAiLines(prev => [...prev, `→ Called ${latest.tool}${latest.input?.grade ? ` (${latest.input.grade}, ${latest.input.score}/100)` : ''}`]);
        break;
      case 'ai_cost_update':
        setCost(latest.totalCost || 0);
        break;
    }
  }, [messages]);

  const matchedSteps = COLLECTOR_STEPS.map(step => {
    const matched = collectorSteps.some(msg => msg.toLowerCase().includes(step.toLowerCase().split(' ')[0]));
    return { label: step, done: matched };
  });

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
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-4 h-4 text-[#E8FF47]" />
            <span className="text-sm text-white font-medium">Collecting performance data...</span>
          </div>
          <div className="space-y-1.5">
            {matchedSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                {step.done ? (
                  <Check className="w-3 h-3 text-[#4ECDC4]" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-[#2A2A2A]" />
                )}
                <span className={`text-xs ${step.done ? 'text-[#A0A0A0]' : 'text-[#3A3A3A]'}`}>
                  {step.label}
                </span>
              </div>
            ))}
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
