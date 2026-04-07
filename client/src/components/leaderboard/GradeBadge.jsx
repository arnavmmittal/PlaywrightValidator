/**
 * GradeBadge — Letter grade in a colored pill.
 * A+ = emerald, A = green, B = yellow, C = orange, D = red, F = crimson
 */

const GRADE_STYLES = {
  'A+': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'A':  { bg: 'bg-green-500/15',   text: 'text-green-400',   border: 'border-green-500/30' },
  'B+': { bg: 'bg-lime-500/15',    text: 'text-lime-400',    border: 'border-lime-500/30' },
  'B':  { bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  border: 'border-yellow-500/30' },
  'C+': { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30' },
  'C':  { bg: 'bg-orange-500/15',  text: 'text-orange-400',  border: 'border-orange-500/30' },
  'D':  { bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/30' },
  'F':  { bg: 'bg-rose-600/15',    text: 'text-rose-400',    border: 'border-rose-600/30' },
};

export function GradeBadge({ grade, size = 'md' }) {
  const style = GRADE_STYLES[grade] || GRADE_STYLES['F'];
  const sizeClass = size === 'lg'
    ? 'text-lg px-3 py-1 font-bold'
    : size === 'sm'
      ? 'text-[10px] px-1.5 py-0.5 font-semibold'
      : 'text-xs px-2 py-0.5 font-semibold';

  return (
    <span className={`inline-flex items-center rounded-md border ${style.bg} ${style.text} ${style.border} ${sizeClass} font-mono tracking-wide`}>
      {grade}
    </span>
  );
}
