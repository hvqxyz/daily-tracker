import { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { Modal } from '../../components/Modal.jsx';
import { Button } from '../../components/buttons/Button.jsx';
import { TextInput } from '../../components/inputs/TextInput.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { Menu } from './Menu.jsx';
import { FilterPanel } from './ViewPanels.jsx';
import { computeWidget } from '../engine/widgets.js';
import { WIDGET_TYPES, newWidget, suggestWidgets } from '../engine/schema.js';
import { fieldKind } from '../engine/fieldTypes.js';
import { addWidget, deleteWidget, setWidgets, updateWidget } from '../tracker-store.js';

const AGGS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
];

function WidgetBody({ data, onOpenItem }) {
  if (data.missing) return <span className="trk-hint">{data.missing}</span>;
  if (data.kind === 'value') {
    return (
      <div className="trk-stat">
        <span className="trk-stat-value">{data.value === null ? '—' : data.value.toLocaleString()}{data.unit ? <small> {data.unit}</small> : null}</span>
        <span className="trk-stat-label">{data.label}</span>
      </div>
    );
  }
  if (data.kind === 'progress') {
    return (
      <div className="trk-stat">
        <span className="trk-stat-value">{data.percent}%</span>
        <div className="trk-progress-track big"><div className="trk-progress-fill" style={{ width: `${data.percent}%` }} /></div>
        <span className="trk-stat-label">{data.label}</span>
      </div>
    );
  }
  if (data.kind === 'bars') {
    if (data.bars.length === 0) return <span className="trk-hint">No data.</span>;
    const max = Math.max(...data.bars.map((b) => b.value), 1);
    return (
      <div className="trk-bars">
        {data.bars.map((b) => (
          <div className="trk-bar-row" key={b.key}>
            <span className="trk-bar-label">{b.icon} {b.label}</span>
            <div className="trk-bar-track"><div className="trk-bar-fill" style={{ width: `${(b.value / max) * 100}%`, background: b.color || 'var(--accent-solid)' }} /></div>
            <span className="trk-bar-count">{Math.round(b.value * 100) / 100}</span>
          </div>
        ))}
      </div>
    );
  }
  if (data.kind === 'items') {
    if (data.items.length === 0) return <span className="trk-hint">Nothing here.</span>;
    return (
      <div className="trk-widget-list">
        {data.items.map((i) => (
          <button type="button" className="trk-widget-item" key={i.id} onClick={() => onOpenItem(i.id)}>
            <span className={i.done ? 'done' : ''}>{i.label}</span>
            {i.meta && <span className="trk-hint">{i.meta}</span>}
          </button>
        ))}
        {data.total > data.items.length && <span className="trk-hint">+{data.total - data.items.length} more</span>}
      </div>
    );
  }
  return null;
}

