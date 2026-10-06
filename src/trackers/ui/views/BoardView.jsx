import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Select } from '../../../components/inputs/Select.jsx';
import { FieldValue } from '../FieldValue.jsx';
import { itemLabel } from '../../engine/data.js';
import { fieldKind, isMultiValued, options } from '../../engine/fieldTypes.js';
import { viewColumns } from '../../engine/query.js';
import { updateItem } from '../../tracker-store.js';

/** Columns are generated from whichever Select field the view is configured with. */
export function BoardView({ tracker, view, rows, ctx, onOpen, itemMenu, onUpdateView, onAdd }) {
  const field = tracker.fields.find((f) => f.id === view.config.boardFieldId);
  const [dragOver, setDragOver] = useState(null);
  const selects = tracker.fields.filter((f) => fieldKind(f) === 'select');

  if (!field || fieldKind(field) !== 'select') {
    return (
      <div className="trk-panel">
        <label className="field-label">Choose the field that defines the board columns</label>
        {selects.length ? (
          <Select value="" onChange={(boardFieldId) => onUpdateView({ boardFieldId })} options={selects.map((f) => ({ value: f.id, label: f.name }))} placeholder="Select field…" />
        ) : (
          <span className="trk-hint">This tracker has no Select field. Add one in the tracker settings to use a board.</span>
        )}
      </div>
    );
  }

  const multi = isMultiValued(field);
  const cardCols = viewColumns(tracker, view).filter((c) => c.fieldId !== field.id && c.fieldId !== tracker.settings.titleFieldId);
  const columns = [...options(field).map((o) => ({ id: o.id, label: o.label, icon: o.icon, color: o.color })), { id: '', label: 'No value', icon: '', color: '#898781' }];

  const belongs = (item, colId) => {
    const v = item.values?.[field.id];
    const list = Array.isArray(v) ? v : v ? [v] : [];
    return colId === '' ? list.length === 0 : list.includes(colId);
  };

  function drop(colId, e) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/plain');
    if (id) updateItem(id, { [field.id]: multi ? (colId ? [colId] : []) : colId || null });
  }

  return (
    <div className="trk-board">
      {columns.map((col) => {
        const items = rows.filter((i) => belongs(i, col.id));
        if (col.id === '' && items.length === 0) return null;
        return (
          <div
            key={col.id || 'none'}
            className={`trk-board-col${dragOver === col.id ? ' over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
            onDragLeave={() => setDragOver((cur) => (cur === col.id ? null : cur))}
            onDrop={(e) => drop(col.id, e)}
          >
            <div className="trk-board-head" style={{ '--chip': col.color }}>
              <span>{col.icon} {col.label}</span>
              <span className="trk-count">{items.length}</span>
              {col.id && <button type="button" className="trk-icon-btn" aria-label={`Add to ${col.label}`} onClick={() => onAdd({ [field.id]: multi ? [col.id] : col.id })}><Plus size={14} /></button>}
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                className="trk-card"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
                onClick={() => onOpen(item)}
              >
                <div className="trk-card-top">
                  <span className="trk-card-title">{itemLabel(tracker, item, ctx)}</span>
                  {itemMenu(item)}
                </div>
                {cardCols.map((c) => (
                  <div className="trk-card-field" key={c.fieldId}><FieldValue field={c.field} item={item} ctx={ctx} /></div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
