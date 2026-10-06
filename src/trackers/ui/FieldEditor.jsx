import { useMemo } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { TextInput } from '../../components/inputs/TextInput.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { Checkbox } from '../../components/inputs/Checkbox.jsx';
import { SegmentedControl } from '../../components/inputs/SegmentedControl.jsx';
import { Button } from '../../components/buttons/Button.jsx';
import { OptionsEditor } from './OptionsEditor.jsx';
import { FieldInput } from './FieldInput.jsx';
import { FieldValue } from './FieldValue.jsx';
import { FIELD_GROUPS, FIELD_TYPES, RELATION_CARDINALITIES, typeInfo, toNumber } from '../engine/fieldTypes.js';
import { canConvert } from '../engine/schema.js';
import { checkFormulaSyntax } from '../engine/formula.js';
import { getFormula, makeCtx } from '../engine/data.js';

const FORMULA_FORMATS = [
  { value: 'number', label: 'Number' },
  { value: 'percent', label: 'Percent' },
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes / no' },
];

const FORMULA_HELP = `Reference fields with {Field name}. Operators: + - * / %  == != < > <= >=  && ||
Dates: today, {Date} - {Other date} (days), {Date} + 7.
Functions: if(cond, a, b) round(x, n) min max sum avg count percent(part, whole)
days(a, b) addDays(d, n) empty(x) concat(...) contains(text, part) len(x)
rollup({Relation}, "Field name", "sum"|"avg"|"min"|"max"|"count") children() childrenDone()`;

function NumberSetting({ label, value, onChange, placeholder }) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <input type="number" className="number-input" step="any" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(toNumber(e.target.value))} />
    </div>
  );
}

