import { useState } from 'react';
import { ChevronDown, ChevronUp, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../Modal.jsx';
import { Button } from '../buttons/Button.jsx';
import { TextInput } from '../inputs/TextInput.jsx';
import { IconPicker } from '../inputs/IconPicker.jsx';
import { Checkbox } from '../inputs/Checkbox.jsx';
import { SegmentedControl } from '../inputs/SegmentedControl.jsx';
import { ActivityPicker } from '../library/ActivityPicker.jsx';
import { LibraryActivityEditor } from '../library/LibraryActivityEditor.jsx';
import { FieldError } from '../timeline/ActivityFields.jsx';
import {
  useStore, addTemplate, updateTemplate, addDictionaryItem, newTemplateItemId,
} from '../../common/store.js';
import { categoryInfo, PRIORITIES } from '../../common/model.js';
import { MAX_DURATION, MIN_DURATION } from '../../common/activity-draft.js';
import { libraryById, moveItem, resolveTemplateItem, templateItemFor } from '../../common/library.js';
import { clockToMinutes, formatDuration, minutesToClock } from '../../common/time.js';
import '../library/library.css';
import './TemplateEditor.css';

/**
 * Create / edit a template: an ordered list of Activity Library activities,
 * each with this template's own time, duration, priority and fixed setting.
 * Changes are kept in a draft until Save. Removing a row never touches the
 * library; an activity that isn't in the library yet is created there first.
 */
export function TemplateEditor({ templateId = null, categories, onClose }) {
  const state = useStore();
  const original = templateId ? state.templates.find((t) => t.id === templateId) : null;
  const [draft, setDraft] = useState(() => (original
    ? { name: original.name, icon: original.icon, items: original.items }
    : { name: '', icon: '📋', items: [] }));
  const [dirty, setDirty] = useState(false);
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(null); // { title } — new library activity to add
  const [expanded, setExpanded] = useState(null); // item id showing its extra options
  const [showErrors, setShowErrors] = useState(false);

  if (templateId && !original) return null;

  const byId = libraryById(state.activityDictionary);
  const resolved = draft.items.map((it) => resolveTemplateItem(it, byId));
  const totalMinutes = resolved.reduce((s, r) => s + (Number(r.duration) || 0), 0);
  const durationErrors = new Set(draft.items.filter((it) => {
    const n = Number(it.duration);
    return !Number.isFinite(n) || n < MIN_DURATION || n > MAX_DURATION;
  }).map((it) => it.id));
  const nameError = !draft.name.trim() ? 'Give the template a name.' : '';

  function change(patch) {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  }
  const setItems = (fn) => change({ items: fn(draft.items) });
  const patchItem = (id, patch) => setItems((items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  function addFromLibrary(def) {
    setItems((items) => [...items, templateItemFor(def, items, newTemplateItemId())]);
    setPicking(false);
  }

  function restoreToLibrary(item) {
    // the reference stays the same; the definition comes back from the snapshot
    addDictionaryItem({ id: item.activityId, ...item.snapshot, priority: item.priority, duration: Number(item.duration) || 30, fixed: item.fixed !== false });
  }

  function handleSave() {
    if (nameError || durationErrors.size) { setShowErrors(true); return; }
    const items = draft.items.map((it) => {
      const def = byId.get(it.activityId);
      // the snapshot is only a fallback; keep it in line with the definition as saved
      return { ...it, duration: Math.round(Number(it.duration)), ...(def ? { snapshot: { title: def.title, icon: def.icon, categoryId: def.categoryId } } : {}) };
    });
    const data = { name: draft.name.trim(), icon: draft.icon, items };
    if (original) updateTemplate(original.id, data);
    else addTemplate(data);
    onClose();
  }

  function handleCancel() {
    if (dirty && !window.confirm('Discard your changes to this template?')) return;
    onClose();
  }

  return (
    <>
      <Modal open onClose={handleCancel} className="template-editor-modal">
        <h3>{original ? 'Edit template' : 'Create template'}</h3>

        <div className="field-group">
          <label className="field-label" htmlFor="template-name">Name</label>
          <TextInput id="template-name" value={draft.name} onChange={(name) => change({ name })} placeholder="Work day" autoFocus={!original} />
          <FieldError>{showErrors && nameError}</FieldError>
        </div>
        <div className="field-group">
          <span className="field-label">Icon</span>
          <IconPicker value={draft.icon} onChange={(icon) => change({ icon })} />
        </div>

        <span className="field-label">Activities</span>
        {draft.items.length > 0 && (
          <p className="tpl-summary">{draft.items.length} {draft.items.length === 1 ? 'activity' : 'activities'} · {formatDuration(totalMinutes)}</p>
        )}
        <div className="tpl-rows">
          {draft.items.length === 0 && <div className="empty-state">No activities yet — add them from your Activity Library.</div>}
          {draft.items.map((item, index) => {
            const r = resolved[index];
            const cat = r.categoryId ? categoryInfo(categories, r.categoryId) : null;
            const open = expanded === item.id;
            return (
              <div key={item.id} className={`tpl-row${r.missing ? ' missing' : ''}`}>
                <div className="tpl-row-main">
                  <div className="tpl-order">
                    <button type="button" className="tpl-icon-btn" aria-label={`Move ${r.title} up`} disabled={index === 0} onClick={() => setItems((items) => moveItem(items, index, -1))}><ChevronUp size={14} /></button>
                    <button type="button" className="tpl-icon-btn" aria-label={`Move ${r.title} down`} disabled={index === draft.items.length - 1} onClick={() => setItems((items) => moveItem(items, index, 1))}><ChevronDown size={14} /></button>
                  </div>
                  <span className="lib-row-icon icon-emoji">{r.icon}</span>
                  <span className="lib-row-info">
                    <span className="lib-row-title">{r.title}{r.missing && <span className="lib-badge warn">Not in library</span>}</span>
                    {cat && <span className="lib-row-meta">{cat.icon} {cat.name}</span>}
                  </span>
                  <input
                    type="time"
                    className="time-input tpl-time"
                    aria-label={`Start time of ${r.title} (empty = flexible)`}
                    value={item.start != null ? minutesToClock(item.start) : ''}
                    onChange={(e) => patchItem(item.id, { start: e.target.value ? clockToMinutes(e.target.value) : null })}
                  />
                  <input
                    type="number"
                    className="number-input tpl-duration"
                    aria-label={`Duration of ${r.title} in minutes`}
                    aria-invalid={showErrors && durationErrors.has(item.id)}
                    min={MIN_DURATION}
                    max={MAX_DURATION}
                    step={5}
                    value={item.duration}
                    onChange={(e) => patchItem(item.id, { duration: e.target.value })}
                  />
                  <span className="tpl-unit">min</span>
                  <button type="button" className="tpl-icon-btn tall" aria-label={`More options for ${r.title}`} aria-expanded={open} onClick={() => setExpanded(open ? null : item.id)}>
                    <MoreHorizontal size={16} />
                  </button>
                </div>
                {showErrors && durationErrors.has(item.id) && (
                  <FieldError>{`Duration must be between ${MIN_DURATION} minutes and 24 hours.`}</FieldError>
                )}
                {open && (
                  <div className="tpl-row-more">
                    <SegmentedControl value={item.priority} onChange={(priority) => patchItem(item.id, { priority })} options={PRIORITIES.map((p) => ({ value: p.id, label: p.label, icon: p.icon }))} />
                    <Checkbox checked={item.fixed !== false} onChange={(fixed) => patchItem(item.id, { fixed })} label="Fixed time" />
                    {r.missing && item.snapshot && (
                      <button type="button" className="lib-link-btn" onClick={() => restoreToLibrary(item)}>Restore to library</button>
                    )}
                    <button type="button" className="tpl-remove" onClick={() => { setItems((items) => items.filter((it) => it.id !== item.id)); setExpanded(null); }}>
                      <Trash2 size={14} /> Remove from template
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Button variant="secondary" onClick={() => setPicking(true)}>
          <Plus size={16} /> Add activity from library
        </Button>

        <div className="app-modal-actions">
          <Button variant="subtle" onClick={handleCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>{original ? 'Save' : 'Create template'}</Button>
        </div>
      </Modal>

      {picking && (
        <Modal open onClose={() => setPicking(false)}>
          <h3>Add from library</h3>
          <ActivityPicker
            library={state.activityDictionary}
            categories={categories}
            onPick={addFromLibrary}
            onCreate={(title) => { setPicking(false); setCreating({ title }); }}
            createLabel="New library activity"
          />
          <div className="app-modal-actions">
            <Button variant="subtle" onClick={() => setPicking(false)}>Cancel</Button>
          </div>
        </Modal>
      )}

      {creating && (
        <LibraryActivityEditor
          initialTitle={creating.title}
          categories={categories}
          onClose={() => setCreating(null)}
          onSubmit={(fields) => {
            const def = addDictionaryItem(fields);
            setItems((items) => [...items, templateItemFor(def, items, newTemplateItemId())]);
            setCreating(null);
          }}
        />
      )}
    </>
  );
}
