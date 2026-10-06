// The field-type registry. Every tracker is built from these primitives; there
// is deliberately nothing here (or anywhere in the engine) that knows about
// "books", "goals" or any other domain. `kind` groups types that share
// filtering, sorting and input behaviour.

import { newId } from './ids.js';
import { todayKey } from '../../common/time.js';
import { formatDuration, formatDateDMY } from '../../common/time.js';

export const FIELD_GROUPS = ['Basic', 'Selection', 'Progress / rating', 'Time', 'Relationships', 'Special'];

export const FIELD_TYPES = {
  text: { label: 'Text', group: 'Basic', kind: 'text' },
  longtext: { label: 'Long text', group: 'Basic', kind: 'text' },
  number: { label: 'Number', group: 'Basic', kind: 'number', defaults: { min: null, max: null, unit: '' } },
  decimal: { label: 'Decimal', group: 'Basic', kind: 'number', defaults: { min: null, max: null, unit: '', precision: 2 } },
  boolean: { label: 'Checkbox (yes / no)', group: 'Basic', kind: 'boolean' },
  date: { label: 'Date', group: 'Basic', kind: 'date', defaults: { defaultToday: false } },
  datetime: { label: 'Date & time', group: 'Basic', kind: 'datetime', defaults: { defaultToday: false } },
  url: { label: 'URL', group: 'Basic', kind: 'text' },
  email: { label: 'Email', group: 'Basic', kind: 'text' },

  select: { label: 'Select', group: 'Selection', kind: 'select', defaults: { options: [], multiple: false, allowCustom: false } },
  multiselect: { label: 'Multi-select', group: 'Selection', kind: 'select', defaults: { options: [], multiple: true, allowCustom: false } },

  percentage: { label: 'Percentage', group: 'Progress / rating', kind: 'number', defaults: { min: 0, max: 100, display: 'number' } },
  progress: { label: 'Progress bar', group: 'Progress / rating', kind: 'number', defaults: { min: 0, max: 100, display: 'bar' } },
  rating: { label: 'Rating', group: 'Progress / rating', kind: 'number', defaults: { max: 5 } },

  time: { label: 'Time', group: 'Time', kind: 'time' },
  starttime: { label: 'Start time', group: 'Time', kind: 'time' },
  endtime: { label: 'End time', group: 'Time', kind: 'time' },
  duration: { label: 'Duration (minutes)', group: 'Time', kind: 'number' },

  relation: { label: 'Relation to tracker', group: 'Relationships', kind: 'relation', defaults: { targetTrackerId: null, cardinality: 'one-to-many' } },

  formula: { label: 'Formula', group: 'Special', kind: 'formula', defaults: { expression: '', format: 'number', precision: 0 } },
  file: { label: 'File / attachment', group: 'Special', kind: 'file', defaults: {} },
};

export const RELATION_CARDINALITIES = [
  { value: 'one-to-many', label: 'One target per item (many items may share it)' },
  { value: 'one-to-one', label: 'One target per item (each target used once)' },
  { value: 'many-to-many', label: 'Multiple targets per item' },
];

export function typeInfo(type) {
  return FIELD_TYPES[type] || FIELD_TYPES.text;
}

export function fieldKind(field) {
  const k = typeInfo(field.type).kind;
  if (k === 'formula') return `formula:${field.config?.format || 'number'}`;
  return k;
}

export function createField(type, name, overrides = {}) {
  const info = typeInfo(type);
  const { config: cfg, ...rest } = overrides;
  return {
    id: newId('fld'),
    name,
    type,
    required: false,
    default: null,
    config: { ...structuredCloneSafe(info.defaults || {}), ...(cfg || {}) },
    ...rest,
  };
}

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function createOption(label, extra = {}) {
  return { id: newId('opt'), label, icon: '', color: '#898781', done: false, ...extra };
}

export const OPTION_COLORS = ['#898781', '#3682e0', '#199e70', '#d03b3b', '#c99a2e', '#8a5fd6', '#d5487a', '#d0733b', '#3f9e9e', '#5f7ad6'];

export function options(field) {
  return field.config?.options || [];
}

export function optionById(field, id) {
  return options(field).find((o) => o.id === id);
}

export function isMultiValued(field) {
  if (field.type === 'multiselect') return true;
  if (field.type === 'select') return Boolean(field.config?.multiple);
  if (field.type === 'relation') return field.config?.cardinality === 'many-to-many';
  return field.type === 'file';
}

export function emptyValue(field) {
  return isMultiValued(field) ? [] : field.type === 'boolean' ? false : null;
}

export function isEmpty(value, field) {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (field?.type === 'boolean') return false;
  return false;
}

export function nowLocalIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** The value a brand-new item gets for this field. */
export function defaultValue(field) {
  if (field.type === 'formula') return null;
  if (field.default !== null && field.default !== undefined && field.default !== '') {
    return isMultiValued(field) && !Array.isArray(field.default) ? [field.default] : field.default;
  }
  if (field.type === 'date' && field.config?.defaultToday) return todayKey();
  if (field.type === 'datetime' && field.config?.defaultToday) return nowLocalIso();
  if (field.type === 'percentage' || field.type === 'progress') {
    return field.required ? field.config?.min ?? 0 : null;
  }
  return emptyValue(field);
}

export function isNumericValue(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

export function toNumber(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Text rendering used for search, sorting labels, exports and formulas. */
export function formatValue(value, field, ctx) {
  if (value === null || value === undefined || value === '') return '';
  switch (field.type) {
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'select':
    case 'multiselect': {
      const ids = Array.isArray(value) ? value : [value];
      return ids.map((id) => optionById(field, id)?.label ?? id).join(', ');
    }
    case 'percentage':
    case 'progress':
      return `${value}%`;
    case 'rating':
      return `${value}/${field.config?.max ?? 5}`;
    case 'duration':
      return formatDuration(Number(value));
    case 'number':
    case 'decimal': {
      const n = Number(value);
      const shown = field.type === 'decimal' ? n.toFixed(field.config?.precision ?? 2) : String(n);
      return field.config?.unit ? `${shown} ${field.config.unit}` : shown;
    }
    case 'date':
      return formatDateDMY(String(value).slice(0, 10));
    case 'datetime':
      return `${formatDateDMY(String(value).slice(0, 10))} ${String(value).slice(11, 16)}`;
    case 'relation': {
      const ids = Array.isArray(value) ? value : [value];
      return ids.map((id) => ctx?.itemLabel?.(id) ?? '').filter(Boolean).join(', ');
    }
    case 'file':
      return (value || []).map((f) => f.name).join(', ');
    default:
      return String(value);
  }
}

export function formatFormulaResult(result, field) {
  if (result === null || result === undefined || result === '') return '';
  if (typeof result === 'object' && result.error) return '#ERR';
  const fmt = field.config?.format || 'number';
  const precision = field.config?.precision ?? 0;
  if (fmt === 'text') return String(result);
  if (fmt === 'boolean') return result ? 'Yes' : 'No';
  if (fmt === 'date') return formatDateDMY(String(result).slice(0, 10));
  const n = Number(result);
  if (!Number.isFinite(n)) return String(result);
  const shown = n.toFixed(precision);
  return fmt === 'percent' ? `${shown}%` : shown;
}
