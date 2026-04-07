/**
 * ScoreArc — Animated circular arc gauge, 0-100, color transitions.
 */

import { useEffect, useState } from 'react';

function getScoreColor(score) {
  if (score >= 90) return '#10B981'; // emerald
  if (score >= 70) return '#84CC16'; // lime
  if (score >= 50) return '#F59E0B'; // amber
  if (score >= 30) return '#EF4444'; // red
  return '#DC2626'; // dark red
}

export function ScoreArc({ score, size = 80, strokeWidth = 6 }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimatedScore(score), 50);
    return () => clearTimeout(timeout);
  }, [score]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1A1A1A"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.3s ease' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-mono font-bold"
          style={{ fontSize: size * 0.28, color }}
        >
          {score}
        </span>
      </div>
    </div>
  );
}
