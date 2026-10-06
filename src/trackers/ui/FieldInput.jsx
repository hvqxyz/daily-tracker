import { useState } from 'react';
import { X } from 'lucide-react';
import { TextInput } from '../../components/inputs/TextInput.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { Checkbox } from '../../components/inputs/Checkbox.jsx';
import { FieldValue } from './FieldValue.jsx';
import { isMultiValued, options, toNumber } from '../engine/fieldTypes.js';
import { formatDuration } from '../../common/time.js';

const MAX_FILE_BYTES = 400 * 1024;
const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

function NumberField({ field, value, onChange, decimal }) {
  const cfg = field.config || {};
  return (
    <div className="trk-number-row">
      <input
        type="number"
        className="number-input"
        inputMode={decimal ? 'decimal' : 'numeric'}
        step={decimal ? 'any' : 1}
        min={cfg.min ?? undefined}
        max={cfg.max ?? undefined}
        value={value ?? ''}
        onChange={(e) => onChange(toNumber(e.target.value))}
      />
      {cfg.unit && <span className="trk-unit">{cfg.unit}</span>}
    </div>
  );
}

function OptionChips({ field, value, onChange, onAddOption }) {
  const [draft, setDraft] = useState('');
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="trk-option-picker">
      <div className="trk-chips">
        {options(field).map((o) => (
          <button
            type="button"
            key={o.id}
            className={`trk-chip pick${selected.includes(o.id) ? ' on' : ''}`}
            style={{ '--chip': o.color }}
            onClick={() => toggle(o.id)}
          >
            {o.icon && <span className="icon-emoji">{o.icon}</span>}
            {o.label}
          </button>
        ))}
        {options(field).length === 0 && <span className="trk-hint">No options yet — add them in the field settings.</span>}
      </div>
      {field.config?.allowCustom && onAddOption && (
        <div className="trk-inline-add">
          <TextInput value={draft} onChange={setDraft} placeholder="New option…" />
          <button
            type="button"
            className="trk-small-btn"
            disabled={!draft.trim()}
            onClick={() => { const o = onAddOption(draft.trim()); if (o) toggle(o.id); setDraft(''); }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function RelationPicker({ field, value, onChange, ctx, itemId, allItems }) {
  const [query, setQuery] = useState('');
  const target = ctx.trackerById(field.config?.targetTrackerId);
  if (!target) return <span className="trk-hint">Pick a target tracker in the field settings.</span>;

  const multi = isMultiValued(field);
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const usedElsewhere = new Set();
  if (field.config?.cardinality === 'one-to-one') {
    for (const i of allItems) {
      if (i.id === itemId) continue;
      const v = i.values?.[field.id];
      if (v) usedElsewhere.add(v);
    }
  }
  const candidates = ctx.itemsOf(target.id).filter((i) => (!i.archived || selected.includes(i.id)) && i.id !== itemId && !usedElsewhere.has(i.id));
  const labelled = candidates.map((i) => ({ id: i.id, label: ctx.itemLabel(i.id) })).sort((a, b) => a.label.localeCompare(b.label));

  if (!multi) {
    return (
      <Select
        value={selected[0] ?? ''}
        onChange={(v) => onChange(v || null)}
        options={[{ value: '', label: `— ${target.icon} ${target.name} —` }, ...labelled.map((c) => ({ value: c.id, label: c.label }))]}
      />
    );
  }
  const shown = labelled.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="trk-relation-multi">
      {selected.length > 0 && (
        <div className="trk-chips">
          {selected.map((id) => (
            <span className="trk-chip relation" key={id}>
              {ctx.itemLabel(id) || 'Missing item'}
              <button type="button" className="trk-chip-x" aria-label="Remove" onClick={() => onChange(selected.filter((x) => x !== id))}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <TextInput value={query} onChange={setQuery} placeholder={`Search ${target.name}…`} />
      <div className="trk-relation-list">
        {shown.filter((c) => !selected.includes(c.id)).slice(0, 30).map((c) => (
          <button type="button" key={c.id} className="trk-relation-option" onClick={() => onChange([...selected, c.id])}>+ {c.label}</button>
        ))}
        {shown.length === 0 && <span className="trk-hint">Nothing to link.</span>}
      </div>
    </div>
  );
}

function FileField({ value, onChange, disabled }) {
  const files = value || [];
  const [error, setError] = useState('');

  function handlePick(e) {
    const picked = [...e.target.files];
    e.target.value = '';
    setError('');
    picked.forEach((file) => {
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" is over ${MAX_FILE_BYTES / 1024} KB — attachments are stored on this device.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => onChange((prev) => [...(prev || []), { name: file.name, size: file.size, type: file.type, data: reader.result }]);
      reader.readAsDataURL(file);
    });
  }

  return (
    <div className="trk-files-field">
      {files.map((f, i) => (
        <div className="trk-file-row" key={`${f.name}-${i}`}>
          {f.data ? <a href={f.data} download={f.name} className="trk-link">{f.name}</a> : <span>{f.name}</span>}
          <span className="trk-hint">{Math.max(1, Math.round((f.size || 0) / 1024))} KB</span>
          <button type="button" className="trk-icon-btn" aria-label="Remove file" onClick={() => onChange(files.filter((_, j) => j !== i))}><X size={14} /></button>
        </div>
      ))}
      {!disabled && <input type="file" multiple onChange={handlePick} className="trk-file-input" />}
      {disabled && <span className="trk-hint">Attachments are turned off for this tracker.</span>}
      {error && <span className="trk-error-text">{error}</span>}
    </div>
  );
}

/**
 * Editor for one field value. `onChange` receives the new value (or an updater
 * fn for async file reads). Everything is chosen by the field's type/config.
 */
export function FieldInput({ field, value, onChange, tracker, ctx, item, itemId, onAddOption, allItems = [] }) {
  const cfg = field.config || {};
  const id = `fld-${field.id}`;

  switch (field.type) {
    case 'text':
    case 'url':
    case 'email':
      return <TextInput id={id} type={field.type === 'text' ? 'text' : field.type} value={value ?? ''} onChange={(v) => onChange(v)} placeholder={cfg.placeholder} />;
    case 'longtext':
      return <textarea id={id} className="field-input" rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return <NumberField field={field} value={value} onChange={onChange} />;
    case 'decimal':
      return <NumberField field={field} value={value} onChange={onChange} decimal />;
    case 'boolean':
      return <Checkbox checked={Boolean(value)} onChange={onChange} label={value ? 'Yes' : 'No'} />;
    case 'date':
      return <input id={id} type="date" className="field-input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
    case 'datetime':
      return <input id={id} type="datetime-local" className="field-input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
    case 'time':
    case 'starttime':
    case 'endtime':
      return <input id={id} type="time" className="field-input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
    case 'duration':
      return (
        <div className="trk-duration">
          <NumberField field={{ config: { unit: 'min', min: 0 } }} value={value} onChange={onChange} />
          <div className="trk-chips">
            {DURATION_PRESETS.map((d) => (
              <button type="button" key={d} className={`trk-chip pick${value === d ? ' on' : ''}`} onClick={() => onChange(value === d ? null : d)}>{formatDuration(d)}</button>
            ))}
          </div>
        </div>
      );
    case 'percentage':
    case 'progress': {
      const min = cfg.min ?? 0;
      const max = cfg.max ?? 100;
      return (
        <div className="trk-slider-row">
          <input type="range" min={min} max={max} value={value ?? min} onChange={(e) => onChange(Number(e.target.value))} />
          <input type="number" className="number-input trk-slider-num" min={min} max={max} value={value ?? ''} placeholder="—" onChange={(e) => onChange(toNumber(e.target.value))} />
          <span className="trk-unit">%</span>
        </div>
      );
    }
    case 'rating': {
      const max = cfg.max ?? 5;
      return (
        <div className="trk-rating-input" role="radiogroup">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button type="button" key={n} className={`trk-star${value >= n ? ' on' : ''}`} aria-label={`${n} of ${max}`} onClick={() => onChange(value === n ? null : n)}>★</button>
          ))}
          {value ? <span className="trk-hint">{value}/{max}</span> : null}
        </div>
      );
    }
    case 'select':
      if (cfg.multiple) return <OptionChips field={field} value={value} onChange={onChange} onAddOption={onAddOption} />;
      return <OptionChips field={field} value={value} onChange={(ids) => onChange(ids[ids.length - 1] ?? null)} onAddOption={onAddOption} />;
    case 'multiselect':
      return <OptionChips field={field} value={value} onChange={onChange} onAddOption={onAddOption} />;
    case 'relation':
      return <RelationPicker field={field} value={value} onChange={onChange} ctx={ctx} itemId={itemId} allItems={allItems} />;
    case 'formula':
      return <div className="trk-readonly"><FieldValue field={field} item={item} ctx={ctx} /></div>;
    case 'file':
      return <FileField value={value} onChange={onChange} disabled={tracker?.settings?.allowAttachments === false} />;
    default:
      return null;
  }
}