export function FieldEditor({ field, tracker, trackers, allItems, originalType, onPatch, onPatchConfig, onChangeType, onBack, onDelete }) {
  const info = typeInfo(field.type);
  const cfg = field.config || {};
  const kind = info.kind;

  const typeChoices = FIELD_TYPES;
  const allowedType = (t) => !originalType || canConvert(originalType, t);

  const sampleItem = useMemo(() => allItems.find((i) => i.trackerId === tracker.id), [allItems, tracker.id]);
  const preview = useMemo(() => {
    if (field.type !== 'formula' || !sampleItem) return null;
    const ctx = makeCtx(trackers, allItems);
    return { ctx, result: getFormula(sampleItem, field, ctx) };
  }, [field, sampleItem, trackers, allItems]);
  const syntaxError = field.type === 'formula' ? checkFormulaSyntax(cfg.expression) : null;

  return (
    <div className="trk-field-editor">
      <div className="trk-page-head">
        <button type="button" className="trk-icon-btn" aria-label="Back to fields" onClick={onBack}><ArrowLeft size={18} /></button>
        <h4>Field settings</h4>
        <Button type="button" variant="danger" size="small" onClick={onDelete}><Trash2 size={14} /> Delete</Button>
      </div>

      <div className="field-group">
        <label className="field-label">Name</label>
        <TextInput value={field.name} onChange={(name) => onPatch({ name })} autoFocus />
      </div>

      <div className="field-group">
        <label className="field-label">Type</label>
        <select className="select-input" value={field.type} onChange={(e) => onChangeType(e.target.value)}>
          {FIELD_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {Object.entries(typeChoices).filter(([, t]) => t.group === group).map(([value, t]) => (
                <option key={value} value={value} disabled={!allowedType(value)}>{t.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {originalType && <span className="trk-hint">Existing values are kept, so only compatible types can be chosen.</span>}
      </div>

      {(field.type === 'number' || field.type === 'decimal') && (
        <>
          <div className="field-row">
            <NumberSetting label="Minimum" value={cfg.min} onChange={(min) => onPatchConfig({ min })} />
            <NumberSetting label="Maximum" value={cfg.max} onChange={(max) => onPatchConfig({ max })} />
          </div>
          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Unit</label>
              <TextInput value={cfg.unit || ''} onChange={(unit) => onPatchConfig({ unit })} placeholder="pages, km, €…" />
            </div>
            {field.type === 'decimal' && <NumberSetting label="Decimals" value={cfg.precision} onChange={(precision) => onPatchConfig({ precision: precision ?? 2 })} />}
          </div>
        </>
      )}

      {(field.type === 'percentage' || field.type === 'progress') && (
        <>
          <div className="field-row">
            <NumberSetting label="Minimum" value={cfg.min} onChange={(min) => onPatchConfig({ min: min ?? 0 })} />
            <NumberSetting label="Maximum" value={cfg.max} onChange={(max) => onPatchConfig({ max: max ?? 100 })} />
          </div>
          <div className="field-group">
            <label className="field-label">Show as</label>
            <SegmentedControl value={cfg.display || 'number'} onChange={(display) => onPatchConfig({ display })} options={[{ value: 'number', label: 'Number' }, { value: 'bar', label: 'Progress bar' }]} />
          </div>
        </>
      )}

      {field.type === 'rating' && <NumberSetting label="Maximum rating (1–10)" value={cfg.max} onChange={(max) => onPatchConfig({ max: Math.max(1, Math.min(10, max ?? 5)) })} />}

      {kind === 'select' && (
        <>
          <div className="field-group">
            <label className="field-label">Options</label>
            <OptionsEditor options={cfg.options || []} onChange={(options) => onPatchConfig({ options })} />
            <span className="trk-hint">Tick "done" on the options that mean an item is completed — the app only knows what you tell it.</span>
          </div>
          {field.type === 'select' && <div className="field-group"><Checkbox checked={Boolean(cfg.multiple)} onChange={(multiple) => onPatchConfig({ multiple })} label="Allow multiple values" /></div>}
          <div className="field-group"><Checkbox checked={Boolean(cfg.allowCustom)} onChange={(allowCustom) => onPatchConfig({ allowCustom })} label="Allow custom options when adding items" /></div>
        </>
      )}

      {(field.type === 'date' || field.type === 'datetime') && (
        <div className="field-group"><Checkbox checked={Boolean(cfg.defaultToday)} onChange={(defaultToday) => onPatchConfig({ defaultToday })} label="Default to today / now" /></div>
      )}

      {field.type === 'relation' && (
        <>
          <div className="field-group">
            <label className="field-label">Links to tracker</label>
            <Select
              value={cfg.targetTrackerId || ''}
              onChange={(v) => onPatchConfig({ targetTrackerId: v || null })}
              options={trackers.map((t) => ({ value: t.id, label: `${t.icon} ${t.name}${t.id === tracker.id ? ' (this tracker)' : ''}` }))}
              placeholder="Choose a tracker…"
            />
          </div>
          <div className="field-group">
            <label className="field-label">Relation type</label>
            <Select value={cfg.cardinality || 'one-to-many'} onChange={(cardinality) => onPatchConfig({ cardinality })} options={RELATION_CARDINALITIES} />
          </div>
        </>
      )}

      {field.type === 'formula' && (
        <>
          <div className="field-group">
            <label className="field-label">Formula</label>
            <textarea className="field-input trk-mono" rows={3} value={cfg.expression || ''} onChange={(e) => onPatchConfig({ expression: e.target.value })} placeholder="today - {Started}" spellCheck={false} />
            {syntaxError && <span className="trk-error-text">{syntaxError}</span>}
            <div className="trk-chips trk-insert-chips">
              {tracker.fields.filter((f) => f.id !== field.id).map((f) => (
                <button type="button" key={f.id} className="trk-chip pick" onClick={() => onPatchConfig({ expression: `${cfg.expression || ''}{${f.name}}` })}>{f.name}</button>
              ))}
            </div>
            <pre className="trk-help">{FORMULA_HELP}</pre>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Result shown as</label>
              <Select value={cfg.format || 'number'} onChange={(format) => onPatchConfig({ format })} options={FORMULA_FORMATS} />
            </div>
            {['number', 'percent'].includes(cfg.format || 'number') && <NumberSetting label="Decimals" value={cfg.precision} onChange={(precision) => onPatchConfig({ precision: precision ?? 0 })} />}
          </div>
          <div className="field-group">
            <label className="field-label">Preview{sampleItem ? '' : ''}</label>
            {preview ? (
              <div className="trk-readonly">
                {preview.result.error ? <span className="trk-error-text">{preview.result.error}</span> : <FieldValue field={field} item={sampleItem} ctx={preview.ctx} />}
              </div>
            ) : <span className="trk-hint">Add an item to preview the result.</span>}
          </div>
        </>
      )}

      {field.type !== 'formula' && field.type !== 'boolean' && (
        <div className="field-group"><Checkbox checked={field.required} onChange={(required) => onPatch({ required })} label="Required" /></div>
      )}

      {!['formula', 'file', 'relation'].includes(field.type) && (
        <div className="field-group">
          <label className="field-label">Default value</label>
          <FieldInput
            field={field}
            value={field.default}
            onChange={(v) => onPatch({ default: typeof v === 'function' ? v(field.default) : v })}
            tracker={tracker}
            ctx={makeCtx(trackers, allItems)}
            allItems={allItems}
          />
          {field.default !== null && field.default !== undefined && field.default !== '' && (
            <button type="button" className="trk-link-btn" onClick={() => onPatch({ default: null })}>Clear default</button>
          )}
        </div>
      )}
    </div>
  );
}
