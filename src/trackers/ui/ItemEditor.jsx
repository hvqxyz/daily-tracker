import { useMemo, useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { Button } from '../../components/buttons/Button.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { ItemForm } from './ItemForm.jsx';
import { addItem, updateItem } from '../tracker-store.js';
import { missingRequired, newItem, wouldCycle } from '../engine/schema.js';
import { itemLabel } from '../engine/data.js';

/** Create or edit an item; the form is generated from the tracker's schema. */
export function ItemEditor({ tracker, item, initialValues, parentId = null, ctx, allItems, onClose, onSaved, extraActions }) {
  const isEdit = Boolean(item);
  const seed = useMemo(() => (isEdit ? item : newItem(tracker, initialValues || {}, parentId)), [isEdit, item, tracker, initialValues, parentId]);
  const [values, setValues] = useState(() => ({ ...seed.values }));
  const [parent, setParent] = useState(seed.parentId || '');
  const [missing, setMissing] = useState([]);

  const parentOptions = tracker.settings?.allowHierarchy
    ? allItems
        .filter((i) => i.trackerId === tracker.id && !i.archived && i.id !== seed.id && !wouldCycle(allItems, seed.id, i.id))
        .map((i) => ({ value: i.id, label: itemLabel(tracker, i, ctx) }))
    : [];

  const backlinks = isEdit
    ? ctx.trackers.flatMap((t) =>
        t.fields
          .filter((f) => f.type === 'relation' && f.config.targetTrackerId === tracker.id)
          .flatMap((f) =>
            allItems
              .filter((i) => i.trackerId === t.id && (Array.isArray(i.values?.[f.id]) ? i.values[f.id].includes(item.id) : i.values?.[f.id] === item.id))
              .map((i) => ({ id: i.id, label: ctx.itemLabel(i.id), from: `${t.icon} ${t.name} · ${f.name}` }))
          )
      )
    : [];

  function handleSubmit(e) {
    e.preventDefault();
    const lacking = missingRequired(tracker, values);
    if (lacking.length > 0) {
      setMissing(lacking);
      return;
    }
    if (isEdit) updateItem(item.id, values, { parentId: parent || null });
    else addItem(tracker.id, values, parent || null);
    onSaved?.();
    onClose();
  }

  return (
    <Modal open onClose={onClose} className="trk-modal">
      <h3>{isEdit ? `Edit ${tracker.name}` : `Add to ${tracker.name}`}</h3>
      <form onSubmit={handleSubmit}>
        <ItemForm
          tracker={tracker}
          item={seed}
          values={values}
          onChange={(fid, v) => { setValues((prev) => ({ ...prev, [fid]: v })); setMissing((m) => m.filter((f) => f.id !== fid)); }}
          ctx={ctx}
          allItems={allItems}
          missing={missing}
        />

        {parentOptions.length > 0 && (
          <div className="field-group">
            <label className="field-label">Parent</label>
            <Select value={parent} onChange={setParent} options={[{ value: '', label: '— none (top level) —' }, ...parentOptions]} />
          </div>
        )}

        {backlinks.length > 0 && (
          <div className="field-group">
            <label className="field-label">Linked from</label>
            <div className="trk-chips">
              {backlinks.map((b) => <span className="trk-chip relation" key={`${b.id}${b.from}`} title={b.from}>{b.label}</span>)}
            </div>
          </div>
        )}

        {missing.length > 0 && <p className="trk-error-text">Required: {missing.map((f) => f.name).join(', ')}</p>}

        {extraActions}

        <div className="app-modal-actions">
          <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{isEdit ? 'Save' : 'Add'}</Button>
        </div>
      </form>
    </Modal>
  );
}
