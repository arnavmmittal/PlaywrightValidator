/**
 * CategoryPill — Subtle pill badge for site categories.
 */

const CATEGORY_COLORS = {
  'search':      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'news':        'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'social':      'bg-pink-500/10 text-pink-400 border-pink-500/20',
  'video':       'bg-red-500/10 text-red-400 border-red-500/20',
  'dev-tools':   'bg-violet-500/10 text-violet-400 border-violet-500/20',
  'ai':          'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'infra':       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'e-commerce':  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'reference':   'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'community':   'bg-lime-500/10 text-lime-400 border-lime-500/20',
  'other':       'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

export function CategoryPill({ category }) {
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS['other'];
  const label = category.replace(/-/g, ' ');

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${colors}`}>
      {label}
    </span>
  );
}
