import { useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Plus } from 'lucide-react';
import { minutesToClock, formatDuration, nowMinutes, snapMinutes, clampMinutes } from '../../common/time.js';
import { categoryInfo } from '../../common/model.js';
import { ActivityBlock } from './ActivityBlock.jsx';
import { FlexibleTray } from './FlexibleTray.jsx';
import './Timeline.css';

export const HOUR_HEIGHT = 64;
const DAY_MINUTES = 24 * 60;
const MIN_DURATION = 10;

export function Timeline({
  dateKey,
  isToday,
  activities,
  categories,
  onSetStart,
  onSetDuration,
  onOpenActivity,
  onQuickAddAt,
}) {
  const gridRef = useRef(null);
  const scrollRef = useRef(null);
  const [tick, setTick] = useState(0);
  const [drag, setDrag] = useState(null); // { id, mode, startClientY, originStart, originDuration, current }

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Backstop for a lost pointer sequence: if the window loses focus mid-drag
  // (alt-tab, a native dialog) some browsers drop the pointer without ever
  // sending pointerup/pointercancel, which would otherwise leave `drag` stuck.
  useEffect(() => {
    function handleBlur() {
      setDrag((d) => (d ? null : d));
    }
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  useEffect(() => {
    const target = isToday ? nowMinutes() : 7 * 60;
    const el = scrollRef.current;
    if (!el) return;
    const y = (target / 60) * HOUR_HEIGHT - 120;
    el.scrollTo({ top: Math.max(y, 0), behavior: 'auto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  const scheduled = useMemo(() => activities.filter((a) => a.start != null), [activities]);
  const flexible = useMemo(() => activities.filter((a) => a.start == null), [activities]);

  function minutesFromClientY(clientY) {
    const rect = gridRef.current.getBoundingClientRect();
    const raw = ((clientY - rect.top) / HOUR_HEIGHT) * 60;
    return clampMinutes(snapMinutes(raw, 5), 0, DAY_MINUTES);
  }

  function beginMove(e, activity) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      id: activity.id,
      mode: 'move',
      pointerId: e.pointerId,
      startClientY: e.clientY,
      moved: false,
      originStart: activity.start,
      duration: activity.duration,
      current: activity.start,
    });
  }

  function beginResize(e, activity) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      id: activity.id,
      mode: 'resize',
      pointerId: e.pointerId,
      startClientY: e.clientY,
      moved: false,
      originDuration: activity.duration,
      start: activity.start,
      current: activity.duration,
    });
  }

  function beginPlace(e, activity) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      id: activity.id,
      mode: 'place',
      pointerId: e.pointerId,
      startClientY: e.clientY,
      moved: false,
      duration: activity.duration,
      current: null,
    });
  }

  function onDragMove(e) {
    if (!drag) return;
    // Self-healing guard: e.buttons reflects the real-time pressed state, so
    // this catches ANY missed release (a pointerup/pointercancel/blur we
    // didn't handle, capture silently dropped, etc.) on the very next move —
    // the drag can never keep tracking the pointer once the button is up.
    if (e.buttons === 0) {
      onDragCancel();
      return;
    }
    const deltaY = e.clientY - drag.startClientY;
    if (Math.abs(deltaY) > 3) drag.moved = true;

    if (drag.mode === 'move') {
      const deltaMin = snapMinutes((deltaY / HOUR_HEIGHT) * 60, 5);
      const next = clampMinutes(drag.originStart + deltaMin, 0, DAY_MINUTES - drag.duration);
      setDrag({ ...drag, current: next });
    } else if (drag.mode === 'resize') {
      const deltaMin = snapMinutes((deltaY / HOUR_HEIGHT) * 60, 5);
      const next = Math.max(MIN_DURATION, Math.min(drag.originDuration + deltaMin, DAY_MINUTES - drag.start));
      setDrag({ ...drag, current: next });
    } else if (drag.mode === 'place') {
      const rect = gridRef.current.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const minutes = minutesFromClientY(e.clientY);
        setDrag({ ...drag, current: clampMinutes(minutes, 0, DAY_MINUTES - drag.duration) });
      } else {
        setDrag({ ...drag, current: null });
      }
    }
  }

  function onDragEnd() {
    if (!drag) return;
    if (!drag.moved) {
      if (drag.mode !== 'place') {
        const activity = activities.find((a) => a.id === drag.id);
        if (activity) onOpenActivity(activity);
      }
      setDrag(null);
      return;
    }

    if (drag.mode === 'move' && drag.current != null) onSetStart(drag.id, drag.current);
    if (drag.mode === 'resize' && drag.current != null) onSetDuration(drag.id, drag.current);
    if (drag.mode === 'place' && drag.current != null) onSetStart(drag.id, drag.current);
    setDrag(null);
  }

  /**
   * The browser can abort a pointer sequence mid-drag (pointercancel — fast
   * drags, trackpad gestures, the tab losing focus) without ever sending a
   * pointerup. Without this, `drag` stays set and onDragMove keeps repositioning
   * the block on every later pointermove even with the mouse button up, since
   * mousemove alone still bubbles to the wrapper and drag.startClientY is stale.
   * A cancelled gesture just discards the in-progress change rather than
   * applying whatever position it last saw.
   */
  function onDragCancel() {
    setDrag(null);
  }

  function handleGridClick(e) {
    if (e.target !== gridRef.current) return;
    // A click means "this slot": snap down to the quarter hour (17:07 -> 17:00).
    onQuickAddAt(Math.min(Math.floor(minutesFromClientY(e.clientY) / 15) * 15, DAY_MINUTES - 15));
  }

  const hours = Array.from({ length: 25 }, (_, i) => i);
  const now = nowMinutes();

  return (
    <div
      className="timeline-wrap"
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragCancel}
    >
      {flexible.length > 0 && (
        <FlexibleTray
          activities={flexible}
          categories={categories}
          onOpenActivity={onOpenActivity}
          onBeginPlace={beginPlace}
          dragId={drag?.mode === 'place' ? drag.id : null}
        />
      )}

      <div className="timeline-scroll" ref={scrollRef}>
      <div
        className="timeline-grid"
        ref={gridRef}
        style={{ height: (DAY_MINUTES / 60) * HOUR_HEIGHT }}
        onClick={handleGridClick}
      >
        {hours.map((h) => (
          <div className="timeline-hour-row" key={h} style={{ top: h * HOUR_HEIGHT }}>
            <span className="timeline-hour-label">{h < 24 ? `${String(h).padStart(2, '0')}:00` : ''}</span>
            <div className="timeline-hour-line" />
          </div>
        ))}

        {isToday && (
          <div className="timeline-now-line" style={{ top: (now / 60) * HOUR_HEIGHT }}>
            <span className="timeline-now-dot" />
          </div>
        )}

        {scheduled.map((activity) => {
          const isGhost = activity.plannedStart != null
            && (activity.plannedStart !== activity.start || activity.plannedDuration !== activity.duration)
            && activity.status !== 'planned';
          const isDraggingThis = drag && drag.id === activity.id;
          const start = isDraggingThis && drag.mode !== 'resize' ? drag.current ?? activity.start : activity.start;
          const duration = isDraggingThis && drag.mode === 'resize' ? drag.current ?? activity.duration : activity.duration;

          return (
            <div key={activity.id}>
              {isGhost && (
                <div
                  className="ghost-block"
                  style={{
                    top: (activity.plannedStart / 60) * HOUR_HEIGHT,
                    height: Math.max((activity.plannedDuration / 60) * HOUR_HEIGHT, 22),
                  }}
                >
                  <span>{minutesToClock(activity.plannedStart)} planned</span>
                </div>
              )}
              <ActivityBlock
                activity={activity}
                category={categoryInfo(categories, activity.categoryId)}
                top={(start / 60) * HOUR_HEIGHT}
                height={Math.max((duration / 60) * HOUR_HEIGHT, 26)}
                dragging={isDraggingThis}
                onPointerDownMove={(e) => beginMove(e, activity)}
                onPointerDownResize={(e) => beginResize(e, activity)}
              />
            </div>
          );
        })}

        {drag?.mode === 'place' && drag.current != null && (
          <div
            className="drop-preview"
            style={{ top: (drag.current / 60) * HOUR_HEIGHT, height: (drag.duration / 60) * HOUR_HEIGHT }}
          >
            {minutesToClock(drag.current)} · {formatDuration(drag.duration)}
          </div>
        )}
      </div>

      <div className="timeline-end" aria-hidden="true">
        <span className="timeline-end-line" />
        <span className="timeline-end-label"><Moon size={13} /> End of day</span>
        <span className="timeline-end-line" />
      </div>
      </div>

      <button type="button" className="timeline-fab" onClick={() => onQuickAddAt(isToday ? snapMinutes(now, 15) : 9 * 60)} aria-label="Add activity">
        <Plus size={24} />
      </button>
    </div>
  );
}
