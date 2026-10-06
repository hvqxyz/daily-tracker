import { Select } from '../../../components/inputs/Select.jsx';
import { itemLabel, getValue } from '../../engine/data.js';
import { isDateStr, toDays } from '../../engine/formula.js';
import { shiftDateKey, todayKey } from '../../../common/time.js';

const isDate = (f) => ['date', 'datetime'].includes(f.type);

/** Bars between a start and (optional) end date field, both chosen in the view settings. */
export function TimelineView({ tracker, view, rows, ctx, onOpen, onUpdateView }) {
  const startField = tracker.fields.find((f) => f.id === view.config.startFieldId);
  const endField = tracker.fields.find((f) => f.id === view.config.endFieldId);

  if (!startField) {
    const dates = tracker.fields.filter(isDate);
    return (
      <div className="trk-panel">
        <label className="field-label">Choose the date field where items start</label>
        {dates.length ? <Select value="" onChange={(startFieldId) => onUpdateView({ startFieldId })} options={dates.map((f) => ({ value: f.id, label: f.name }))} placeholder="Date field…" /> : <span className="trk-hint">This tracker has no Date field. Add one in the tracker settings.</span>}
      </div>
    );
  }

  const spans = rows
    .map((item) => {
      const s = getValue(item, startField, ctx);
      const e = endField ? getValue(item, endField, ctx) : null;
      const start = s ? String(s).slice(0, 10) : null;
      let end = e ? String(e).slice(0, 10) : start;
      if (start && end && end < start) end = start;
      return start && isDateStr(start) ? { item, start, end } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (spans.length === 0) return <div className="empty-state">No items have a {startField.name.toLowerCase()} yet.</div>;

  const today = todayKey();
  const min = spans.reduce((m, s) => (s.start < m ? s.start : m), spans[0].start);
  const max = spans.reduce((m, s) => (s.end > m ? s.end : m), spans[0].end);
  const from = shiftDateKey(min < today ? min : today, -2);
  const to = shiftDateKey(max > today ? max : today, 2);
  const total = Math.max(1, toDays(to) - toDays(from));
  const pct = (d) => ((toDays(d) - toDays(from)) / total) * 100;
  const undated = rows.length - spans.length;

  return (
    <div className="trk-timeline">
      <div className="trk-tl-scroll">
        <div className="trk-tl-inner">
          <div className="trk-tl-axis">
            <span>{from}</span>
            <span>{to}</span>
          </div>
          {spans.map(({ item, start, end }) => (
            <div className="trk-tl-row" key={item.id} onClick={() => onOpen(item)}>
              <div className="trk-tl-label">{itemLabel(tracker, item, ctx)}</div>
              <div className="trk-tl-track">
                <div className="trk-tl-today" style={{ left: `${pct(today)}%` }} />
                <div className="trk-tl-bar" style={{ left: `${pct(start)}%`, width: `${Math.max(1.2, pct(end) - pct(start) + 100 / total)}%` }} title={`${start} → ${end}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {undated > 0 && <span className="trk-hint">{undated} item{undated === 1 ? ' has' : 's have'} no start date and {undated === 1 ? "isn't" : "aren't"} shown.</span>}
    </div>
  );
}
