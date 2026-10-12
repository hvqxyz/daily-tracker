import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

const GAP = 4;
const MARGIN = 8;

/**
 * Small dropdown. `items`: [{ label, icon?, onClick, danger?, disabled?, divider? }].
 * `children` (optional) replaces the default ⋮ trigger.
 * The list is portaled to <body> with fixed positioning so overflow containers can't clip it,
 * and flips above the trigger when there isn't room below.
 */
export function Menu({ items, children, label = 'Actions', align = 'right', className = '' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!ref.current?.contains(e.target) && !listRef.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return undefined; }
    const place = () => {
      const trigger = ref.current?.getBoundingClientRect();
      const list = listRef.current;
      if (!trigger || !list) return;
      const { offsetWidth: w, offsetHeight: h } = list;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let top = trigger.bottom + GAP;
      if (top + h > vh - MARGIN && trigger.top - GAP - h >= MARGIN) top = trigger.top - GAP - h;
      top = Math.max(MARGIN, Math.min(top, vh - MARGIN - h));
      let left = align === 'left' ? trigger.left : trigger.right - w;
      left = Math.max(MARGIN, Math.min(left, vw - MARGIN - w));
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align]);

  return (
    <div className={`trk-menu ${className}`.trim()} ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="trk-menu-trigger" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {children || <MoreVertical size={16} />}
      </button>
      {open && createPortal(
        <div
          ref={listRef}
          className="trk-menu-list"
          style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.filter(Boolean).map((item, i) =>
            item.divider ? (
              <div className="trk-menu-divider" key={`d${i}`} />
            ) : (
              <button
                type="button"
                key={item.label}
                disabled={item.disabled}
                className={`trk-menu-item${item.danger ? ' danger' : ''}`}
                onClick={() => { setOpen(false); item.onClick(); }}
              >
                {item.icon && <span className="trk-menu-icon">{item.icon}</span>}
                {item.label}
              </button>
            )
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
