import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal.jsx';
import { Button } from '../../components/buttons/Button.jsx';
import { TextInput } from '../../components/inputs/TextInput.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { Checkbox } from '../../components/inputs/Checkbox.jsx';
import { IconPicker } from '../../components/inputs/IconPicker.jsx';
import { FieldEditor } from './FieldEditor.jsx';
import { addTracker, addTrackerTemplate, deleteTracker, saveTracker } from '../tracker-store.js';
import { FIELD_GROUPS, FIELD_TYPES, createField, createOption, typeInfo } from '../engine/fieldTypes.js';
import { convertField, createView, moveInList, newTracker, removeFieldFromTracker, VIEW_TYPES } from '../engine/schema.js';
import { blueprintFromTracker, instantiateTemplate } from '../templates.js';
import { titleField } from '../engine/data.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

// A blank tracker starts with one text field so items have a name; it can be renamed or removed.
function blankTracker(base = {}) {
  const t = newTracker({ name: base.name || '', icon: base.icon || '📋' });
  t.fields.push(createField('text', 'Name', { required: true }));
  return t;
}

// Ready-made field configurations offered as shortcuts. They are ordinary
// fields; nothing about them is special once added.
const withFirstOptionDefault = (field) => ({ ...field, default: field.config.options[0]?.id ?? null });

const FIELD_PRESETS = [
  { label: '+ Status', make: () => withFirstOptionDefault(createField('select', 'Status', { required: true, config: { options: [createOption('Planned', { icon: '⚪' }), createOption('In Progress', { icon: '🔵', color: '#3682e0' }), createOption('Done', { icon: '🟢', color: '#199e70', done: true })] } })) },
  { label: '+ Category', make: () => createField('select', 'Category', { config: { allowCustom: true, options: [createOption('Personal', { color: '#3682e0' }), createOption('Work', { color: '#d0733b' }), createOption('Other')] } }) },
  { label: '+ Priority', make: () => createField('select', 'Priority', { config: { options: [createOption('High', { color: '#d03b3b' }), createOption('Medium', { color: '#c99a2e' }), createOption('Low', { color: '#199e70' })] } }) },
  { label: '+ Progress', make: () => createField('progress', 'Progress') },
  { label: '+ Dates', make: () => createField('date', 'Date') },
  { label: '+ Notes', make: () => createField('longtext', 'Notes') },
];

