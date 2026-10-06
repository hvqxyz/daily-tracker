import { Paperclip } from 'lucide-react';
import { getFormula, rawValue } from '../engine/data.js';
import { formatFormulaResult, formatValue, isEmpty, options } from '../engine/fieldTypes.js';

function Chip({ option, fallback }) {
  const color = option?.color || '#898781';
  return (
    <span className="trk-chip" style={{ '--chip': color }}>
      {option?.icon ? <span className="icon-emoji">{option.icon}</span> : <span className="trk-chip-dot" />}
      {option?.label ?? fallback}
    </span>
  );
}

function ProgressBar({ percent, label }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <span className="trk-progress" title={`${p}%`}>
      <span className="trk-progress-track"><span className="trk-progress-fill" style={{ width: `${p}%` }} /></span>
      <span className="trk-progress-label">{label ?? `${Math.round(p)}%`}</span>
    </span>
  );
}

/** Read-only rendering of one field of one item. Purely schema driven. */
export function FieldValue({ field, item, ctx }) {
  if (field.type === 'formula') {
    const res = getFormula(item, field, ctx);
    if (res.error) return <span className="trk-error" title={res.error}>#ERR</span>;
    const fmt = field.config?.format;
    if (res.value === null || res.value === undefined || res.value === '') return <span className="trk-empty">—</span>;
    if (fmt === 'percent') {
      return <ProgressBar percent={Number(res.value)} label={formatFormulaResult(res.value, field)} />;
    }
    return <span>{formatFormulaResult(res.value, field)}</span>;
  }

  const v = rawValue(item, field);
  if (isEmpty(v, field) && field.type !== 'boolean') return <span className="trk-empty">—</span>;

  switch (field.type) {
    case 'boolean':
      return v ? <span className="trk-check">✓</span> : <span className="trk-empty">—</span>;
    case 'select':
    case 'multiselect': {
      const ids = Array.isArray(v) ? v : [v];
      return (
        <span className="trk-chips">
          {ids.map((id) => <Chip key={id} option={options(field).find((o) => o.id === id)} fallback={String(id)} />)}
        </span>
      );
    }
    case 'percentage':
    case 'progress': {
      const min = field.config?.min ?? 0;
      const max = field.config?.max ?? 100;
      if (field.config?.display === 'bar' || field.type === 'progress') {
        return <ProgressBar percent={((Number(v) - min) / (max - min || 1)) * 100} label={`${v}%`} />;
      }
      return <span>{v}%</span>;
    }
    case 'rating': {
      const max = field.config?.max ?? 5;
      if (max <= 5) return <span className="trk-stars" title={`${v}/${max}`}>{'★'.repeat(Number(v))}<span className="trk-stars-off">{'★'.repeat(Math.max(0, max - Number(v)))}</span></span>;
      return <span className="trk-rating">⭐ {v}<span className="trk-empty">/{max}</span></span>;
    }
    case 'url': {
      let host = String(v);
      try { host = new URL(String(v)).hostname.replace(/^www\./, ''); } catch { /* keep raw text */ }
      return <a className="trk-link" href={String(v)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{host}</a>;
    }
    case 'email':
      return <a className="trk-link" href={`mailto:${v}`} onClick={(e) => e.stopPropagation()}>{String(v)}</a>;
    case 'relation': {
      const ids = Array.isArray(v) ? v : [v];
      return (
        <span className="trk-chips">
          {ids.map((id) => <span className="trk-chip relation" key={id}>{ctx.itemLabel(id) || 'Missing item'}</span>)}
        </span>
      );
    }
    case 'file':
      return (
        <span className="trk-files"><Paperclip size={13} /> {v.length === 1 ? v[0].name : `${v.length} files`}</span>
      );
    case 'longtext':
      return <span className="trk-longtext">{String(v)}</span>;
    default:
      return <span>{formatValue(v, field, ctx)}</span>;
  }
}
