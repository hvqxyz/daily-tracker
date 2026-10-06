import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select } from '../../../components/inputs/Select.jsx';
import { itemLabel } from '../../engine/data.js';
import { getValue } from '../../engine/data.js';
import { dateToKey, keyToDate, shiftDateKey, todayKey, weekdayIndex } from '../../../common/time.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_PER_DAY = 3;

/** Month grid driven by whichever date field the view is configured with. */
export function CalendarView({ tracker, view, rows, ctx, onOpen, onUpdateView, onAdd }) {
  const field = tracker.fields.find((f) => f.id === view.config.dateFieldId);
  const [cursor, setCursor] = useState(() => todayKey().slice(0, 7));

  if (!field) {
    const dates = tracker.fields.filter((f) => ['date', 'datetime'].includes(f.type));
    return (
      <div className="trk-panel">
        <label className="field-label">Choose the date field that places items on the calendar</label>
        {dates.length ? <Select value="" onChange={(dateFieldId) => onUpdateView({ dateFieldId })} options={dates.map((f) => ({ value: f.id, label: f.name }))} placeholder="Date field…" /> : <span className="trk-hint">This tracker has no Date field. Add one in the tracker settings.</span>}
      </div>
    );
  }

  const first = `${cursor}-01`;
  const start = shiftDateKey(first, -weekdayIndex(first));
  const days = Array.from({ length: 42 }, (_, i) => shiftDateKey(start, i));
  const trimmed = days.slice(35).every((d) => d.slice(0, 7) !== cursor) ? days.slice(0, 35) : days;
  const byDay = new Map();
  for (const item of rows) {
    const v = getValue(item, field, ctx);
    const key = v ? String(v).slice(0, 10) : null;
    if (!key) continue;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(item);
  }
  const undated = rows.filter((i) => !getValue(i, field, ctx)).length;
  const today = todayKey();
  const shiftMonth = (n) => {
    const d = keyToDate(first);
    d.setMonth(d.getMonth() + n);
    setCursor(dateToKey(d).slice(0, 7));
  };
  const title = keyToDate(first).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="trk-calendar">
      <div className="trk-cal-head">
        <button type="button" className="trk-icon-btn" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft size={18} /></button>
        <strong>{title}</strong>
        <button type="button" className="trk-icon-btn" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight size={18} /></button>
        <button type="button" className="trk-small-btn" onClick={() => setCursor(today.slice(0, 7))}>Today</button>
      </div>
      <div className="trk-cal-grid">
        {WEEKDAYS.map((d) => <div className="trk-cal-dow" key={d}>{d}</div>)}
        {trimmed.map((day) => {
          const items = byDay.get(day) || [];
          const inMonth = day.slice(0, 7) === cursor;
          return (
            <div
              key={day}
              className={`trk-cal-cell${inMonth ? '' : ' out'}${day === today ? ' today' : ''}`}
              onClick={() => onAdd({ [field.id]: field.type === 'datetime' ? `${day}T09:00` : day })}
            >
              <span className="trk-cal-num">{Number(day.slice(8))}</span>
              {items.slice(0, MAX_PER_DAY).map((item) => (
                <button type="button" key={item.id} className="trk-cal-item" title={itemLabel(tracker, item, ctx)} onClick={(e) => { e.stopPropagation(); onOpen(item); }}>
                  {itemLabel(tracker, item, ctx)}
                </button>
              ))}
              {items.length > MAX_PER_DAY && <span className="trk-cal-more">+{items.length - MAX_PER_DAY} more</span>}
            </div>
          );
        })}
      </div>
      {undated > 0 && <span className="trk-hint">{undated} item{undated === 1 ? ' has' : 's have'} no {field.name.toLowerCase()} and {undated === 1 ? "isn't" : "aren't"} shown.</span>}
    </div>
  );
}