export function TrackerBuilder({ mode, tracker, trackers, allItems, state, userTemplates, builtinTemplates, initialFieldId = null, onClose, onSaved }) {
  const isEdit = mode === 'edit';
  const [draft, setDraft] = useState(() => (isEdit ? clone(tracker) : blankTracker()));
  const [builtItems, setBuiltItems] = useState([]);
  const [transforms, setTransforms] = useState({});
  const [page, setPage] = useState(initialFieldId);
  const [templateKey, setTemplateKey] = useState('');
  const [withSamples, setWithSamples] = useState(false);
  const [viewTypes, setViewTypes] = useState(['table']);
  const [typePicker, setTypePicker] = useState(false);
  const [error, setError] = useState('');

  const templates = [...builtinTemplates, ...userTemplates];
  const chosenTemplate = templates.find((t) => t.key === templateKey);
  const patchDraft = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const patchSettings = (patch) => setDraft((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const patchActivity = (patch) => setDraft((d) => ({ ...d, settings: { ...d.settings, activity: { ...d.settings.activity, ...patch } } }));
  const setFields = (fields) => setDraft((d) => ({ ...d, fields }));
  const savedField = (id) => (isEdit ? tracker.fields.find((f) => f.id === id) : null);
  const editing = page ? draft.fields.find((f) => f.id === page) : null;

  const allTrackers = useMemo(() => {
    const others = trackers.filter((t) => t.id !== draft.id);
    return [...others, draft];
  }, [trackers, draft]);

  function pickTemplate(key) {
    setTemplateKey(key);
    if (!key) {
      setDraft(blankTracker(draft));
      setBuiltItems([]);
      return;
    }
    const bp = templates.find((t) => t.key === key);
    const built = instantiateTemplate(bp, { withSamples });
    setDraft(built.tracker);
    setBuiltItems(built.items);
  }

  function toggleSamples(on) {
    setWithSamples(on);
    if (chosenTemplate) {
      const built = instantiateTemplate(chosenTemplate, { withSamples: on });
      setDraft(built.tracker);
      setBuiltItems(built.items);
    }
  }

  function addFieldOfType(type) {
    const field = createField(type, typeInfo(type).label);
    if (typeInfo(type).kind === 'select') field.config.options = [createOption('Option 1'), createOption('Option 2')];
    setFields([...draft.fields, field]);
    setTypePicker(false);
    setPage(field.id);
  }

  const patchField = (id, patch) => setFields(draft.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const patchConfig = (id, patch) => setFields(draft.fields.map((f) => (f.id === id ? { ...f, config: { ...f.config, ...patch } } : f)));

  function changeType(id, newType) {
    const current = draft.fields.find((f) => f.id === id);
    if (!current || current.type === newType) return;
    const original = savedField(id);
    if (original) {
      const conv = convertField({ ...original, name: current.name, required: current.required }, newType);
      if (!conv) return;
      setFields(draft.fields.map((f) => (f.id === id ? { ...conv.field, default: null } : f)));
      setTransforms((t) => (newType === original.type ? Object.fromEntries(Object.entries(t).filter(([k]) => k !== id)) : { ...t, [id]: conv.convertValue }));
    } else {
      const fresh = createField(newType, current.name, { required: current.required });
      fresh.id = current.id;
      if (typeInfo(newType).kind === 'select') fresh.config.options = current.config.options?.length ? current.config.options : [createOption('Option 1'), createOption('Option 2')];
      setFields(draft.fields.map((f) => (f.id === id ? fresh : f)));
    }
  }

  function removeField(id) {
    const label = draft.fields.find((f) => f.id === id)?.name;
    if (isEdit && savedField(id) && !window.confirm(`Delete field "${label}"? Its values will be removed from every item.`)) return;
    setDraft((d) => removeFieldFromTracker(d, id));
    setPage(null);
  }

  function validate() {
    if (!draft.name.trim()) return 'Give the tracker a name.';
    if (draft.fields.length === 0) return 'Add at least one field.';
    const bad = draft.fields.find((f) => f.type === 'relation' && !f.config.targetTrackerId);
    if (bad) return `Choose which tracker the relation field "${bad.name}" links to.`;
    return '';
  }

  function handleSave() {
    const problem = validate();
    if (problem) { setError(problem); return; }
    let next = { ...draft, name: draft.name.trim() };
    if (!next.settings.titleFieldId) next = { ...next, settings: { ...next.settings, titleFieldId: titleField(next)?.id ?? null } };

    if (isEdit) {
      saveTracker(next, transforms);
      onSaved?.(next.id);
      onClose();
      return;
    }
    if (next.views.length === 0) {
      const types = viewTypes.length ? viewTypes : ['table'];
      next = { ...next, views: types.map((type) => createView(next, type, type === 'table' ? 'All items' : undefined)) };
    }
    next.settings = { ...next.settings, defaultViewId: next.views[0].id, allowHierarchy: next.settings.allowHierarchy || viewTypes.includes('hierarchy') };
    addTracker(next, builtItems);
    onSaved?.(next.id);
    onClose();
  }

  function handleDelete() {
    const count = allItems.filter((i) => i.trackerId === tracker.id).length;
    if (!window.confirm(`Delete "${tracker.name}" and its ${count} item${count === 1 ? '' : 's'}? This cannot be undone.`)) return;
    deleteTracker(tracker.id);
    onSaved?.(null);
    onClose();
  }

  const selectFieldsOpts = (types) => draft.fields.filter((f) => types.includes(typeInfo(f.type).kind) || (types.includes('formula') && f.type === 'formula')).map((f) => ({ value: f.id, label: f.name }));
  const activityCfg = draft.settings.activity || {};
  const quickFieldOptions = draft.fields.filter((f) => !['formula', 'file', 'relation'].includes(f.type));

  if (editing) {
    return (
      <Modal open onClose={onClose} className="trk-modal wide">
        <FieldEditor
          field={editing}
          tracker={draft}
          trackers={allTrackers}
          allItems={allItems}
          originalType={savedField(editing.id)?.type}
          onPatch={(p) => patchField(editing.id, p)}
          onPatchConfig={(p) => patchConfig(editing.id, p)}
          onChangeType={(t) => changeType(editing.id, t)}
          onBack={() => setPage(null)}
          onDelete={() => removeField(editing.id)}
        />
        <div className="app-modal-actions">
          <Button type="button" variant="primary" onClick={() => setPage(null)}>Done</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} className="trk-modal wide">
      <h3>{isEdit ? `${draft.icon} Tracker settings` : 'Create tracker'}</h3>

      {!isEdit && (
        <div className="field-group">
          <label className="field-label">Start from</label>
          <Select
            value={templateKey}
            onChange={pickTemplate}
            options={[{ value: '', label: 'Blank tracker' }, ...templates.map((t) => ({ value: t.key, label: `${t.icon} ${t.name}` }))]}
          />
          {chosenTemplate && (
            <>
              <span className="trk-hint">{chosenTemplate.description} Everything is still editable afterwards.</span>
              {chosenTemplate.samples?.length > 0 && <Checkbox checked={withSamples} onChange={toggleSamples} label="Include sample items" />}
            </>
          )}
        </div>
      )}

      <section className="trk-section">
        <h4>General</h4>
        <div className="field-group">
          <label className="field-label">Name</label>
          <TextInput value={draft.name} onChange={(name) => patchDraft({ name })} placeholder="GCP Learning" autoFocus={!isEdit} />
        </div>
        <div className="field-group">
          <label className="field-label">Icon</label>
          <IconPicker value={draft.icon} onChange={(icon) => patchDraft({ icon })} />
          <TextInput value={draft.icon} onChange={(icon) => patchDraft({ icon: [...icon].slice(0, 2).join('') })} placeholder="…or type any emoji" />
        </div>
        <div className="field-group">
          <label className="field-label">Description</label>
          <TextInput value={draft.description} onChange={(description) => patchDraft({ description })} placeholder="Topics I want to learn" />
        </div>
      </section>

      <section className="trk-section">
        <h4>Fields</h4>
        <div className="trk-field-list">
          {draft.fields.map((f, i) => (
            <div className="trk-field-row" key={f.id}>
              <button type="button" className="trk-field-main" onClick={() => setPage(f.id)}>
                <span className="trk-field-name">{f.name}{f.required ? ' *' : ''}</span>
                <span className="trk-field-type">{typeInfo(f.type).label}</span>
                {typeInfo(f.type).kind === 'select' && (
                  <span className="trk-chips">
                    {(f.config.options || []).slice(0, 6).map((o) => <span className="trk-chip" key={o.id} style={{ '--chip': o.color }}>{o.icon} {o.label}</span>)}
                  </span>
                )}
              </button>
              <button type="button" className="trk-icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => setFields(moveInList(draft.fields, i, i - 1))}><ArrowUp size={14} /></button>
              <button type="button" className="trk-icon-btn" aria-label="Move down" disabled={i === draft.fields.length - 1} onClick={() => setFields(moveInList(draft.fields, i, i + 1))}><ArrowDown size={14} /></button>
              <button type="button" className="trk-icon-btn" aria-label="Edit field" onClick={() => setPage(f.id)}><Pencil size={14} /></button>
              <button type="button" className="trk-icon-btn danger" aria-label="Delete field" onClick={() => removeField(f.id)}><Trash2 size={14} /></button>
            </div>
          ))}
          {draft.fields.length === 0 && <p className="trk-hint">No fields yet — every tracker is just the fields you give it.</p>}
        </div>

        <div className="trk-chips trk-presets">
          {FIELD_PRESETS.map((p) => (
            <button type="button" className="trk-chip pick" key={p.label} onClick={() => { const f = p.make(); setFields([...draft.fields, f]); }}>{p.label}</button>
          ))}
        </div>
        <Button type="button" variant="subtle" size="small" onClick={() => setTypePicker((v) => !v)}>+ Add field</Button>
        {typePicker && (
          <div className="trk-type-picker">
            {FIELD_GROUPS.map((group) => (
              <div key={group}>
                <span className="trk-type-group">{group}</span>
                <div className="trk-chips">
                  {Object.entries(FIELD_TYPES).filter(([, t]) => t.group === group).map(([type, t]) => (
                    <button type="button" className="trk-chip pick" key={type} onClick={() => addFieldOfType(type)}>{t.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="trk-section">
        <h4>Views</h4>
        {isEdit || draft.views.length > 0 ? (
          <>
            <div className="trk-chips">
              {draft.views.map((v) => <span className="trk-chip" key={v.id}>{VIEW_TYPES.find((t) => t.value === v.type)?.icon} {v.name}</span>)}
            </div>
            <span className="trk-hint">Add, rename, duplicate or delete views from the tracker screen.</span>
            {draft.views.length > 1 && (
              <div className="field-group">
                <label className="field-label">Default view</label>
                <Select value={draft.settings.defaultViewId || draft.views[0].id} onChange={(defaultViewId) => patchSettings({ defaultViewId })} options={draft.views.map((v) => ({ value: v.id, label: v.name }))} />
              </div>
            )}
          </>
        ) : (
          <div className="trk-check-grid">
            {VIEW_TYPES.map((v) => (
              <Checkbox
                key={v.value}
                checked={viewTypes.includes(v.value)}
                onChange={(on) => setViewTypes((cur) => (on ? [...cur, v.value] : cur.filter((x) => x !== v.value)))}
                label={`${v.icon} ${v.label}`}
              />
            ))}
          </div>
        )}
      </section>

      <section className="trk-section">
        <h4>Behavior</h4>
        <div className="field-group">
          <label className="field-label">Item name comes from</label>
          <Select value={draft.settings.titleFieldId || titleField(draft)?.id || ''} onChange={(titleFieldId) => patchSettings({ titleFieldId })} options={draft.fields.map((f) => ({ value: f.id, label: f.name }))} />
        </div>
        <div className="field-row">
          <div className="field-group">
            <label className="field-label">Default sort</label>
            <Select
              value={draft.settings.defaultSort?.fieldId || ''}
              onChange={(fieldId) => patchSettings({ defaultSort: fieldId ? { fieldId, dir: draft.settings.defaultSort?.dir || 'asc' } : null })}
              options={draft.fields.map((f) => ({ value: f.id, label: f.name }))}
              placeholder="None (creation order)"
            />
          </div>
          {draft.settings.defaultSort && (
            <div className="field-group">
              <label className="field-label">Direction</label>
              <Select value={draft.settings.defaultSort.dir} onChange={(dir) => patchSettings({ defaultSort: { ...draft.settings.defaultSort, dir } })} options={[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]} />
            </div>
          )}
        </div>
        <div className="field-group"><Checkbox checked={Boolean(draft.settings.allowHierarchy)} onChange={(allowHierarchy) => patchSettings({ allowHierarchy })} label="Allow hierarchy (parent / child items)" /></div>
        <div className="field-group"><Checkbox checked={draft.settings.allowAttachments !== false} onChange={(allowAttachments) => patchSettings({ allowAttachments })} label="Allow attachments" /></div>

        <div className="field-group">
          <label className="field-label">Quick update in the item summary</label>
          <div className="trk-check-grid">
            {quickFieldOptions.map((f) => (
              <Checkbox
                key={f.id}
                checked={(draft.settings.quickFieldIds || []).includes(f.id)}
                onChange={(on) => patchSettings({ quickFieldIds: on ? [...(draft.settings.quickFieldIds || []), f.id] : (draft.settings.quickFieldIds || []).filter((x) => x !== f.id) })}
                label={f.name}
              />
            ))}
          </div>
          <span className="trk-hint">Shown as one-tap controls when you open an item. Leave all unticked to use progress fields automatically.</span>
        </div>

        <h5>Daily planner</h5>
        <div className="field-group">
          <label className="field-label">Planner category for activities</label>
          <Select value={activityCfg.categoryId || ''} onChange={(categoryId) => patchActivity({ categoryId: categoryId || null })} options={state.categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))} placeholder="First category" />
        </div>
        <div className="field-row">
          <div className="field-group">
            <label className="field-label">Duration comes from</label>
            <Select value={activityCfg.durationFieldId || ''} onChange={(durationFieldId) => patchActivity({ durationFieldId: durationFieldId || null })} options={selectFieldsOpts(['number'])} placeholder="Default 30 min" />
          </div>
          <div className="field-group">
            <label className="field-label">Start time comes from</label>
            <Select value={activityCfg.startFieldId || ''} onChange={(startFieldId) => patchActivity({ startFieldId: startFieldId || null })} options={selectFieldsOpts(['time'])} placeholder="No fixed time" />
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">Ask to update these fields when a linked activity is completed</label>
          <div className="trk-check-grid">
            {quickFieldOptions.map((f) => (
              <Checkbox
                key={f.id}
                checked={(activityCfg.updateFieldIds || []).includes(f.id)}
                onChange={(on) => patchActivity({ updateFieldIds: on ? [...(activityCfg.updateFieldIds || []), f.id] : (activityCfg.updateFieldIds || []).filter((x) => x !== f.id) })}
                label={f.name}
              />
            ))}
          </div>
          <span className="trk-hint">Leave all unticked to be offered every simple field.</span>
        </div>
      </section>

      {isEdit && (
        <section className="trk-section">
          <h4>More</h4>
          <div className="trk-row-actions">
            <Button type="button" variant="subtle" size="small" onClick={() => { addTrackerTemplate(blueprintFromTracker(draft)); window.alert('Saved as a template. Find it under "Start from" when creating a tracker.'); }}>Save as template</Button>
            <Button type="button" variant="danger" size="small" onClick={handleDelete}><Trash2 size={14} /> Delete tracker</Button>
          </div>
        </section>
      )}

      {error && <p className="trk-error-text">{error}</p>}
      <div className="app-modal-actions">
        <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
        <Button type="button" variant="primary" onClick={handleSave}>{isEdit ? 'Save' : 'Create tracker'}</Button>
      </div>
    </Modal>
  );
}
