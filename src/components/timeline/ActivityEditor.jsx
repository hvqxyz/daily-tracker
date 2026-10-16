import { useState } from 'react';
import { Trash2, Check, X as XIcon, RotateCcw, CalendarClock, ChevronLeft } from 'lucide-react';
import { Modal } from '../Modal.jsx';
import { Button } from '../buttons/Button.jsx';
import { TextInput } from '../inputs/TextInput.jsx';
import { Select } from '../inputs/Select.jsx';
import { Checkbox } from '../inputs/Checkbox.jsx';
import { IconPicker } from '../inputs/IconPicker.jsx';
import { categoryInfo } from '../../common/model.js';
import { RepeatPicker } from './RepeatPicker.jsx';
import { SeriesScopeChoices } from './SeriesScopeModal.jsx';
import { ActivityPicker } from '../library/ActivityPicker.jsx';
import { DurationField, FieldError, PriorityField, TimeFields } from './ActivityFields.jsx';
import { QuickFields } from '../../trackers/ui/ItemPreview.jsx';
import { defaultRepeat, describeRule, ruleToRepeat, validateRepeat } from '../../common/recurrence.js';
import {
  STEPS, backToPicker, createDraft, draftChanged, draftToSubmission, quickAddFields, selectDefinition, setField, setPicker, startNew, validateDraft,
} from '../../common/activity-draft.js';
import { NotePickerList } from '../../notes/ui/pickers.jsx';
import { formatDateDMY, formatDuration, todayKey } from '../../common/time.js';
import './ActivityEditor.css';
import './SeriesScopeModal.css';

/**
 * The one dialog for creating and editing scheduled activities.
 *
 * It stays open for the whole session: picking an activity, changing it,
 * creating a one-off, choosing a note to link and answering "this occurrence
 * or the series?" all happen inside it. `sessionKey` restarts the content
 * (e.g. switching from an occurrence to its whole series) without closing it.
 *
 * Steps (common/activity-draft.js STEPS): PICK_ACTIVITY → EDIT_ACTIVITY or
 * CREATE_ACTIVITY; EDIT_EXISTING for an activity already on the timeline.
 * Library definitions themselves are only edited in Settings → Activity Library.
 *
 * onSubmit(fields, { saveToLibrary, scope }) — `fields` carries `activityId`
 * (the library definition, or null) and, where repeat applies, `repeat`;
 * `scope` ('occurrence' | 'following' | 'series') only for a recurring occurrence.
 * onDelete({ scope }) · onStatusChange(status, unsavedFields | null)
 */
export function ActivityEditor({ open, onClose, sessionKey, ...props }) {
  if (!open) return null;
  return (
    <Modal open onClose={onClose} className="activity-editor-modal">
      <ActivityEditorBody key={sessionKey} onClose={onClose} {...props} />
    </Modal>
  );
}

