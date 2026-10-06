import { useState } from 'react';
import { Trash2, Check, X as XIcon, RotateCcw, CalendarClock } from 'lucide-react';
import { Modal } from '../Modal.jsx';
import { Button } from '../buttons/Button.jsx';
import { TextInput } from '../inputs/TextInput.jsx';
import { Select } from '../inputs/Select.jsx';
import { SegmentedControl } from '../inputs/SegmentedControl.jsx';
import { Checkbox } from '../inputs/Checkbox.jsx';
import { IconPicker } from '../inputs/IconPicker.jsx';
import { PRIORITIES } from '../../common/model.js';
import { RepeatPicker } from './RepeatPicker.jsx';
import { defaultRepeat, describeRule, ruleToRepeat, validateRepeat } from '../../common/recurrence.js';
import { NotePickerModal } from '../../notes/ui/pickers.jsx';
import { minutesToClock, clockToMinutes, formatDuration, formatDateDMY, todayKey } from '../../common/time.js';
import './ActivityEditor.css';

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export function ActivityEditor({
  open,
  onClose,
  activity,
  categories,
  templates,
  dictionary,
  trackers,
  trackerItems,
  itemLabel,
  knowledge,
  defaultStart,
  dateKey,
  allowRepeat = false,
  seriesRule = null,
  editingSeries = false,
  onSubmit,
  onDelete,
  onStatusChange,
  onMoveToDay,
  allowStatusActions = true,
  allowMoveToDay = true,
  title: modalTitle,
}) {
  const isEdit = Boolean(activity);
  const showDictionaryPicker = !isEdit && dictionary?.length > 0;
  const showTemplatePicker = !isEdit && templates?.some((t) => t.items.length > 0);
  const [mode, setModeRaw] = useState(showDictionaryPicker ? 'dictionary' : showTemplatePicker ? 'template' : 'new');
  // a pick made on one tab shouldn't gate fields on another tab it's switched away from
  function setMode(next) {
    setModeRaw(next);
    setFromTemplateItem(null);
    setFromDictionaryItem(null);
  }
  const [title, setTitle] = useState(activity?.title || '');
  const [icon, setIcon] = useState(activity?.icon || '📌');
  const [categoryId, setCategoryId] = useState(activity?.categoryId || categories[0]?.id);
  const [priority, setPriority] = useState(activity?.priority || 'required');
  const [duration, setDuration] = useState(activity?.duration ?? 30);
  const [fixed, setFixed] = useState(activity?.fixed ?? true);
  const [hasTime, setHasTime] = useState(activity ? activity.start != null : defaultStart != null);
  const [time, setTime] = useState(minutesToClock(activity?.start ?? defaultStart ?? 9 * 60));
  const [notes, setNotes] = useState(activity?.notes || '');
  const [fromTemplateItem, setFromTemplateItem] = useState(null);
  const [fromDictionaryItem, setFromDictionaryItem] = useState(null);
  const [linkTrackerId, setLinkTrackerId] = useState(activity?.link?.trackerId || '');
  const [linkItemId, setLinkItemId] = useState(activity?.link?.itemId || '');
  const [noteId, setNoteId] = useState(activity?.noteId || '');
  const [pickNote, setPickNote] = useState(false);
  const [repeat, setRepeat] = useState(() => (editingSeries && seriesRule ? ruleToRepeat(seriesRule) : defaultRepeat(dateKey || todayKey())));
  const [repeatError, setRepeatError] = useState('');

  if (!open) return null;

  function applyPreset(item) {
    setTitle(item.title);
    setIcon(item.icon);
    setCategoryId(item.categoryId);
    setPriority(item.priority);
    setDuration(item.duration);
    setFixed(item.fixed);
    if (item.start != null) {
      setHasTime(true);
      setTime(minutesToClock(item.start));
    } else {
      setHasTime(defaultStart != null);
    }
  }

  function applyTemplateItem(item) {
    setFromTemplateItem(item.id);
    applyPreset(item);
  }

  function applyDictionaryItem(item) {
    setFromDictionaryItem(item.id);
    applyPreset(item);
  }

  const templateActivities = [];
  const seenActivities = new Set();
  for (const t of templates || []) {
    for (const item of t.items) {
      const key = `${item.title.trim().toLowerCase()}|${item.icon}`;
      if (seenActivities.has(key)) continue;
      seenActivities.add(key);
      templateActivities.push(item);
    }
  }

  const isTemplateMode = showTemplatePicker && mode === 'template';
  const isDictionaryMode = showDictionaryPicker && mode === 'dictionary';
  const isPresetMode = isTemplateMode || isDictionaryMode;
  const pickedPreset = fromTemplateItem || fromDictionaryItem;
  const canLink = Boolean(trackers?.length);
  const linkable = canLink ? (trackerItems || []).filter((i) => i.trackerId === linkTrackerId && (!i.archived || i.id === linkItemId)) : [];
  const canSubmit = title.trim().length > 0;

  function pickLinkedItem(id) {
    setLinkItemId(id);
    const tracker = trackers.find((t) => t.id === linkTrackerId);
    const label = id ? itemLabel(id) : '';
    if (id && label) {
      setTitle(label);
      if (!isEdit && tracker?.icon) setIcon(tracker.icon);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    const showRepeat = allowRepeat && (!isEdit || editingSeries);
    if (showRepeat && repeat.mode !== 'never') {
      const problem = validateRepeat(repeat);
      if (problem) { setRepeatError(problem); return; }
    }
    onSubmit({
      ...(showRepeat ? { repeat: repeat.mode === 'never' ? null : repeat } : {}),
      ...(knowledge ? { noteId: noteId || null } : {}),
      ...(canLink ? { link: linkTrackerId && linkItemId ? { trackerId: linkTrackerId, itemId: linkItemId } : null } : {}),
      title: title.trim(),
      icon,
      categoryId,
      priority,
      duration: Number(duration) || 5,
      fixed,
      start: hasTime ? clockToMinutes(time) : null,
      notes,
    });
  }

  return (
    <>
    <Modal open={open} onClose={onClose}>
      <h3>{modalTitle || (isEdit ? 'Edit activity' : 'Add activity')}</h3>
      <form onSubmit={handleSubmit}>
        {(showDictionaryPicker || showTemplatePicker) && (
          <div className="field-group">
            <SegmentedControl
              value={mode}
              onChange={setMode}
              options={[
                ...(showDictionaryPicker ? [{ value: 'dictionary', label: 'From dictionary' }] : []),
                ...(showTemplatePicker ? [{ value: 'template', label: 'From template' }] : []),
                { value: 'new', label: 'New' },
              ]}
            />
          </div>
        )}

        {isDictionaryMode && (
          <div className="field-group">
            <div className="template-pick-items">
              {dictionary.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`template-pick-chip${fromDictionaryItem === item.id ? ' selected' : ''}`}
                  onClick={() => applyDictionaryItem(item)}
                >
                  <span className="icon-emoji">{item.icon}</span> {item.title}
                </button>
              ))}
            </div>
            {!fromDictionaryItem && <p className="template-pick-hint">Pick an activity above to continue.</p>}
          </div>
        )}

        {isTemplateMode && (
          <div className="field-group">
            <div className="template-pick-items">
              {templateActivities.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`template-pick-chip${fromTemplateItem === item.id ? ' selected' : ''}`}
                  onClick={() => applyTemplateItem(item)}
                >
                  <span className="icon-emoji">{item.icon}</span> {item.title}
                </button>
              ))}
            </div>
            {!fromTemplateItem && <p className="template-pick-hint">Pick an activity above to continue.</p>}
          </div>
        )}

        {!isPresetMode && (
          <>
            <div className="field-group">
              <label className="field-label" htmlFor="activity-title">Title</label>
              <TextInput id="activity-title" value={title} onChange={setTitle} placeholder="Running" autoFocus required />
            </div>

            <div className="field-group">
              <label className="field-label">Icon</label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>

            <div className="field-row">
              <div className="field-group">
                <label className="field-label" htmlFor="activity-category">Category</label>
                <Select
                  id="activity-category"
                  value={categoryId}
                  onChange={setCategoryId}
                  options={categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
                />
              </div>
            </div>
          </>
        )}

        {canLink && (!isPresetMode || pickedPreset) && (
          <div className="field-group">
            <label className="field-label" htmlFor="activity-link-tracker">Link to a tracker item (optional)</label>
            <div className="field-row">
              <Select
                id="activity-link-tracker"
                value={linkTrackerId}
                onChange={(v) => { setLinkTrackerId(v); setLinkItemId(''); }}
                options={trackers.map((t) => ({ value: t.id, label: `${t.icon} ${t.name}` }))}
                placeholder="No link"
              />
              {linkTrackerId && (
                <Select
                  value={linkItemId}
                  onChange={pickLinkedItem}
                  options={linkable.map((i) => ({ value: i.id, label: itemLabel(i.id) }))}
                  placeholder="Choose an item…"
                />
              )}
            </div>
          </div>
        )}

        {knowledge && (!isPresetMode || pickedPreset) && (
          <div className="field-group">
            <label className="field-label">Knowledge note (optional)</label>
            <div className="field-row">
              <button type="button" className="select-input note-link-btn" onClick={() => setPickNote(true)}>
                {noteId ? `📝 ${knowledge.titleOf(noteId)}` : 'Link a note…'}
              </button>
              {noteId && <button type="button" className="status-action-btn" style={{ flex: 'none' }} onClick={() => setNoteId('')}>Clear</button>}
            </div>
          </div>
        )}

        <div className="field-group">
          <label className="field-label">Priority</label>
          <SegmentedControl
            value={priority}
            onChange={setPriority}
            options={PRIORITIES.map((p) => ({ value: p.id, label: p.label, icon: p.icon }))}
          />
        </div>

        <div className="field-group">
          <label className="field-label">Duration</label>
          <div className="duration-presets">
            {DURATION_PRESETS.map((d) => (
              <button
                type="button"
                key={d}
                className={`duration-chip${Number(duration) === d ? ' selected' : ''}`}
                onClick={() => setDuration(d)}
              >
                {formatDuration(d)}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          <div className="field-group">
            <Checkbox checked={hasTime} onChange={setHasTime} label="Set a time" />
          </div>
          {hasTime && (
            <div className="field-group">
              <input type="time" className="time-input" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          )}
        </div>

        <div className="field-group">
          <Checkbox checked={fixed} onChange={setFixed} label="Fixed (exact time, not just a slot)" />
        </div>

        {allowRepeat && (!isEdit || editingSeries) && (!isPresetMode || pickedPreset) && (
          <>
            <RepeatPicker value={repeat} onChange={(r) => { setRepeat(r); setRepeatError(''); }} dateKey={dateKey || todayKey()} allowNever={!editingSeries} />
            {repeatError && <p className="repeat-error">{repeatError}</p>}
          </>
        )}
        {isEdit && seriesRule && !editingSeries && (
          <p className="repeat-note">🔁 {describeRule(seriesRule, formatDateDMY)} — saving asks whether to change this occurrence or the series.</p>
        )}

        <div className="field-group">
          <label className="field-label" htmlFor="activity-notes">Notes</label>
          <textarea
            id="activity-notes"
            className="field-input activity-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional notes"
          />
        </div>

        {isEdit && allowStatusActions && (
          <div className="activity-status-actions">
            <button type="button" className="status-action-btn good" onClick={() => onStatusChange('completed')}>
              <Check size={16} /> Complete
            </button>
            <button type="button" className="status-action-btn" onClick={() => onStatusChange('skipped')}>
              <XIcon size={16} /> Skip
            </button>
            <button type="button" className="status-action-btn" onClick={() => onStatusChange('planned')}>
              <RotateCcw size={16} /> Reset
            </button>
          </div>
        )}

        {isEdit && allowMoveToDay && (
          <div className="field-group move-to-day">
            <label className="field-label" htmlFor="activity-move"><CalendarClock size={14} /> Move to another day</label>
            <input
              id="activity-move"
              type="date"
              className="time-input"
              onChange={(e) => { if (e.target.value) onMoveToDay(e.target.value); }}
            />
          </div>
        )}

        <div className="app-modal-actions">
          {isEdit && (
            <Button type="button" variant="danger" size="small" onClick={onDelete}>
              <Trash2 size={16} />
            </Button>
          )}
          <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!canSubmit}>{isEdit ? 'Save' : 'Add'}</Button>
        </div>
      </form>
    </Modal>
    {pickNote && knowledge && (
      <NotePickerModal
        state={knowledge.state}
        title="Link a note"
        onPick={(n) => { setNoteId(n.id); if (!title.trim()) setTitle(n.title || ''); }}
        onClose={() => setPickNote(false)}
      />
    )}
    </>
  );
}
