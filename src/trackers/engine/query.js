// Filtering, sorting, grouping and searching. All behaviour is derived from
// field *kinds*, so any field of any tracker works without special cases.

import { fieldKind, formatValue, formatFormulaResult, isEmpty, isMultiValued, options, toNumber, typeInfo } from './fieldTypes.js';
import { getValue, getFormula, itemLabel } from './data.js';

const TEXT_OPS = [
  { value: 'contains', label: 'contains', input: 'text' },
  { value: 'notcontains', label: 'does not contain', input: 'text' },
  { value: 'equals', label: 'is', input: 'text' },
  { value: 'notequals', label: 'is not', input: 'text' },
  { value: 'empty', label: 'is empty', input: null },
  { value: 'notempty', label: 'is not empty', input: null },
];
const NUMBER_OPS = [
  { value: 'eq', label: '=', input: 'number' },
  { value: 'neq', label: '≠', input: 'number' },
  { value: 'gt', label: '>', input: 'number' },
  { value: 'gte', label: '≥', input: 'number' },
  { value: 'lt', label: '<', input: 'number' },
  { value: 'lte', label: '≤', input: 'number' },
  { value: 'empty', label: 'is empty', input: null },
  { value: 'notempty', label: 'is not empty', input: null },
];
const DATE_OPS = [
  { value: 'on', label: 'is', input: 'date' },
  { value: 'before', label: 'is before', input: 'date' },
  { value: 'after', label: 'is after', input: 'date' },
  { value: 'onorbefore', label: 'is on or before', input: 'date' },
  { value: 'onorafter', label: 'is on or after', input: 'date' },
  { value: 'empty', label: 'is empty', input: null },
  { value: 'notempty', label: 'is not empty', input: null },
];
const TIME_OPS = DATE_OPS.map((o) => (o.input === 'date' ? { ...o, input: 'time' } : o));
const SELECT_OPS = [
  { value: 'is', label: 'is', input: 'option' },
  { value: 'isnot', label: 'is not', input: 'option' },
  { value: 'empty', label: 'is empty', input: null },
  { value: 'notempty', label: 'is not empty', input: null },
];
const MULTI_OPS = [
  { value: 'has', label: 'contains', input: 'option' },
  { value: 'hasnot', label: 'does not contain', input: 'option' },
  { value: 'empty', label: 'is empty', input: null },
  { value: 'notempty', label: 'is not empty', input: null },
];
const BOOLEAN_OPS = [
  { value: 'true', label: 'is checked', input: null },
  { value: 'false', label: 'is not checked', input: null },
];
const RELATION_OPS = [
  { value: 'has', label: 'links to', input: 'item' },
  { value: 'hasnot', label: 'does not link to', input: 'item' },
  { value: 'empty', label: 'is empty', input: null },
  { value: 'notempty', label: 'is not empty', input: null },
];
const PRESENCE_OPS = [
  { value: 'empty', label: 'is empty', input: null },
  { value: 'notempty', label: 'is not empty', input: null },
];

export function filterOpsFor(field) {
  const kind = fieldKind(field);
  if (kind.startsWith('formula:')) {
    const fmt = kind.slice(8);
    if (fmt === 'text') return TEXT_OPS;
    if (fmt === 'date') return DATE_OPS;
    if (fmt === 'boolean') return BOOLEAN_OPS;
    return NUMBER_OPS;
  }
  switch (kind) {
    case 'text': return TEXT_OPS;
    case 'number': return NUMBER_OPS;
    case 'date':
    case 'datetime': return DATE_OPS;
    case 'time': return TIME_OPS;
    case 'boolean': return BOOLEAN_OPS;
    case 'select': return isMultiValued(field) ? MULTI_OPS : SELECT_OPS;
    case 'relation': return RELATION_OPS;
    default: return PRESENCE_OPS;
  }
}

export function opInput(field, op) {
  return filterOpsFor(field).find((o) => o.value === op)?.input ?? null;
}

export function newFilter(field) {
  return { id: `f_${Math.random().toString(36).slice(2, 8)}`, fieldId: field.id, op: filterOpsFor(field)[0].value, value: '' };
}

function asList(v) {
  return Array.isArray(v) ? v : v === null || v === undefined || v === '' ? [] : [v];
}