function WidgetEditor({ tracker, widget, ctx, onClose, onSave }) {
  const [draft, setDraft] = useState(() => widget || newWidget('count', 'Total items'));
  const cfg = draft.config;
  const patch = (p) => setDraft((d) => ({ ...d, config: { ...d.config, ...p } }));
  const needs = WIDGET_TYPES.find((t) => t.value === draft.type)?.needs || [];
  const numeric = tracker.fields.filter((f) => ['number', 'formula:number', 'formula:percent'].includes(fieldKind(f)));
  const selects = tracker.fields.filter((f) => fieldKind(f) === 'select');
  const groupable = tracker.fields.filter((f) => !['file', 'longtext'].includes(f.type));
  const dates = tracker.fields.filter((f) => ['date', 'datetime'].includes(f.type));
  const opts = (list) => list.map((f) => ({ value: f.id, label: f.name }));

  return (
    <Modal open onClose={onClose} className="trk-modal">
      <h3>{widget ? 'Edit widget' : 'Add widget'}</h3>
      <div className="field-group">
        <label className="field-label">Type</label>
        <Select value={draft.type} onChange={(type) => setDraft((d) => ({ ...d, type }))} options={WIDGET_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
      </div>
      <div className="field-group">
        <label className="field-label">Title</label>
        <TextInput value={draft.title} onChange={(title) => setDraft((d) => ({ ...d, title }))} />
      </div>
      {needs.includes('field') && (
        <div className="field-group">
          <label className="field-label">Field</label>
          <Select value={cfg.fieldId || ''} onChange={(fieldId) => patch({ fieldId })} options={opts(numeric)} placeholder="Choose a numeric field…" />
        </div>
      )}
      {draft.type === 'chart' && (
        <div className="field-group">
          <label className="field-label">Value field (for sum / average)</label>
          <Select value={cfg.fieldId || ''} onChange={(fieldId) => patch({ fieldId })} options={opts(numeric)} placeholder="None (count items)" />
        </div>
      )}
      {needs.includes('agg') && (
        <div className="field-group">
          <label className="field-label">Calculation</label>
          <Select value={cfg.agg || 'count'} onChange={(agg) => patch({ agg })} options={AGGS} />
        </div>
      )}
      {needs.includes('doneField') && (
        <div className="field-group">
          <label className="field-label">Status field</label>
          <Select value={cfg.doneFieldId || ''} onChange={(doneFieldId) => patch({ doneFieldId })} options={opts(selects)} placeholder="Choose a select field…" />
          <span className="trk-hint">Counts items whose option is ticked "done" in the field settings.</span>
        </div>
      )}
      {needs.includes('groupField') && (
        <div className="field-group">
          <label className="field-label">Group by</label>
          <Select value={cfg.groupFieldId || ''} onChange={(groupFieldId) => patch({ groupFieldId })} options={opts(groupable)} placeholder="Choose a field…" />
        </div>
      )}
      {needs.includes('dateField') && (
        <div className="field-row">
          <div className="field-group">
            <label className="field-label">Date field</label>
            <Select value={cfg.dateFieldId || ''} onChange={(dateFieldId) => patch({ dateFieldId })} options={opts(dates)} placeholder="Choose…" />
          </div>
          <div className="field-group">
            <label className="field-label">Within next (days)</label>
            <input type="number" className="number-input" min="1" value={cfg.days ?? ''} placeholder="any" onChange={(e) => patch({ days: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>
      )}
      {['recent', 'upcoming', 'list'].includes(draft.type) && (
        <div className="field-group">
          <label className="field-label">Show up to</label>
          <input type="number" className="number-input" min="1" max="50" value={cfg.limit ?? 5} onChange={(e) => patch({ limit: Number(e.target.value) || 5 })} />
        </div>
      )}
      <div className="field-group">
        <label className="field-label">Only count items matching</label>
        <FilterPanel tracker={tracker} filters={cfg.filters || []} onChange={(filters) => patch({ filters })} ctx={ctx} />
      </div>
      <div className="app-modal-actions">
        <Button type="button" variant="subtle" onClick={onClose}>Cancel</Button>
        <Button type="button" variant="primary" onClick={() => { onSave(draft); onClose(); }}>{widget ? 'Save' : 'Add widget'}</Button>
      </div>
    </Modal>
  );
}

export function Dashboard({ tracker, items, ctx, onOpenItem }) {
  const [editing, setEditing] = useState(null); // { widget } | null
  const widgets = tracker.widgets || [];

  return (
    <div className="trk-dashboard">
      <div className="trk-dash-head">
        <Button size="small" onClick={() => setEditing({ widget: null })}><Plus size={15} /> Add widget</Button>
        <Button size="small" variant="subtle" onClick={() => setWidgets(tracker.id, [...widgets, ...suggestWidgets(tracker)])}><Sparkles size={15} /> Suggest widgets</Button>
      </div>
      {widgets.length === 0 && <div className="empty-state">No widgets yet. Add your own, or let the app suggest some from this tracker's fields.</div>}
      <div className="trk-widget-grid">
        {widgets.map((w) => {
          const data = computeWidget(w, tracker, items, ctx);
          return (
            <section className={`trk-widget ${data.kind === 'bars' || data.kind === 'items' ? 'wide' : ''}`} key={w.id}>
              <header>
                <h5>{w.title}</h5>
                <Menu items={[{ label: 'Edit', onClick: () => setEditing({ widget: w }) }, { label: 'Delete', danger: true, onClick: () => deleteWidget(tracker.id, w.id) }]} />
              </header>
              <WidgetBody data={data} onOpenItem={onOpenItem} />
            </section>
          );
        })}
      </div>
      {editing && (
        <WidgetEditor
          key={editing.widget?.id || 'new'}
          tracker={tracker}
          widget={editing.widget}
          ctx={ctx}
          onClose={() => setEditing(null)}
          onSave={(w) => (editing.widget ? updateWidget(tracker.id, w) : addWidget(tracker.id, w))}
        />
      )}
    </div>
  );
}
