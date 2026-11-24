/**
 * Doorstep flag banner: a small swallowtail pennant on a coral-to-amber pole. The gradient is only ever the pole
 * (a line, never a fill), per the brand guidelines. The flag itself comes from the database (event_flag()):
 * "New" for nights listed in the last week, "Selling fast" past 60% sold, "Last few" at 10 or fewer left.
 */
export type Flag = 'new' | 'selling_fast' | 'last_few';
export const FLAG_LABEL: Record<Flag, string> = { new: 'New', selling_fast: 'Selling fast', last_few: 'Last few' };

export function FlagBanner({ flag, onDark = true, size = 'sm' }: { flag?: string | null; onDark?: boolean; size?: 'sm' | 'md' }) {
  if (!flag || !(flag in FLAG_LABEL)) return null;
  const f = flag as Flag;
  return (
    <span className={`flag flag-${f.replace('_', '-')} ${onDark ? 'flag-on-dark' : 'flag-on-light'} ${size === 'md' ? 'flag-md' : ''}`}>
      {f === 'last_few' && <span className="flag-dot" aria-hidden="true" />}
      {FLAG_LABEL[f]}
    </span>
  );
}
