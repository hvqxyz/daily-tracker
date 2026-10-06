import { useState } from 'react';
import { Modal } from '../Modal.jsx';
import { Button } from '../buttons/Button.jsx';
import { TextInput } from '../inputs/TextInput.jsx';
import { Select } from '../inputs/Select.jsx';
import { SegmentedControl } from '../inputs/SegmentedControl.jsx';
import { Checkbox } from '../inputs/Checkbox.jsx';
import { RepeatPicker } from '../timeline/RepeatPicker.jsx';
import { defaultRepeat, ruleToRepeat, validateRepeat } from '../../common/recurrence.js';
import { IconPicker } from '../inputs/IconPicker.jsx';
import './settings-shared.css';
import { PRIORITIES } from '../../common/model.js';
import { minutesToClock, clockToMinutes, formatDuration, todayKey } from '../../common/time.js';

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export function RecurrenceEditor({ open, onClose, rule, categories, onSubmit, onDelete, onTogglePause }) {
  const [title, setTitle] = useState(rule?.title || '');
  const [icon, setIcon] = useState(rule?.icon || '🔁');
  const [categoryId, setCategoryId] = useState(rule?.categoryId || categories[0]?.id);
  const [priority, setPriority] = useState(rule?.priority || 'should');
  const [duration, setDuration] = useState(rule?.duration ?? 30);
  const [fixed, setFixed] = useState(rule?.fixed ?? false);
  const [hasTime, setHasTime] = useState(rule?.start != null);
  const [time, setTime] = useState(minutesToClock(rule?.start ?? 9 * 60));
  const [repeat, setRepeat] = useState(() => (rule ? ruleToRepeat(rule) : { ...defaultRepeat(todayKey()), mode: 'daily' }));
  const [error, setError] = useState('');

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const problem = validateRepeat(repeat);
    if (problem) { setError(problem); return; }
    onSubmit({
      repeat,
      fields: {
      title: title.trim(),
      icon,
      categoryId,
      priority,
      duration: Number(duration) || 5,
      fixed,
      start: hasTime ? clockToMinutes(time) : null,
      },
    });
  }

  return (
    <Modal open onClose={onClose}>
      <h3>{rule ? 'Edit recurring activity' : 'New recurring activity'}</h3>
      <form onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-label">Title</label>
          <TextInput value={title} onChange={setTitle} placeholder="Running" autoFocus required />
        </div>
        <div className="field-group">
          <label className="field-label">Icon</label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        <div className="field-group">
          <label className="field-label">Category</label>
          <Select value={categoryId} onChange={setCategoryId} options={categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
        </div>
        <div className="field-group">
          <label className="field-label">Priority</label>
          <SegmentedControl value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ value: p.id, label: p.label, icon: p.icon }))} />
        </div>
        <div className="field-group">
          <label className="field-label">Duration</label>
          <div className="duration-presets">
            {DURATION_PRESETS.map((d) => (
              <button type="button" key={d} className={`duration-chip${Number(duration) === d ? ' selected' : ''}`} onClick={() => setDuration(d)}>
                {formatDuration(d)}
              </button>
            ))}
          </div>
        </div>
        <div className="field-row">
          <div className="field-group"><Checkbox checked={hasTime} onChange={setHasTime} label="Set a time" /></div>
          {hasTime && <div className="field-group"><input type="time" className="time-input" value={time} onChange={(e) => setTime(e.target.value)} /></div>}
        </div>
        <div className="field-group">
          <Checkbox checked={fixed} onChange={setFixed} label="Fixed time" />
        </div>
        <RepeatPicker value={repeat} onChange={(r) => { setRepeat(r); setError(''); }} dateKey={rule?.startDate || todayKey()} allowNever={false} />
        {error && <p className="repeat-error">{error}</p>}
        <div className="app-modal-actions">
          {rule && <Button type="button" variant="danger" size="small" onClick={onDelete}>Delete</Button>}
          {rule && onTogglePause && <Button type="button" variant="subtle" size="small" onClick={onTogglePause}>{rule.pausedFrom ? 'Resume' : 'Pause'}</Button>}
          <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Save</Button>
        </div>
      </form>
    </Modal>
  );
}
