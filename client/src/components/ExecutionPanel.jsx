import { useEffect, useRef } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';

export function ExecutionPanel({ url, progress, currentTest, logs, isComplete }) {
  const logContainerRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] p-6">
      <div className="text-center mb-8">
        {/* Spinner / Checkmark */}
        <div className="mb-6">
          {isComplete ? (
            <CheckCircle size={64} className="text-[#E8FF47] mx-auto" />
          ) : (
            <Loader2 size={64} className="text-[#E8FF47] mx-auto animate-spin" />
          )}
        </div>

        {/* Status Text */}
        <h2 className="text-2xl font-semibold mb-2">
          {isComplete ? 'Generating Report…' : 'Executing Tests…'}
        </h2>

        {/* URL */}
        <p className="text-[#7B8794] font-mono text-sm">{url}</p>
      </div>

      {/* Current Test */}
      {currentTest && !isComplete && (
        <div className="text-center mb-4">
          <span className="text-[#E8FF47]">{currentTest}</span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="w-full max-w-xl mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[#7B8794]">Progress</span>
          <span className="font-mono">{progress}%</span>
        </div>
        <div className="h-3 bg-[#2A2A2A] rounded-full overflow-hidden">
          <div
            className="h-full progress-gradient transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Terminal Log */}
      <div className="w-full max-w-3xl">
        <div className="bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2A2A2A]">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
            <div className="w-3 h-3 rounded-full bg-[#27CA40]" />
            <span className="ml-2 text-xs text-[#7B8794]">playwright test --config=qa-suite.config.ts</span>
          </div>
          <div
            ref={logContainerRef}
            className="p-4 font-mono text-sm h-64 overflow-y-auto"
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
