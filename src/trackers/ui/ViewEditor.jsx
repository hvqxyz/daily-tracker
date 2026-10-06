import { useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { Button } from '../../components/buttons/Button.jsx';
import { TextInput } from '../../components/inputs/TextInput.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { SegmentedControl } from '../../components/inputs/SegmentedControl.jsx';
import { VIEW_TYPES, createView } from '../engine/schema.js';
import { fieldKind } from '../engine/fieldTypes.js';

const isDateField = (f) => ['date', 'datetime'].includes(f.type) || f.config?.format === 'date';

/** Create a view, or edit the name / type / type-specific settings of an existing one. */
export function ViewEditor({ tracker, view, onClose, onSubmit }) {
  const isEdit = Boolean(view);
  const [name, setName] = useState(view?.name || '');
  const [type, setType] = useState(view?.type || 'table');
  const [config, setConfig] = useState(() => ({ ...(view?.config || {}) }));

  const selects = tracker.fields.filter((f) => fieldKind(f) === 'select');
  const dates = tracker.fields.filter(isDateField);
  const fieldOpts = (list) => list.map((f) => ({ value: f.id, label: f.name }));

  function changeType(next) {
    setType(next);
    const fresh = createView(tracker, next, name || undefined);
    setConfig((c) => ({
      ...c,
      boardFieldId: c.boardFieldId ?? fresh.config.boardFieldId,
      dateFieldId: c.dateFieldId ?? fresh.config.dateFieldId,
      startFieldId: c.startFieldId ?? fresh.config.startFieldId,
      endFieldId: c.endFieldId ?? fresh.config.endFieldId,
      columns: c.columns ?? fresh.config.columns,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ name: name.trim() || VIEW_TYPES.find((t) => t.value === type).label, type, config });
  }

  return (
    <Modal open onClose={onClose} className="trk-modal">
      <h3>{isEdit ? 'Edit view' : 'New view'}</h3>
      <form onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-label">Name</label>
          <TextInput value={name} onChange={setName} placeholder="Current learning" autoFocus />
        </div>
        <div className="field-group">
          <label className="field-label">Type</label>
          <div className="trk-view-types">
            <SegmentedControl value={type} onChange={changeType} options={VIEW_TYPES.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))} />
          </div>
        </div>

        {type === 'board' && (
          <div className="field-group">
            <label className="field-label">Columns come from</label>
            {selects.length ? <Select value={config.boardFieldId || ''} onChange={(boardFieldId) => setConfig((c) => ({ ...c, boardFieldId }))} options={fieldOpts(selects)} placeholder="Choose a select field…" /> : <span className="trk-hint">Add a Select field to this tracker to use a board.</span>}
          </div>
        )}
        {type === 'calendar' && (
          <div className="field-group">
            <label className="field-label">Date field</label>
            {dates.length ? <Select value={config.dateFieldId || ''} onChange={(dateFieldId) => setConfig((c) => ({ ...c, dateFieldId }))} options={fieldOpts(dates)} placeholder="Choose a date field…" /> : <span className="trk-hint">Add a Date field to this tracker to use a calendar.</span>}
          </div>
        )}
        {type === 'timeline' && (
          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Starts on</label>
              <Select value={config.startFieldId || ''} onChange={(startFieldId) => setConfig((c) => ({ ...c, startFieldId }))} options={fieldOpts(dates)} placeholder="Date field…" />
            </div>
            <div className="field-group">
              <label className="field-label">Ends on</label>
              <Select value={config.endFieldId || ''} onChange={(endFieldId) => setConfig((c) => ({ ...c, endFieldId }))} options={fieldOpts(dates)} placeholder="(same as start)" />
            </div>
          </div>
        )}
        {type === 'hierarchy' && !tracker.settings.allowHierarchy && <p className="trk-hint">Hierarchy will be switched on for this tracker so items can have a parent.</p>}

        <div className="app-modal-actions">
          <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{isEdit ? 'Save' : 'Create view'}</Button>
        </div>
      </form>
    </Modal>
  );
}
