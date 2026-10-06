import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronUp, CornerDownRight, X } from 'lucide-react';
import { Modal } from '../Modal.jsx';
import { Button } from '../buttons/Button.jsx';
import { summarizeDay } from '../../common/day-review.js';
import { setActivityStatus, moveActivityToDay, setDayReflection } from '../../common/store.js';
import { WELLBEING_LEVELS, wellbeingInfo } from '../../common/model.js';
import { formatDayHeading, formatDuration, minutesToClock, shiftDateKey } from '../../common/time.js';
import './DailyReview.css';

const minutesLabel = (m) => (m > 0 ? formatDuration(m) : '—');

function ReviewDayModal({ dateKey, unfinished, onClose }) {
  return (
    <Modal open onClose={onClose}>
      <h3>Review day</h3>
      {unfinished.length === 0 ? (
        <p className="dr-modal-note">Everything is sorted. Nice work.</p>
      ) : (
        <div className="dr-unfinished">
          {unfinished.map((a) => (
            <div className="dr-unfinished-row" key={a.id}>
              <div className="dr-unfinished-main">
                <span className="dr-unfinished-title">{a.icon} {a.title}</span>
                <span className="dr-unfinished-meta">
                  {a.start != null ? minutesToClock(a.start) : 'Flexible'} · {formatDuration(a.duration)}
                </span>
              </div>
              <div className="dr-unfinished-actions">
                <button type="button" className="dr-act good" onClick={() => setActivityStatus(dateKey, a.id, 'completed')} title="Mark as complete"><Check size={14} /> Done</button>
                <button type="button" className="dr-act" onClick={() => moveActivityToDay(dateKey, a.id, shiftDateKey(dateKey, 1))} title="Move to tomorrow"><CornerDownRight size={14} /> Tomorrow</button>
                <button type="button" className="dr-act" onClick={() => setActivityStatus(dateKey, a.id, 'skipped')} title="Skip"><X size={14} /> Skip</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="app-modal-actions">
        <Button type="button" variant="primary" onClick={onClose}>{unfinished.length === 0 ? 'Close' : 'Done'}</Button>
      </div>
    </Modal>
  );
}


const NOTE_SAVE_DELAY_MS = 600;

/** The closing of the day: how it felt (1-5) and a free-text note. Both save on their own. */
function DayReflection({ dateKey, wellbeing, note }) {
  const [text, setText] = useState(note || '');
  const pending = useRef(null); // note text typed but not yet saved
  const timer = useRef(null);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    setDayReflection(dateKey, { note: pending.current });
    pending.current = null;
  }, [dateKey]);

  useEffect(() => flush, [flush]); // leaving the day (or the page) saves what was typed
  useEffect(() => { if (pending.current === null) setText(note || ''); }, [note]); // e.g. pulled from Sheets

  function handleChange(e) {
    const value = e.target.value;
    setText(value);
    pending.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, NOTE_SAVE_DELAY_MS);
  }

  const selected = wellbeingInfo(wellbeing);

  return (
    <div className="dr-reflection">
      <div className="dr-wellbeing">
        <span className="dr-reflection-label">How was your day?</span>
        <div className="dr-mood-row" role="radiogroup" aria-label="How was your day?">
          {WELLBEING_LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={wellbeing === l.value}
              aria-label={`${l.value} — ${l.label}`}
              className={`dr-mood${wellbeing === l.value ? ' selected' : ''}`}
              onClick={() => setDayReflection(dateKey, { wellbeing: wellbeing === l.value ? null : l.value })}
            >
              <span className="dr-mood-emoji">{l.emoji}</span>
              <span className="dr-mood-value">{l.value}</span>
            </button>
          ))}
        </div>
        {selected && <span className="dr-mood-picked">{selected.emoji} {selected.value}/5 · {selected.label}</span>}
      </div>

      <label className="dr-note">
        <span className="dr-reflection-label">Day note</span>
        <textarea
          className="dr-note-input"
          rows={3}
          value={text}
          placeholder="What went well? What didn't? Anything worth remembering?"
          onChange={handleChange}
          onBlur={flush}
        />
      </label>
    </div>
  );
}