function ActivityEditorBody({
  onClose,
  activity,
  preset = null, // a resolved recent entry to start from
  categories,
  dictionary = [],
  templates = [],
  recent = [],
  trackers,
  trackerItems,
  itemLabel,
  knowledge,
  defaultStart,
  explicitSlot = false, // the user clicked this time on the timeline
  recurringOnly = false, // creating a recurring to-do: picks open the form and repeat can't be "never"
  dateKey,
  allowRepeat = false,
  seriesRule = null,
  editingSeries = false,
  series = null, // { text, paused } for an occurrence of a recurring activity
  onEditSeries,
  onTogglePause,
  linked = null, // { item, tracker } — live progress of the linked tracker item
  onOpenNote,
  onSubmit,
  onDelete,
  onStatusChange,
  onMoveToDay,
  allowStatusActions = true,
  allowMoveToDay = true,
  title: modalTitle,
}) {
  const isEdit = Boolean(activity);
  const ctx = { categories, defaultStart, explicitSlot };
  const [initial] = useState(() => createDraft({ activity, preset, dictionary, ...ctx }));
  const [draft, setDraft] = useState(initial);
  const [panel, setPanel] = useState(null); // null | 'note' | { scope: 'edit', payload, saveToLibrary } | { scope: 'delete' }
  const [beforePick, setBeforePick] = useState(null); // the form as it was before "Change", for Back
  const [repeat, setRepeat] = useState(() => {
    if (editingSeries && seriesRule) return ruleToRepeat(seriesRule);
    const base = defaultRepeat(dateKey || todayKey());
    return recurringOnly ? { ...base, mode: 'daily' } : base;
  });
  const [repeatError, setRepeatError] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  const set = (name) => (value) => setDraft((d) => setField(d, name, value));
  const canLink = Boolean(trackers?.length);
  const submitOpts = { canLink, knowledge: Boolean(knowledge) };
  const linkable = canLink ? (trackerItems || []).filter((i) => i.trackerId === draft.linkTrackerId && (!i.archived || i.id === draft.linkItemId)) : [];
  const errors = validateDraft(draft, { dictionary });
  const visibleErrors = showErrors ? errors : {};
  const showRepeat = allowRepeat && (!isEdit || editingSeries);
  const asksScope = isEdit && Boolean(seriesRule) && !editingSeries;
  const def = draft.activityId ? dictionary.find((d) => d.id === draft.activityId) : null;

  // Adding: a pick is added straight away with its defaults (click it on the
  // timeline afterwards to fine-tune). Editing: a pick goes back to the form.
  function choose(picked) {
    // (a recurring to-do always goes to the form: its repeat has to be set)
    const fields = !isEdit && !recurringOnly && quickAddFields(picked, { dictionary, ...submitOpts });
    if (fields) {
      onSubmit({ ...(showRepeat ? { repeat: null } : {}), ...fields }, { saveToLibrary: false });
      return;
    }
    setDraft(picked);
    setBeforePick(null);
    setShowErrors(false);
  }

  function pick(definition) {
    choose(selectDefinition(draft, definition, ctx));
  }

  function goNew(title = '') {
    setDraft((d) => startNew(d, ctx, title));
    setBeforePick(null);
    setShowErrors(false);
  }

  function change() {
    setBeforePick(draft);
    setDraft(backToPicker);
  }

  function pickLinkedItem(id) {
    setDraft((d) => {
      let next = setField(d, 'linkItemId', id);
      const label = id ? itemLabel(id) : '';
      // a one-off takes its name from the linked item; a library activity keeps its own
      if (id && label && (d.step === STEPS.CREATE_ACTIVITY || d.step === STEPS.EDIT_EXISTING)) {
        next = setField(next, 'title', label);
        const tracker = trackers.find((t) => t.id === d.linkTrackerId);
        if (d.step === STEPS.CREATE_ACTIVITY && tracker?.icon) next = setField(next, 'icon', tracker.icon);
      }
      return next;
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (Object.keys(errors).length) { setShowErrors(true); return; }
    if (showRepeat && repeat.mode !== 'never') {
      const problem = validateRepeat(repeat);
      if (problem) { setRepeatError(problem); return; }
    }
    const { fields, saveToLibrary } = draftToSubmission(draft, submitOpts);
    const payload = { ...(showRepeat ? { repeat: repeat.mode === 'never' ? null : repeat } : {}), ...fields };
    if (asksScope) setPanel({ scope: 'edit', payload, saveToLibrary });
    else onSubmit(payload, { saveToLibrary });
  }

  function handleDelete() {
    if (asksScope) setPanel({ scope: 'delete' });
    else onDelete({});
  }

  function handleStatus(status) {
    // marking it done / skipped also keeps what was edited on this occurrence
    const unsaved = !Object.keys(errors).length && draftChanged(initial, draft, submitOpts) ? draftToSubmission(draft, submitOpts).fields : null;
    onStatusChange(status, unsaved);
  }

  // Panels shown in place of the form, inside the same dialog.
  if (panel === 'note') {
    return (
      <>
        <h3>Link a note</h3>
        <NotePickerList
          state={knowledge.state}
          onPick={(n) => {
            setDraft((d) => {
              const next = setField(d, 'noteId', n.id);
              return !String(d.title).trim() ? setField(next, 'title', n.title || '') : next;
            });
            setPanel(null);
          }}
          onCancel={() => setPanel(null)}
        />
      </>
    );
  }
  if (panel?.scope) {
    return (
      <SeriesScopeChoices
        kind={panel.scope}
        onCancel={() => setPanel(null)}
        onChoose={(scope) => (panel.scope === 'edit' ? onSubmit(panel.payload, { saveToLibrary: panel.saveToLibrary, scope }) : onDelete({ scope }))}
      />
    );
  }

  const heading = modalTitle || (isEdit ? (draft.step === STEPS.PICK_ACTIVITY ? 'Change activity' : 'Edit activity') : draft.step === STEPS.CREATE_ACTIVITY ? 'New activity' : 'Add activity');

  if (draft.step === STEPS.PICK_ACTIVITY) {
    return (
      <>
        <h3>{heading}</h3>
        <ActivityPicker
          library={dictionary}
          categories={categories}
          templates={templates}
          recent={recent}
          filters={draft.picker}
          onFiltersChange={(patch) => setDraft((d) => setPicker(d, patch))}
          onPick={pick}
          onPickRecent={(entry) => choose({ ...createDraft({ preset: entry, dictionary, ...ctx }), stash: draft.stash, picker: draft.picker })}
          onCreate={goNew}
          createLabel={isEdit ? 'Edit details as a one-off' : undefined}
        />
        <div className="app-modal-actions">
          {beforePick ? (
            <Button type="button" variant="subtle" onClick={() => { setDraft({ ...beforePick, picker: draft.picker }); setBeforePick(null); }}>
              <ChevronLeft size={16} /> Back
            </Button>
          ) : (
            <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
          )}
        </div>
      </>
    );
  }

  const cat = categoryInfo(categories, draft.categoryId);
  const hasExtras = Boolean(draft.notes || draft.linkItemId || draft.noteId);
  // Editing an activity on the timeline: the summary card says when / how long,
  // so the scheduling fields live under More options (opened if they need fixing).
  const collapseScheduling = isEdit && !editingSeries;
  const schedulingError = Boolean(visibleErrors.duration || visibleErrors.time);
  const schedulingFields = (
    <>
      <PriorityField value={draft.priority} onChange={set('priority')} />
      <DurationField value={draft.duration} onChange={set('duration')} error={visibleErrors.duration} />
      <TimeFields hasTime={draft.hasTime} time={draft.time} onHasTime={set('hasTime')} onTime={set('time')} error={visibleErrors.time} />
      <div className="field-group">
        <Checkbox checked={draft.fixed} onChange={set('fixed')} label="Fixed (exact time, not just a slot)" />
      </div>
    </>
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h3>{heading}</h3>
      {visibleErrors.form && <p className="form-error" role="alert">{visibleErrors.form}</p>}

      {(draft.step === STEPS.EDIT_ACTIVITY || draft.step === STEPS.EDIT_EXISTING) && (
        <div className="lib-summary">
          <span className="lib-row-icon icon-emoji">{draft.icon}</span>
          <span className="lib-row-info">
            <span className="lib-row-title">{draft.title}{def && <span className="lib-badge">Library</span>}</span>
            <span className="lib-row-meta">
              {cat?.icon} {cat?.name}
              {draft.step === STEPS.EDIT_ACTIVITY && !def && ' · no longer in the library'}
              {isEdit && draft.hasTime && <> · {draft.time}</>}
              {isEdit && Number(draft.duration) > 0 && <> · {formatDuration(Number(draft.duration))}</>}
            </span>
          </span>
          <button type="button" className="lib-link-btn" onClick={change}>Change</button>
        </div>
      )}

      {draft.step === STEPS.CREATE_ACTIVITY && (
        <button type="button" className="lib-link-btn lib-back" onClick={() => setDraft(backToPicker)}>
          <ChevronLeft size={15} /> Choose from library
        </button>
      )}

      {isEdit && !editingSeries && (
        <>
          {allowStatusActions && onStatusChange && (
            <div className="activity-status-actions">
              <button type="button" className="status-action-btn good" onClick={() => handleStatus('completed')}>
                <Check size={16} /> Done
              </button>
              <button type="button" className="status-action-btn" onClick={() => handleStatus('skipped')}>
                <XIcon size={16} /> Skip
              </button>
              <button type="button" className="status-action-btn" onClick={() => handleStatus('planned')}>
                <RotateCcw size={16} /> Reset
              </button>
            </div>
          )}
          {series && (
            <div className="quick-series">
              <span className="quick-series-text">🔁 {series.text}</span>
              <div className="quick-series-actions">
                {onEditSeries && <button type="button" className="trk-link-btn" onClick={onEditSeries}>Edit series</button>}
                {onTogglePause && <button type="button" className="trk-link-btn" onClick={onTogglePause}>{series.paused ? 'Resume' : 'Pause'}</button>}
              </div>
            </div>
          )}
          {linked && (
            <div className="quick-progress">
              <p className="trk-linked">🔗 {linked.tracker.icon} {itemLabel(linked.item.id)}</p>
              <QuickFields tracker={linked.tracker} item={linked.item} />
            </div>
          )}
        </>
      )}

      {draft.step === STEPS.CREATE_ACTIVITY && (
        <>
          <div className="field-group">
            <label className="field-label" htmlFor="activity-title">Title</label>
            <TextInput id="activity-title" value={draft.title} onChange={set('title')} placeholder="Running" autoFocus={draft.step === STEPS.CREATE_ACTIVITY} required />
            <FieldError>{visibleErrors.title}</FieldError>
          </div>
          <div className="field-group">
            <span className="field-label">Icon</span>
            <IconPicker value={draft.icon} onChange={set('icon')} />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="activity-category">Category</label>
            <Select
              id="activity-category"
              value={draft.categoryId}
              onChange={set('categoryId')}
              options={categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
            />
          </div>
        </>
      )}

      {!collapseScheduling && schedulingFields}

      {showRepeat && (
        <>
          <RepeatPicker value={repeat} onChange={(r) => { setRepeat(r); setRepeatError(''); }} dateKey={dateKey || todayKey()} allowNever={!editingSeries && !recurringOnly} />
          {repeatError && <p className="repeat-error" role="alert">{repeatError}</p>}
        </>
      )}
      {asksScope && (
        <p className="repeat-note">🔁 {describeRule(seriesRule, formatDateDMY)} — saving asks whether to change this occurrence or the series.</p>
      )}

      <details className="more-options" open={(collapseScheduling ? schedulingError : hasExtras) || undefined}>
        <summary>More options{hasExtras ? ' ·' : ''}{draft.notes ? ' notes' : ''}{draft.linkItemId ? ' link' : ''}{draft.noteId ? ' note' : ''}</summary>
        {collapseScheduling && schedulingFields}
        {canLink && (
          <div className="field-group">
            <label className="field-label" htmlFor="activity-link-tracker">Link to a tracker item</label>
            <div className="field-row">
              <Select
                id="activity-link-tracker"
                value={draft.linkTrackerId}
                onChange={(v) => setDraft((d) => setField(setField(d, 'linkTrackerId', v), 'linkItemId', ''))}
                options={trackers.map((t) => ({ value: t.id, label: `${t.icon} ${t.name}` }))}
                placeholder="No link"
              />
              {draft.linkTrackerId && (
                <Select
                  value={draft.linkItemId}
                  onChange={pickLinkedItem}
                  options={linkable.map((i) => ({ value: i.id, label: itemLabel(i.id) }))}
                  placeholder="Choose an item…"
                />
              )}
            </div>
          </div>
        )}
        {knowledge && (
          <div className="field-group">
            <span className="field-label">Knowledge note</span>
            <div className="field-row">
              <button type="button" className="select-input note-link-btn" onClick={() => setPanel('note')}>
                {draft.noteId ? `📝 ${knowledge.titleOf(draft.noteId)}` : 'Link a note…'}
              </button>
              {draft.noteId && onOpenNote && <button type="button" className="status-action-btn" style={{ flex: 'none' }} onClick={() => onOpenNote(draft.noteId)}>Open</button>}
              {draft.noteId && <button type="button" className="status-action-btn" style={{ flex: 'none' }} onClick={() => set('noteId')('')}>Clear</button>}
            </div>
          </div>
        )}
        <div className="field-group">
          <label className="field-label" htmlFor="activity-notes">Notes</label>
          <textarea
            id="activity-notes"
            className="field-input activity-notes"
            value={draft.notes}
            onChange={(e) => set('notes')(e.target.value)}
            rows={2}
            placeholder="Optional notes"
          />
        </div>
      </details>

      {draft.step === STEPS.CREATE_ACTIVITY && (
        <div className="field-group">
          <Checkbox checked={draft.saveToLibrary} onChange={set('saveToLibrary')} label="Save to Activity Library for next time" />
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
        {isEdit && onDelete && (
          <Button type="button" variant="danger" size="small" onClick={handleDelete} aria-label="Delete activity">
            <Trash2 size={16} />
          </Button>
        )}
        <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">{isEdit ? 'Save' : 'Add'}</Button>
      </div>
    </form>
  );
}
