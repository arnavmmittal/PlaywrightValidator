import { useState, useEffect } from 'react';
import { getHealthScoreColor, getGradeLabel } from '../utils/reportUtils';

/**
 * Circular SVG score gauge with animated fill, glow, and grade display.
 * @param {{ score: number, grade: string, size?: number }} props
 */
export function ScoreGauge({ score, grade, size = 200 }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let frame;
    const duration = 1200;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * score));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const color = getHealthScoreColor(score);
  const gradeLabel = getGradeLabel(grade);

  const strokeWidth = size * 0.07;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-lg"
      >
        {/* Glow filter */}
        <defs>
          <filter id="score-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#1E1E1E"
          strokeWidth={strokeWidth}
        />

        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          filter="url(#score-glow)"
          style={{ transition: 'stroke-dashoffset 0.1s ease-out' }}
        />

        {/* Score number */}
        <text
          x={center}
          y={center - size * 0.04}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={size * 0.22}
          fontFamily="'Outfit', sans-serif"
          fontWeight="700"
        >
          {animatedScore}
        </text>

        {/* Grade letter */}
        <text
          x={center}
          y={center + size * 0.16}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={size * 0.11}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="600"
        >
          {grade}
        </text>
      </svg>

      {/* Label below */}
      <span
        className="mt-2 text-sm font-medium"
        style={{ color }}
      >
        {gradeLabel}
      </span>
    </div>
  );
}
