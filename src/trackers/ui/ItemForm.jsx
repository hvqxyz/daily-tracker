import { FieldInput } from './FieldInput.jsx';
import { formatValue } from '../engine/fieldTypes.js';
import { addFieldOption } from '../tracker-store.js';

/**
 * Renders a form for whatever fields a tracker has. `fields` limits it to a
 * subset (used by the "update after completing an activity" prompt); when
 * `original` is given, changed values show their previous value.
 */
export function ItemForm({ tracker, item, values, onChange, ctx, allItems, fields, original, missing = [] }) {
  const list = fields || tracker.fields;
  const draft = { ...item, values };
  const missingIds = new Set(missing.map((f) => f.id));

  return (
    <>
      {list.map((field) => {
        const changed = original && field.type !== 'formula' && JSON.stringify(original[field.id] ?? null) !== JSON.stringify(values[field.id] ?? null);
        return (
          <div className={`field-group${missingIds.has(field.id) ? ' trk-invalid' : ''}`} key={field.id}>
            <label className="field-label" htmlFor={`fld-${field.id}`}>
              {field.name}{field.required && field.type !== 'formula' ? ' *' : ''}
              {field.type === 'formula' && <span className="trk-hint"> (calculated)</span>}
              {changed && (
                <span className="trk-was"> was {formatValue(original[field.id], field, ctx) || 'empty'}</span>
              )}
            </label>
            <FieldInput
              field={field}
              value={values[field.id]}
              onChange={(v) => onChange(field.id, typeof v === 'function' ? v(values[field.id]) : v)}
              tracker={tracker}
              ctx={ctx}
              item={draft}
              itemId={item?.id}
              allItems={allItems}
              onAddOption={(label) => addFieldOption(tracker.id, field.id, label)}
            />
          </div>
        );
      })}
      {list.length === 0 && <p className="trk-hint">This tracker has no fields yet.</p>}
    </>
  );
}

