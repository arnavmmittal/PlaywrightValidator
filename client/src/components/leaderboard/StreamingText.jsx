/**
 * StreamingText — Monospace streaming text component for AI reasoning.
 * Shows text with a blinking cursor at the end.
 */

import { useEffect, useRef } from 'react';

export function StreamingText({ lines = [], isStreaming = false, maxHeight = '200px' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      ref={containerRef}
      className="bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg p-3 overflow-y-auto font-mono text-xs leading-relaxed"
      style={{ maxHeight }}
    >
      {lines.length === 0 && isStreaming && (
        <span className="text-[#3A3A3A]">Analyzing performance data...</span>
      )}
      {lines.map((line, i) => (
        <div key={i} className="text-[#A0A0A0]">
          {line}
        </div>
      ))}
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 bg-[#E8FF47] ml-0.5 animate-pulse" />
      )}
    </div>
  );
}
