import { useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { Button } from '../../components/buttons/Button.jsx';
import { TextInput } from '../../components/inputs/TextInput.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { Checkbox } from '../../components/inputs/Checkbox.jsx';
import { SegmentedControl } from '../../components/inputs/SegmentedControl.jsx';
import { IconPicker } from '../../components/inputs/IconPicker.jsx';
import { ItemForm } from './ItemForm.jsx';
import { activityDraftFromItem, createActivityFromItem, updateItem } from '../tracker-store.js';
import { PRIORITIES } from '../../common/model.js';
import { quickFields } from '../engine/schema.js';
import { clockToMinutes, formatDuration, todayKey } from '../../common/time.js';

const DURATIONS = [15, 30, 45, 60, 90, 120];
const QUICK_TYPES = ['number', 'decimal', 'percentage', 'progress', 'rating', 'select', 'multiselect', 'boolean', 'date', 'duration'];

/** Category a new activity from this tracker should use. */
function plannerCategory(state, tracker) {
  const configured = tracker.settings?.activity?.categoryId;
  return state.categories.find((c) => c.id === configured)?.id || state.categories[0]?.id;
}

/** One-tap "add to today's plan": flexible (unscheduled) unless the tracker has a start-time field. */
export function addItemToToday(state, item) {
  const tracker = state.trackers.find((t) => t.id === item.trackerId);
  const draft = activityDraftFromItem(state, item);
  const start = draft.startClock ? clockToMinutes(draft.startClock) : null;
  return createActivityFromItem(todayKey(), {
    title: draft.title,
    icon: draft.icon,
    categoryId: plannerCategory(state, tracker),
    priority: 'should',
    duration: draft.duration,
    start,
    fixed: start !== null,
    link: draft.link,
  });
}

export function CreateActivityModal({ state, item, note, onClose, onCreated }) {
  // An activity can start from a tracker item or from a knowledge note.
  const tracker = item ? state.trackers.find((t) => t.id === item.trackerId) : null;
  const draft = item
    ? activityDraftFromItem(state, item)
    : { title: note.title.trim() || 'Untitled note', icon: note.icon || '📝', duration: 30, startClock: null, link: null };
  const [title, setTitle] = useState(draft.title);
  const [icon, setIcon] = useState(draft.icon);
  const [categoryId, setCategoryId] = useState(tracker ? plannerCategory(state, tracker) : (state.categories.find((c) => c.id === 'mind') || state.categories[0])?.id);
  const [priority, setPriority] = useState('should');
  const [date, setDate] = useState(todayKey());
  const [hasTime, setHasTime] = useState(Boolean(draft.startClock));
  const [time, setTime] = useState(draft.startClock || '17:00');
  const [duration, setDuration] = useState(draft.duration);
  const [notes, setNotes] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    createActivityFromItem(date, {
      title: title.trim(),
      icon,
      categoryId,
      priority,
      duration: Number(duration) || 30,
      start: hasTime ? clockToMinutes(time) : null,
      fixed: hasTime,
      notes,
      ...(note ? { noteId: note.id } : { link: draft.link }),
    });
    onCreated?.(date);
    onClose();
  }

  return (
    <Modal open onClose={onClose} className="trk-modal">
      <h3>Create activity</h3>
      <p className="trk-hint">{tracker ? `From ${tracker.icon} ${tracker.name}. It is linked to the item, so you can update the item when you finish.` : 'Linked to this note, so you can capture what you learned when you finish.'}</p>
      <form onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-label">Title</label>
          <TextInput value={title} onChange={setTitle} autoFocus required />
        </div>
        <div className="field-group">
          <label className="field-label">Icon</label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        <div className="field-row">
          <div className="field-group">
            <label className="field-label">Day</label>
            <input type="date" className="field-input" value={date} onChange={(e) => setDate(e.target.value || todayKey())} />
          </div>
          <div className="field-group">
            <label className="field-label">Category</label>
            <Select value={categoryId} onChange={setCategoryId} options={state.categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">Priority</label>
          <SegmentedControl value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ value: p.id, label: p.label, icon: p.icon }))} />
        </div>
        <div className="field-group">
          <label className="field-label">Duration</label>
          <div className="duration-presets">
            {DURATIONS.map((d) => (
              <button type="button" key={d} className={`duration-chip${Number(duration) === d ? ' selected' : ''}`} onClick={() => setDuration(d)}>{formatDuration(d)}</button>
            ))}
          </div>
        </div>
        <div className="field-row">
          <div className="field-group"><Checkbox checked={hasTime} onChange={setHasTime} label="Set a time" /></div>
          {hasTime && <div className="field-group"><input type="time" className="time-input" value={time} onChange={(e) => setTime(e.target.value)} /></div>}
        </div>
        <div className="field-group">
          <label className="field-label">Notes</label>
          <textarea className="field-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>
        <div className="app-modal-actions">
          <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Add to plan</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Shown after completing a linked activity: optionally record progress on the tracker item. */
export function UpdateLinkedItemModal({ state, ctx, item, onClose }) {
  const tracker = state.trackers.find((t) => t.id === item.trackerId);
  const chosen = tracker.settings?.activity?.updateFieldIds || [];
  const quick = quickFields(tracker);
  const fields = chosen.length
    ? tracker.fields.filter((f) => chosen.includes(f.id))
    : quick.length
      ? quick
      : tracker.fields.filter((f) => QUICK_TYPES.includes(f.type));
  const [values, setValues] = useState(() => ({ ...item.values }));

  return (
    <Modal open onClose={onClose} className="trk-modal">
      <h3>{tracker.icon} Update "{ctx.itemLabel(item.id)}"?</h3>
      <p className="trk-hint">Nice work. Record how far you got, or skip.</p>
      <ItemForm
        tracker={tracker}
        item={item}
        values={values}
        onChange={(fid, v) => setValues((prev) => ({ ...prev, [fid]: v }))}
        ctx={ctx}
        allItems={state.trackerItems}
        fields={fields}
        original={item.values}
      />
      <div className="app-modal-actions">
        <Button type="button" variant="subtle" onClick={onClose}>Skip</Button>
        <Button type="button" variant="primary" onClick={() => { updateItem(item.id, values); onClose(); }}>Save</Button>
      </div>
    </Modal>
  );
}