/** A summary of the day's timeline — what was planned vs. what actually happened. */
export function DailyReview({ dateKey, activities, categories, wellbeing = null, note = '' }) {
  const [reviewing, setReviewing] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [open, setOpen] = useState(false);
  const reflection = <DayReflection key={dateKey} dateKey={dateKey} wellbeing={wellbeing} note={note} />;

  // nothing was planned, but the day can still be reflected on
  if (activities.length === 0) {
    return (
      <section className="day-review open" aria-label="Day review">
        <div className="dr-body">{reflection}</div>
      </section>
    );
  }

  const s = summarizeDay(activities, categories);
  const rows = s.byCategory.filter((c) => showEmpty || !c.empty);
  const hiddenCount = s.byCategory.filter((c) => c.empty).length;

  return (
    <section className={`day-review${open ? ' open' : ''}`} aria-label="Day review">
      <button type="button" className="dr-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="dr-heading">
          <h3 className="dr-title">Day review</h3>
          <span className="dr-date">{formatDayHeading(dateKey)}{wellbeingInfo(wellbeing) && <span className="dr-head-mood" title={`Well-being ${wellbeing}/5`}> · {wellbeingInfo(wellbeing).emoji}</span>}</span>
        </div>
        <div className="dr-score">
          <strong>{s.percent}%</strong>
          <span>{s.completed} of {s.total} completed</span>
          <span>{formatDuration(s.plannedMinutes)} planned</span>
        </div>
        <ChevronUp size={18} className="dr-chevron" />
      </button>

      {open && (
      <div className="dr-body">
      <div className="dr-priorities">
        {s.byPriority.map((p) => (
          <div className={`dr-priority ${p.id}`} key={p.id}>
            <div className="dr-priority-top">
              <span>{p.icon} {p.label}</span>
              <span className="dr-priority-count">{p.done} / {p.total}</span>
            </div>
            <div className="dr-track"><div className="dr-fill" style={{ width: p.total ? `${(p.done / p.total) * 100}%` : '0%' }} /></div>
          </div>
        ))}
      </div>

      <div className="dr-table" role="table">
        <div className="dr-row dr-row-head" role="row">
          <span>Category</span><span>Planned</span><span>Actual</span><span>Progress</span>
        </div>
        {rows.map((c) => (
          <div className={`dr-row${c.empty ? ' empty' : ''}`} role="row" key={c.id}>
            <span className="dr-cat">{c.icon} {c.name}</span>
            <span>{c.empty ? '—' : minutesLabel(c.planned)}</span>
            <span>{c.empty ? '—' : c.actual > 0 ? formatDuration(c.actual) : '0 min'}</span>
            <span className="dr-progress">
              {c.progress === null ? '—' : (
                <>
                  <span className="dr-mini"><span style={{ width: `${c.progress}%`, background: c.color }} /></span>
                  {c.progress}%
                </>
              )}
            </span>
          </div>
        ))}
        {hiddenCount > 0 && (
          <button type="button" className="dr-more" onClick={() => setShowEmpty((v) => !v)}>
            {showEmpty ? 'Hide empty categories' : `Show ${hiddenCount} empty categories`}
          </button>
        )}
      </div>

      <footer className="dr-actions">
        {s.unfinished.length > 0 ? (
          <>
            <div>
              <strong>{s.unfinished.length} {s.unfinished.length === 1 ? 'activity' : 'activities'} unfinished</strong>
              <span>Reschedule or mark as complete</span>
            </div>
            <button type="button" className="dr-review-btn" onClick={() => setReviewing(true)}>Review day <ArrowRight size={15} /></button>
          </>
        ) : (
          <div><strong className="dr-all-done">✓ Everything on this day is done or skipped</strong></div>
        )}
      </footer>

      {reflection}
      </div>
      )}

      {reviewing && <ReviewDayModal dateKey={dateKey} unfinished={s.unfinished} onClose={() => setReviewing(false)} />}
    </section>
  );
}
