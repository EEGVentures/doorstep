import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Phone bottom sheet (Vaul-style).
 * - Opens from translateY(100%) on the drawer curve; closes faster than it opens.
 * - Drag from the handle area: the sheet follows the finger 1:1 downwards, with growing friction upwards.
 * - Dismisses past a quarter of its height OR on a flick (release velocity over the last 100ms faster than 0.11px/ms), whatever the distance.
 * - One pointer at a time (a second finger is ignored), pointer capture keeps the drag if the finger leaves the handle.
 * - Drag writes transform and backdrop opacity straight to the DOM, so no React render per frame.
 */
export function BottomSheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; y: number; dy: number; samples: { y: number; t: number }[] } | null>(null);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) { setMounted(true); requestAnimationFrame(() => requestAnimationFrame(() => setShown(true))); return; }
    if (!mounted) return;
    setShown(false);
    const t = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; prev?.focus({ preventScroll: true }); };
  }, [open, onClose]);

  if (!mounted) return null;

  const paint = (dy: number) => {
    const p = panel.current, b = backdrop.current; if (!p || !b) return;
    const h = p.offsetHeight || 1;
    // Upwards: friction that grows the further you pull (never a hard stop).
    const y = dy >= 0 ? dy : -(12 * Math.log1p(-dy / 12));
    p.style.transform = `translateY(${y}px)`;
    b.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / h));
  };
  const release = (closing: boolean) => {
    // Restore selection after the trailing mouseup, and drop any range a mouse drag left behind.
    setTimeout(() => { document.documentElement.style.userSelect = ''; window.getSelection()?.removeAllRanges(); }, 0);
    const p = panel.current, b = backdrop.current; if (!p || !b) return;
    p.style.transition = ''; b.style.transition = '';
    p.style.transform = ''; b.style.opacity = '';
    if (closing) onClose();
  };

  return createPortal(
    <>
      <div ref={backdrop} className="sheet-backdrop" data-shown={shown || undefined} onClick={onClose} />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className="sheet outline-none" data-shown={shown || undefined}>
        <div className="-mx-5 -mt-3 cursor-grab touch-none select-none px-5 pb-3 pt-3 active:cursor-grabbing"
          onPointerDown={(e) => {
            if (drag.current) return; // multi-touch protection
            drag.current = { id: e.pointerId, y: e.clientY, dy: 0, samples: [{ y: e.clientY, t: performance.now() }] };
            e.preventDefault(); // no text selection or native scroll while dragging
            document.documentElement.style.userSelect = 'none';
            e.currentTarget.setPointerCapture(e.pointerId);
            if (panel.current) panel.current.style.transition = 'none';
            if (backdrop.current) backdrop.current.style.transition = 'none';
          }}
          onPointerMove={(e) => {
            const d = drag.current; if (!d || d.id !== e.pointerId) return;
            d.dy = e.clientY - d.y; paint(d.dy);
            const now = performance.now();
            d.samples.push({ y: e.clientY, t: now });
            while (d.samples.length > 2 && now - d.samples[0].t > 100) d.samples.shift();
          }}
          onPointerUp={(e) => {
            const d = drag.current; if (!d || d.id !== e.pointerId) return;
            drag.current = null;
            // Release velocity from the last ~100ms only, so a slow drag that stops is not mistaken for a flick.
            const first = d.samples[0], now = performance.now();
            const v = (e.clientY - first.y) / Math.max(1, now - first.t);
            const h = panel.current?.offsetHeight ?? 400;
            release(d.dy > h / 4 || (d.dy > 10 && v > 0.11));
          }}
          onPointerCancel={() => { drag.current = null; release(false); }}>
          <div className="mx-auto h-1.5 w-10 rounded-full bg-ink/15" />
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}
