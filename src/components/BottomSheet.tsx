import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Phone bottom sheet. Opens on the drawer curve, closes on Escape, backdrop tap,
 * a drag past a quarter of its height, or a quick downward flick (velocity over 0.11 px/ms).
 */
export function BottomSheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number } | null>(null);
  const [dy, setDy] = useState(0);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) { setMounted(true); requestAnimationFrame(() => requestAnimationFrame(() => setShown(true))); }
    else if (mounted) { setShown(false); const t = setTimeout(() => setMounted(false), 400); return () => clearTimeout(t); }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; prev?.focus(); };
  }, [open, onClose]);

  if (!mounted) return null;
  const end = (y: number) => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    const dist = y - d.y, v = dist / Math.max(1, performance.now() - d.t);
    const h = panel.current?.offsetHeight ?? 400;
    setDy(0);
    if (dist > h / 4 || v > 0.11) onClose();
  };
  return createPortal(
    <>
      <div className="sheet-backdrop" style={{ opacity: shown ? 1 : 0 }} onClick={onClose} />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className="sheet outline-none"
        style={{ transform: `translateY(${shown ? Math.max(0, dy) : 100}${shown ? 'px' : '%'})`, transitionDuration: drag.current ? '0ms' : undefined }}>
        <div className="-mx-5 -mt-3 cursor-grab touch-none px-5 pb-3 pt-3"
          onPointerDown={(e) => { drag.current = { y: e.clientY, t: performance.now() }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (drag.current) setDy(e.clientY - drag.current.y); }}
          onPointerUp={(e) => end(e.clientY)} onPointerCancel={(e) => end(e.clientY)}>
          <div className="mx-auto h-1.5 w-10 rounded-full bg-ink/15" />
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}
