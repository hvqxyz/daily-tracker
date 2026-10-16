import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '../Modal.jsx';
import { Button } from '../buttons/Button.jsx';
import { TextInput } from '../inputs/TextInput.jsx';
import { Select } from '../inputs/Select.jsx';
import { Checkbox } from '../inputs/Checkbox.jsx';
import { IconPicker } from '../inputs/IconPicker.jsx';
import { DurationField, FieldError, PriorityField, TimeFields } from '../timeline/ActivityFields.jsx';
import { MAX_DURATION, MIN_DURATION } from '../../common/activity-draft.js';
import { clockToMinutes, minutesToClock } from '../../common/time.js';
import './library.css';

/**
 * Create / edit an Activity Library definition: what the activity is and the
 * defaults it starts with. Editing it changes future uses and the templates
 * that reference it — never activities already scheduled.
 */
export function LibraryActivityEditor({ definition = null, initialTitle = '', categories, usage = null, onSubmit, onDelete, onClose }) {
  const [title, setTitle] = useState(definition?.title ?? initialTitle);
  const [icon, setIcon] = useState(definition?.icon || '📌');
  const [categoryId, setCategoryId] = useState(definition?.categoryId || categories[0]?.id);
  const [priority, setPriority] = useState(definition?.priority || 'required');
  const [duration, setDuration] = useState(definition?.duration ?? 30);
  const [fixed, setFixed] = useState(definition?.fixed ?? true);
  const [hasTime, setHasTime] = useState(definition?.start != null);
  const [time, setTime] = useState(minutesToClock(definition?.start ?? 9 * 60));
  const [showErrors, setShowErrors] = useState(false);

  const n = Number(duration);
  const errors = {
    ...(!title.trim() ? { title: 'Give the activity a title.' } : {}),
    ...(!Number.isFinite(n) || n < MIN_DURATION || n > MAX_DURATION ? { duration: `Duration must be between ${MIN_DURATION} minutes and 24 hours.` } : {}),
  };
  const visible = showErrors ? errors : {};

  function handleSubmit(e) {
    e.preventDefault();
    if (Object.keys(errors).length) { setShowErrors(true); return; }
    onSubmit({
      title: title.trim(),
      icon,
      categoryId,
      priority,
      duration: Math.round(n),
      fixed,
      start: hasTime ? clockToMinutes(time) : null,
    });
  }

  return (
    <Modal open onClose={onClose}>
      <h3>{definition ? 'Edit library activity' : 'New library activity'}</h3>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label className="field-label" htmlFor="lib-title">Title</label>
          <TextInput id="lib-title" value={title} onChange={setTitle} placeholder="Deep Work" autoFocus required />
          <FieldError>{visible.title}</FieldError>
        </div>
        <div className="field-group">
          <span className="field-label">Icon</span>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="lib-category">Category</label>
          <Select id="lib-category" value={categoryId} onChange={setCategoryId} options={categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
        </div>
        <PriorityField value={priority} onChange={setPriority} label="Default priority" />
        <DurationField value={duration} onChange={setDuration} error={visible.duration} label="Default duration" id="lib-duration" />
        <TimeFields hasTime={hasTime} time={time} onHasTime={setHasTime} onTime={setTime} checkboxLabel="Default time" />
        <div className="field-group">
          <Checkbox checked={fixed} onChange={setFixed} label="Fixed by default (exact time, not just a slot)" />
        </div>
        {definition && usage && (usage.templates.length > 0 || usage.scheduled > 0) && (
          <p className="lib-hint">
            {usage.templates.length > 0 && <>Used in {usage.templates.map((t) => t.name).join(', ')} — templates show your changes. </>}
            Already scheduled activities keep their own details.
          </p>
        )}
        <div className="app-modal-actions">
          {definition && onDelete && (
            <Button type="button" variant="danger" size="small" onClick={onDelete} aria-label="Delete library activity">
              <Trash2 size={16} />
            </Button>
          )}
          <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{definition ? 'Save' : 'Add to library'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Confirms deleting a definition, listing every template that uses it. */
export function DeleteActivityDialog({ definition, usage, onConfirm, onClose }) {
  const { templates, scheduled, recurrences } = usage;
  const uses = templates.reduce((sum, t) => sum + t.count, 0);
  return (
    <Modal open onClose={onClose} role="alertdialog" aria-labelledby="delete-activity-title">
      <h3 id="delete-activity-title">Delete “{definition.icon} {definition.title}”?</h3>
      {templates.length > 0 ? (
        <div className="delete-refs">
          It will be removed from {templates.length === 1 ? 'this template' : `these ${templates.length} templates`}:
          <ul>
            {templates.map((t) => (
              <li key={t.id}>{t.icon} {t.name}{t.count > 1 ? ` (${t.count}×)` : ''}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="delete-kept">No template uses it.</p>
      )}
      {(scheduled > 0 || recurrences > 0) && (
        <p className="delete-kept">
          {[scheduled > 0 && `${scheduled} scheduled ${scheduled === 1 ? 'activity' : 'activities'}`, recurrences > 0 && `${recurrences} recurring ${recurrences === 1 ? 'activity' : 'activities'}`].filter(Boolean).join(' and ')}
          {scheduled + recurrences === 1 ? ' keeps its own copy and is not changed.' : ' keep their own copy and are not changed.'}
        </p>
      )}
      <div className="app-modal-actions">
        <Button type="button" variant="subtle" onClick={onClose} autoFocus>Cancel</Button>
        <Button type="button" variant="danger" onClick={onConfirm}>
          {uses > 0 ? `Remove from ${templates.length === 1 ? 'template' : 'templates'} & delete` : 'Delete'}
        </Button>
      </div>
    </Modal>
  );
}
