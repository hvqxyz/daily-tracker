import { useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { Button } from '../../components/buttons/Button.jsx';
import { FieldValue } from './FieldValue.jsx';
import { getValue } from '../engine/data.js';
import { titleField } from '../engine/data.js';
import { isEmpty, toNumber } from '../engine/fieldTypes.js';
import { quickFields, quickTotal } from '../engine/schema.js';
import { updateItem } from '../tracker-store.js';

const SHORT_LIMIT = 6;
const PERCENT_STEPS = [0, 25, 50, 75, 100];

/** One-tap editor for a progress-like field; saves as soon as you let go. */
function QuickField({ field, item, tracker }) {
  const stored = item.values?.[field.id] ?? null;
  const [value, setValue] = useState(stored);
  const isPercent = field.type === 'percentage' || field.type === 'progress';
  const min = isPercent ? field.config?.min ?? 0 : field.config?.min ?? 0;
  const measured = isPercent ? null : quickTotal(tracker, field, item);
  const max = isPercent ? field.config?.max ?? 100 : measured ? measured.total : field.config?.max ?? null;
  const clamp = (n) => (n === null ? null : Math.max(min, max !== null ? Math.min(max, n) : n));
  const commit = (v) => { const next = clamp(v); setValue(next); if (next !== stored) updateItem(item.id, { [field.id]: next }); };

  return (
    <div className="trk-quick-field">
      <label className="field-label">{field.name}{field.config?.unit ? ` (${field.config.unit})` : ''}</label>
      {isPercent ? (
        <>
          <div className="trk-slider-row">
            <input
              type="range" min={min} max={max} value={value ?? min}
              onChange={(e) => setValue(Number(e.target.value))}
              onPointerUp={() => commit(value)} onKeyUp={() => commit(value)} onBlur={() => commit(value)}
            />
            <input type="number" className="number-input trk-slider-num" min={min} max={max} value={value ?? ''} placeholder="—"
              onChange={(e) => setValue(toNumber(e.target.value))} onBlur={() => commit(value)} onKeyDown={(e) => { if (e.key === 'Enter') commit(value); }} />
            <span className="trk-unit">%</span>
          </div>
          <div className="trk-chips">
            {PERCENT_STEPS.map((p) => <button type="button" key={p} className={`trk-chip pick${stored === p ? ' on' : ''}`} onClick={() => commit(p)}>{p}%</button>)}
          </div>
        </>
      ) : (
        <>
        {measured && (
          <div className="trk-total-bar">
            <div className="trk-progress-track big"><div className="trk-progress-fill" style={{ width: `${Math.min(100, ((value ?? 0) / measured.total) * 100)}%` }} /></div>
            <span className="trk-total-label">{value ?? 0} / {measured.total}{measured.field.config?.unit ? ` ${measured.field.config.unit}` : ''} · {Math.round(Math.min(100, ((value ?? 0) / measured.total) * 100))}%</span>
          </div>
        )}
        {measured && (
          <input type="range" min={min} max={max} value={value ?? 0} className="trk-total-range"
            onChange={(e) => setValue(Number(e.target.value))}
            onPointerUp={() => commit(value)} onKeyUp={() => commit(value)} onBlur={() => commit(value)} />
        )}
        <div className="trk-slider-row">
          <button type="button" className="trk-small-btn" onClick={() => commit((value ?? 0) - 10)}>−10</button>
          <input type="number" className="number-input" min={min} max={max ?? undefined} value={value ?? ''} placeholder="0"
            onChange={(e) => setValue(toNumber(e.target.value))} onBlur={() => commit(value)} onKeyDown={(e) => { if (e.key === 'Enter') commit(value); }} />
          <button type="button" className="trk-small-btn" onClick={() => commit((value ?? 0) + 10)}>+10</button>
          <button type="button" className="trk-small-btn" onClick={() => commit((value ?? 0) + 25)}>+25</button>
          {measured && <button type="button" className="trk-small-btn" onClick={() => commit(measured.total)}>Finished</button>}
        </div>
        </>
      )}
    </div>
  );
}

/** The tracker's one-tap progress controls for an item (also used from the Today page). */
export function QuickFields({ tracker, item }) {
  const fields = quickFields(tracker);
  if (fields.length === 0) return null;
  return (
    <div className="trk-quick">
      {fields.map((f) => <QuickField key={`${f.id}:${item.updatedAt || ''}`} field={f} item={item} tracker={tracker} />)}
    </div>
  );
}

/** Compact read-only summary of an item. "Edit" opens the full form. */
export function ItemPreview({ tracker, item, ctx, notes, onClose, onEdit, onAddToday, onCreateActivity, onArchive, onRestore, onDelete, onOpenNote, onNewNote, onLinkNote }) {
  const [showAll, setShowAll] = useState(false);
  const title = titleField(tracker);
  const quick = quickFields(tracker);
  const quickIds = new Set(quick.map((f) => f.id));
  const filled = tracker.fields.filter((f) => f.id !== title?.id && !quickIds.has(f.id) && (f.type === 'boolean' || !isEmpty(getValue(item, f, ctx), f)));
  const short = filled.filter((f) => f.type !== 'longtext');
  const long = filled.filter((f) => f.type === 'longtext');
  const visible = showAll ? short : short.slice(0, SHORT_LIMIT);
  const hidden = short.length - visible.length;

  return (
    <Modal open onClose={onClose} className="trk-modal">
      <div className="trk-preview-head">
        <span className="trk-preview-icon">{tracker.icon}</span>
        <div>
          <h3>{ctx.itemLabel(item.id)}</h3>
          <span className="trk-hint">{tracker.name}{item.archived ? ' · archived' : ''}</span>
        </div>
      </div>

      {quick.length > 0 && (
        <div className="trk-quick">
          {quick.map((f) => <QuickField key={`${f.id}:${item.updatedAt || ''}`} field={f} item={item} tracker={tracker} />)}
        </div>
      )}

      <dl className="trk-preview-fields">
        {visible.map((f) => (
          <div className="trk-preview-row" key={f.id}>
            <dt>{f.name}</dt>
            <dd><FieldValue field={f} item={item} ctx={ctx} /></dd>
          </div>
        ))}
        {filled.length === 0 && <p className="trk-hint">No details yet.</p>}
      </dl>
      {hidden > 0 && <button type="button" className="trk-link-btn" onClick={() => setShowAll(true)}>Show {hidden} more</button>}

      {long.map((f) => (
        <div className="trk-preview-long" key={f.id}>
          <span className="trk-hint">{f.name}</span>
          <p>{String(getValue(item, f, ctx))}</p>
        </div>
      ))}

      <div className="trk-preview-notes">
        {notes.map((n) => (
          <button type="button" key={n.id} className="trk-chip relation pick" onClick={() => onOpenNote(n.id)}>{n.icon || '📄'} {n.title || 'Untitled note'}</button>
        ))}
        <button type="button" className="trk-chip pick" onClick={onNewNote}>+ New note</button>
        <button type="button" className="trk-chip pick" onClick={onLinkNote}>🔗 Link note</button>
      </div>

      {item.archived ? (
        <div className="app-modal-actions">
          <Button type="button" variant="danger" onClick={onDelete}>Delete</Button>
          <Button type="button" variant="subtle" onClick={onRestore}>Restore</Button>
          <Button type="button" variant="primary" onClick={onEdit}>Edit</Button>
        </div>
      ) : (
        <>
          <div className="trk-row-actions">
            <Button type="button" variant="subtle" size="small" onClick={onAddToday}>📅 Add to today</Button>
            <Button type="button" variant="subtle" size="small" onClick={onCreateActivity}>⏱ Create activity</Button>
            <Button type="button" variant="subtle" size="small" onClick={onArchive}>🗄 Archive</Button>
          </div>
          <div className="app-modal-actions">
            <Button type="button" variant="subtle" onClick={onClose}>Close</Button>
            <Button type="button" variant="primary" onClick={onEdit}>Edit</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
