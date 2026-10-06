import { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

/**
 * Small dropdown. `items`: [{ label, icon?, onClick, danger?, disabled?, divider? }].
 * `children` (optional) replaces the default ⋮ trigger.
 */
export function Menu({ items, children, label = 'Actions', align = 'right', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className={`trk-menu ${className}`.trim()} ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="trk-menu-trigger" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {children || <MoreVertical size={16} />}
      </button>
      {open && (
        <div className={`trk-menu-list ${align}`}>
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
        </div>
      )}
    </div>
  );
}
