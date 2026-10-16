import { useEffect, useRef, useState } from 'react';
import './library.css';

const DRAG_THRESHOLD = 4; // px a mouse must move before a press becomes a drag (otherwise it's a click)

/**
 * A single row of filter chips that scrolls left / right: touch and trackpads
 * natively, a mouse by dragging the row or turning the wheel. The edges fade
 * while there is more to see in that direction.
 */
export function FilterRow({ children, ...rest }) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setEdges({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
    // non-passive so the page / dialog doesn't scroll while the row does
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return; // at an end: let the page scroll
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    // Drag with the mouse (touch / pen already scroll natively). A drag never
    // ends in a click on the chip it started on.
    let drag = null; // { x, left, id, moved }
    const onDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || el.scrollWidth <= el.clientWidth) return;
      drag = { x: e.clientX, left: el.scrollLeft, id: e.pointerId, moved: false };
    };
    const onMove = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        drag.moved = true;
        el.setPointerCapture(e.pointerId);
        el.style.scrollBehavior = 'auto'; // smooth scrolling would lag behind the mouse
        setDragging(true);
      }
      el.scrollLeft = drag.left - dx;
    };
    const onUp = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) {
        el.style.scrollBehavior = '';
        setDragging(false);
        const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
        el.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
      }
      drag = null;
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      observer?.disconnect();
    };
  }, []);

  const cls = ['lib-filters', edges.left && 'fade-left', edges.right && 'fade-right', dragging && 'dragging'].filter(Boolean).join(' ');
  return <div ref={ref} className={cls} {...rest}>{children}</div>;
}