export function matchesFilter(item, filter, tracker, ctx) {
  const field = tracker.fields.find((f) => f.id === filter.fieldId);
  if (!field) return true;
  const v = getValue(item, field, ctx);
  const { op, value } = filter;
  const kind = fieldKind(field);
  const blank = isEmpty(v, field);

  if (op === 'empty') return blank;
  if (op === 'notempty') return !blank;
  if (op === 'true') return v === true;
  if (op === 'false') return v !== true;

  if (kind === 'select' || kind === 'relation') {
    const list = asList(v);
    if (op === 'is' || op === 'has') return list.includes(value);
    return !list.includes(value); // isnot / hasnot
  }

  if (op === 'contains' || op === 'notcontains' || op === 'equals' || op === 'notequals') {
    const hay = (kind.startsWith('formula:') ? formatFormulaResult(v, field) : formatValue(v, field, ctx)).toLowerCase();
    const needle = String(value ?? '').toLowerCase();
    if (op === 'contains') return hay.includes(needle);
    if (op === 'notcontains') return !hay.includes(needle);
    if (op === 'equals') return hay === needle;
    return hay !== needle;
  }

  if (['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(op)) {
    const a = toNumber(v);
    const b = toNumber(value);
    if (a === null || b === null) return op === 'neq';
    return { eq: a === b, neq: a !== b, gt: a > b, gte: a >= b, lt: a < b, lte: a <= b }[op];
  }

  if (['on', 'before', 'after', 'onorbefore', 'onorafter'].includes(op)) {
    if (blank) return false;
    const isTime = kind === 'time';
    const target = value === 'today' ? ctx.today : String(value ?? '');
    if (!target) return true;
    const a = isTime ? String(v) : String(v).slice(0, 10);
    return { on: a === target, before: a < target, after: a > target, onorbefore: a <= target, onorafter: a >= target }[op];
  }
  return true;
}

// ---------------------------------------------------------------------------
// Sorting

function sortKey(item, field, ctx) {
  const v = getValue(item, field, ctx);
  if (isEmpty(v, field)) return null;
  const kind = fieldKind(field);
  if (kind === 'select') {
    const first = asList(v)[0];
    const idx = options(field).findIndex((o) => o.id === first);
    return idx === -1 ? 9999 : idx;
  }
  if (kind === 'number' || kind === 'formula:number' || kind === 'formula:percent') return toNumber(v);
  if (kind === 'boolean') return v ? 1 : 0;
  if (kind === 'relation') return asList(v).map((id) => ctx.itemLabel(id)).join(', ').toLowerCase();
  if (kind === 'file') return asList(v).length;
  if (typeof v === 'number') return v;
  return String(v).toLowerCase();
}

export function compareByField(a, b, field, dir, ctx) {
  const ka = sortKey(a, field, ctx);
  const kb = sortKey(b, field, ctx);
  if (ka === null && kb === null) return 0;
  if (ka === null) return 1; // empties always last
  if (kb === null) return -1;
  const c = typeof ka === 'number' && typeof kb === 'number' ? ka - kb : String(ka).localeCompare(String(kb), undefined, { numeric: true });
  return dir === 'desc' ? -c : c;
}

export function sortItems(items, sorts, tracker, ctx) {
  const active = (sorts || []).map((s) => ({ ...s, field: tracker.fields.find((f) => f.id === s.fieldId) })).filter((s) => s.field);
  if (active.length === 0) return items;
  return [...items].sort((a, b) => {
    for (const s of active) {
      const c = compareByField(a, b, s.field, s.dir, ctx);
      if (c !== 0) return c;
    }
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

// ---------------------------------------------------------------------------
// Searching / grouping

export function matchesSearch(item, term, tracker, ctx) {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  for (const field of tracker.fields) {
    if (field.type === 'file') continue;
    const v = getValue(item, field, ctx);
    const text = field.type === 'formula' ? formatFormulaResult(v, field) : formatValue(v, field, ctx);
    if (text && text.toLowerCase().includes(needle)) return true;
  }
  return false;
}

/** Splits items into ordered groups by one field. Multi-value fields repeat an item in each group. */
export function groupItems(items, fieldId, tracker, ctx) {
  const field = tracker.fields.find((f) => f.id === fieldId);
  if (!field) return [{ key: '__all', label: null, items }];
  const groups = new Map();
  const put = (key, label, meta, item) => {
    if (!groups.has(key)) groups.set(key, { key, label, meta, items: [] });
    groups.get(key).items.push(item);
  };

  for (const item of items) {
    const v = getValue(item, field, ctx);
    const list = asList(v);
    if (list.length === 0) {
      put('__none', 'No value', null, item);
      continue;
    }
    if (field.type === 'boolean') {
      put(v ? 'yes' : 'no', v ? 'Yes' : 'No', null, item);
      continue;
    }
    for (const entry of list) {
      if (fieldKind(field) === 'select') {
        const opt = options(field).find((o) => o.id === entry);
        put(entry, opt?.label ?? String(entry), opt || null, item);
      } else if (fieldKind(field) === 'relation') {
        put(entry, ctx.itemLabel(entry) || 'Unknown', null, item);
      } else {
        const label = field.type === 'formula' ? formatFormulaResult(entry, field) : formatValue(entry, field, ctx);
        put(String(entry), label || String(entry), null, item);
      }
    }
  }

  const result = [...groups.values()];
  const order = (g) => {
    if (g.key === '__none') return Number.MAX_SAFE_INTEGER;
    if (fieldKind(field) === 'select') {
      const idx = options(field).findIndex((o) => o.id === g.key);
      return idx === -1 ? 9998 : idx;
    }
    return 0;
  };
  result.sort((a, b) => (order(a) - order(b)) || a.label.localeCompare(b.label, undefined, { numeric: true }));
  return result;
}

// ---------------------------------------------------------------------------
// Whole-view pipeline

export function viewColumns(tracker, view) {
  const configured = view?.config?.columns;
  const known = new Map(tracker.fields.map((f) => [f.id, f]));
  if (Array.isArray(configured)) {
    return configured.filter((c) => known.has(c.fieldId)).map((c) => ({ ...c, field: known.get(c.fieldId) }));
  }
  return tracker.fields.map((f) => ({ fieldId: f.id, width: null, field: f }));
}

/** Applies a view's filters, search, sorts and (optionally) grouping to a tracker's items. */
export function runView({ tracker, items, view, search = '', ctx, archived = false }) {
  const cfg = view?.config || {};
  let rows = items.filter((i) => i.trackerId === tracker.id && Boolean(i.archived) === archived);
  for (const f of cfg.filters || []) rows = rows.filter((i) => matchesFilter(i, f, tracker, ctx));
  if (search) rows = rows.filter((i) => matchesSearch(i, search, tracker, ctx));

  const sorts = cfg.sorts?.length ? cfg.sorts : tracker.settings?.defaultSort ? [tracker.settings.defaultSort] : [];
  rows = sortItems(rows, sorts, tracker, ctx);
  const groups = cfg.groupBy ? groupItems(rows, cfg.groupBy, tracker, ctx) : [{ key: '__all', label: null, items: rows }];
  return { rows, groups };
}

export { itemLabel, typeInfo, getFormula };
