import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, X as XIcon, RotateCcw, Pencil, Trash2 } from 'lucide-react';
import { QuickFields } from '../../trackers/ui/ItemPreview.jsx';
import { Select } from '../inputs/Select.jsx';
import { Modal } from '../Modal.jsx';
import { Button } from '../buttons/Button.jsx';
import { updateActivity } from '../../common/store.js';
import { minutesToClock, formatDuration } from '../../common/time.js';
import './ActivityEditor.css';

const NOTES_SAVE_DELAY_MS = 600;

export function ActivityQuickActions({ activity, dateKey, category, linkedLabel, noteLabel, onOpenNote, linked, trackers = [], trackerItems = [], itemLabel, onLink, series, onEditSeries, onTogglePause, onClose, onStatusChange, onEdit, onDelete }) {
  const [linking, setLinking] = useState(false);
  const [pickTracker, setPickTracker] = useState(trackers[0]?.id || '');
  const [notesText, setNotesText] = useState(activity?.notes || '');
  const pending = useRef(null); // notes typed but not yet saved
  const timer = useRef(null);
  const activityId = activity?.id;

  const flushNotes = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    updateActivity(dateKey, activityId, { notes: pending.current });
    pending.current = null;
  }, [dateKey, activityId]);

  useEffect(() => flushNotes, [flushNotes]); // closing the modal (or switching activity) saves what was typed

  function handleNotesChange(e) {
    const value = e.target.value;
    setNotesText(value);
    pending.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(flushNotes, NOTES_SAVE_DELAY_MS);
  }

  if (!activity) return null;

  return (
    <Modal open onClose={onClose} className="quick-actions-modal">
      <div className="quick-actions-header">
        <span className="icon-emoji">{activity.icon}</span>
        <div>
          <h3 className="quick-actions-title">{activity.title}</h3>
          <span className="quick-actions-meta">
            {category?.icon} {category?.name}
            {activity.start != null && (
              <> · {minutesToClock(activity.start)} · {formatDuration(activity.duration)}</>
            )}
          </span>
        </div>
      </div>

      {series && (
        <div className="quick-series">
          <span className="quick-series-text">🔁 {series.text}</span>
          <div className="quick-series-actions">
            <button type="button" className="trk-link-btn" onClick={onEditSeries}>Edit series</button>
            <button type="button" className="trk-link-btn" onClick={onTogglePause}>{series.paused ? 'Resume' : 'Pause'}</button>
          </div>
        </div>
      )}

      {linkedLabel && <p className="trk-linked">🔗 {linkedLabel}</p>}
      {noteLabel && <p className="trk-linked"><button type="button" className="trk-link-btn" onClick={() => { onClose(); onOpenNote(); }}>{noteLabel}</button></p>}

      <label className="quick-actions-notes-field">
        <span className="quick-actions-notes-label">Notes</span>
        <textarea
          className="quick-actions-notes-input"
          rows={2}
          value={notesText}
          placeholder="Optional notes"
          onChange={handleNotesChange}
          onBlur={flushNotes}
        />
      </label>

      {linked ? (
        <div className="quick-progress">
          <QuickFields tracker={linked.tracker} item={linked.item} />
        </div>
      ) : (
        trackers.length > 0 && onLink && (
          <div className="quick-progress">
            {linking ? (
              <div className="field-row">
                <Select value={pickTracker} onChange={setPickTracker} options={trackers.map((t) => ({ value: t.id, label: `${t.icon} ${t.name}` }))} />
                <Select
                  value=""
                  onChange={(itemId) => { if (itemId) { onLink(pickTracker, itemId); setLinking(false); } }}
                  options={trackerItems.filter((i) => i.trackerId === pickTracker && !i.archived).map((i) => ({ value: i.id, label: itemLabel(i.id) }))}
                  placeholder="Choose item…"
                />
              </div>
            ) : (
              <button type="button" className="trk-link-btn" onClick={() => setLinking(true)}>🔗 Link a tracker item…</button>
            )}
          </div>
        )
      )}

      <div className="activity-status-actions">
        <button type="button" className="status-action-btn good" onClick={() => onStatusChange('completed')}>
          <Check size={16} /> Done
        </button>
        <button type="button" className="status-action-btn" onClick={() => onStatusChange('skipped')}>
          <XIcon size={16} /> Skip
        </button>
        <button type="button" className="status-action-btn" onClick={() => onStatusChange('planned')}>
          <RotateCcw size={16} /> Reset
        </button>
      </div>

      <div className="app-modal-actions">
        {onDelete && (
          <Button type="button" variant="danger" onClick={onDelete}>
            <Trash2 size={16} /> Remove
          </Button>
        )}
        <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
        <Button type="button" variant="primary" onClick={onEdit}>
          <Pencil size={16} /> Edit
        </Button>
      </div>
    </Modal>
  );
}
