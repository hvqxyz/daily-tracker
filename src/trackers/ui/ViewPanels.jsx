import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Select } from '../../components/inputs/Select.jsx';
import { TextInput } from '../../components/inputs/TextInput.jsx';
import { filterOpsFor, newFilter, opInput } from '../engine/query.js';
import { options, typeInfo } from '../engine/fieldTypes.js';
import { moveInList } from '../engine/schema.js';
import { viewColumns } from '../engine/query.js';

function FilterValue({ field, op, value, onChange, ctx }) {
  const input = opInput(field, op);
  if (!input) return null;
  if (input === 'option') {
    return <Select value={value || ''} onChange={onChange} options={options(field).map((o) => ({ value: o.id, label: `${o.icon || ''} ${o.label}`.trim() }))} placeholder="Choose…" />;
  }
  if (input === 'item') {
    const target = ctx.trackerById(field.config?.targetTrackerId);
    const list = target ? ctx.itemsOf(target.id).filter((i) => !i.archived) : [];
    return <Select value={value || ''} onChange={onChange} options={list.map((i) => ({ value: i.id, label: ctx.itemLabel(i.id) }))} placeholder="Choose…" />;
  }
  if (input === 'number') return <input type="number" className="number-input" step="any" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  if (input === 'date') {
    return (
      <div className="trk-date-filter">
        <input type="date" className="field-input" value={value === 'today' ? '' : value || ''} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className={`trk-chip pick${value === 'today' ? ' on' : ''}`} onClick={() => onChange(value === 'today' ? '' : 'today')}>Today</button>
      </div>
    );
  }
  if (input === 'time') return <input type="time" className="field-input" value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  return <TextInput value={value ?? ''} onChange={onChange} placeholder="Value" />;
}

export function FilterPanel({ tracker, filters, onChange, ctx }) {
  const patch = (id, p) => onChange(filters.map((f) => (f.id === id ? { ...f, ...p } : f)));
  return (
    <div className="trk-panel">
      {filters.map((f) => {
        const field = tracker.fields.find((x) => x.id === f.fieldId);
        if (!field) return null;
        return (
          <div className="trk-filter-row" key={f.id}>
            <Select
              value={f.fieldId}
              onChange={(fieldId) => {
                const next = tracker.fields.find((x) => x.id === fieldId);
                patch(f.id, { fieldId, op: filterOpsFor(next)[0].value, value: '' });
              }}
              options={tracker.fields.filter((x) => x.type !== 'file').map((x) => ({ value: x.id, label: x.name }))}
            />
            <Select value={f.op} onChange={(op) => patch(f.id, { op, value: '' })} options={filterOpsFor(field).map((o) => ({ value: o.value, label: o.label }))} />
            <FilterValue field={field} op={f.op} value={f.value} onChange={(value) => patch(f.id, { value })} ctx={ctx} />
            <button type="button" className="trk-icon-btn danger" aria-label="Remove filter" onClick={() => onChange(filters.filter((x) => x.id !== f.id))}><Trash2 size={14} /></button>
          </div>
        );
      })}
      {filters.length === 0 && <span className="trk-hint">No filters — every item is shown.</span>}
      <button type="button" className="trk-small-btn" disabled={tracker.fields.length === 0} onClick={() => onChange([...filters, newFilter(tracker.fields.find((x) => x.type !== 'file') || tracker.fields[0])])}>+ Add filter</button>
    </div>
  );
}

export function SortPanel({ tracker, sorts, onChange }) {
  const patch = (i, p) => onChange(sorts.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="trk-panel">
      {sorts.map((s, i) => (
        <div className="trk-filter-row" key={`${s.fieldId}-${i}`}>
          <Select value={s.fieldId} onChange={(fieldId) => patch(i, { fieldId })} options={tracker.fields.map((f) => ({ value: f.id, label: f.name }))} />
          <Select value={s.dir} onChange={(dir) => patch(i, { dir })} options={[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]} />
          <button type="button" className="trk-icon-btn danger" aria-label="Remove sort" onClick={() => onChange(sorts.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
        </div>
      ))}
      {sorts.length === 0 && <span className="trk-hint">Using the tracker's default order.</span>}
      <button type="button" className="trk-small-btn" disabled={tracker.fields.length === 0} onClick={() => onChange([...sorts, { fieldId: tracker.fields[0].id, dir: 'asc' }])}>+ Add sort</button>
    </div>
  );
}

export function GroupPanel({ tracker, groupBy, onChange }) {
  return (
    <div className="trk-panel">
      <label className="field-label">Group rows by</label>
      <Select value={groupBy || ''} onChange={(v) => onChange(v || null)} options={tracker.fields.filter((f) => f.type !== 'file' && f.type !== 'longtext').map((f) => ({ value: f.id, label: f.name }))} placeholder="No grouping" />
    </div>
  );
}

/** Show / hide / reorder the columns of a table, list, board or hierarchy view. */
export function ColumnsPanel({ tracker, view, onChange }) {
  const visible = viewColumns(tracker, view);
  const shownIds = new Set(visible.map((c) => c.fieldId));
  const hidden = tracker.fields.filter((f) => !shownIds.has(f.id));
  const cols = visible.map((c) => ({ fieldId: c.fieldId, width: c.width ?? null }));

  return (
    <div className="trk-panel">
      {visible.map((c, i) => (
        <div className="trk-column-row" key={c.fieldId}>
          <label className="trk-column-name">
            <input type="checkbox" checked onChange={() => onChange(cols.filter((x) => x.fieldId !== c.fieldId))} />
            {c.field.name} <span className="trk-field-type">{typeInfo(c.field.type).label}</span>
          </label>
          <button type="button" className="trk-icon-btn" aria-label="Move left" disabled={i === 0} onClick={() => onChange(moveInList(cols, i, i - 1))}><ArrowUp size={14} /></button>
          <button type="button" className="trk-icon-btn" aria-label="Move right" disabled={i === cols.length - 1} onClick={() => onChange(moveInList(cols, i, i + 1))}><ArrowDown size={14} /></button>
        </div>
      ))}
      {hidden.map((f) => (
        <div className="trk-column-row hidden" key={f.id}>
          <label className="trk-column-name">
            <input type="checkbox" checked={false} onChange={() => onChange([...cols, { fieldId: f.id, width: null }])} />
            {f.name} <span className="trk-field-type">{typeInfo(f.type).label}</span>
          </label>
        </div>
      ))}
    </div>
  );
}
