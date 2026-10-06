import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { createOption, OPTION_COLORS } from '../engine/fieldTypes.js';
import { moveInList } from '../engine/schema.js';

/** Edit the options of a select field: label, icon, colour, order and "counts as completed". */
export function OptionsEditor({ options, onChange }) {
  const patch = (id, p) => onChange(options.map((o) => (o.id === id ? { ...o, ...p } : o)));

  return (
    <div className="trk-options">
      {options.map((o, i) => (
        <div className="trk-option-row" key={o.id}>
          <input className="text-input trk-option-icon" value={o.icon || ''} maxLength={4} placeholder="🙂" aria-label="Icon" onChange={(e) => patch(o.id, { icon: e.target.value })} />
          <input className="text-input trk-option-label" value={o.label} aria-label="Label" onChange={(e) => patch(o.id, { label: e.target.value })} />
          <input type="color" className="trk-color" value={o.color || '#898781'} aria-label="Colour" onChange={(e) => patch(o.id, { color: e.target.value })} />
          <label className="trk-option-done" title="Items with this option count as completed">
            <input type="checkbox" checked={Boolean(o.done)} onChange={(e) => patch(o.id, { done: e.target.checked })} /> done
          </label>
          <button type="button" className="trk-icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => onChange(moveInList(options, i, i - 1))}><ArrowUp size={14} /></button>
          <button type="button" className="trk-icon-btn" aria-label="Move down" disabled={i === options.length - 1} onClick={() => onChange(moveInList(options, i, i + 1))}><ArrowDown size={14} /></button>
          <button type="button" className="trk-icon-btn danger" aria-label="Remove option" onClick={() => onChange(options.filter((x) => x.id !== o.id))}><Trash2 size={14} /></button>
        </div>
      ))}
      <button
        type="button"
        className="trk-small-btn"
        onClick={() => onChange([...options, createOption(`Option ${options.length + 1}`, { color: OPTION_COLORS[options.length % OPTION_COLORS.length] })])}
      >
        + Add option
      </button>
    </div>
  );
}
