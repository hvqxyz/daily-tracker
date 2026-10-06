// Runtime context + value access. Everything is driven by the tracker schema;
// nothing here knows what a particular tracker "means".

import { todayKey } from '../../common/time.js';
import { evaluateFormula } from './formula.js';
import { emptyValue, formatValue, formatFormulaResult, nowLocalIso, options, toNumber } from './fieldTypes.js';

const MAX_FORMULA_DEPTH = 6;

export function makeCtx(trackers, items, opts = {}) {
  const trackerMap = new Map(trackers.map((t) => [t.id, t]));
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const childMap = new Map();
  for (const item of items) {
    if (!item.parentId) continue;
    if (!childMap.has(item.parentId)) childMap.set(item.parentId, []);
    childMap.get(item.parentId).push(item);
  }

  const ctx = {
    trackers,
    items,
    today: opts.today || todayKey(),
    depth: 0,
    formulaCache: new Map(),
    trackerById: (id) => trackerMap.get(id),
    itemById: (id) => itemMap.get(id),
    children: (id) => (childMap.get(id) || []).filter((c) => !c.archived),
    itemsOf: (trackerId) => items.filter((i) => i.trackerId === trackerId),
    itemLabel: (id) => {
      const item = itemMap.get(id);
      if (!item) return '';
      const tracker = trackerMap.get(item.trackerId);
      return tracker ? itemLabel(tracker, item, ctx) : '';
    },
  };
  return ctx;
}

export function findField(tracker, name) {
  const wanted = String(name).trim().toLowerCase();
  return tracker.fields.find((f) => f.name.trim().toLowerCase() === wanted);
}

export function titleField(tracker) {
  const byId = tracker.fields.find((f) => f.id === tracker.settings?.titleFieldId);
  if (byId) return byId;
  return tracker.fields.find((f) => f.type === 'text') || tracker.fields.find((f) => ['longtext', 'url', 'email'].includes(f.type)) || tracker.fields[0];
}

/** Display label for an item, driven by the tracker's chosen "display field". */
export function itemLabel(tracker, item, ctx) {
  const field = titleField(tracker);
  if (field) {
    const text = field.type === 'formula' ? formatFormulaResult(getValue(item, field, ctx), field) : formatValue(rawValue(item, field), field, ctx);
    if (text) return text;
  }
  for (const f of tracker.fields) {
    if (f.type === 'formula' || f.type === 'file') continue;
    const text = formatValue(rawValue(item, f), f, ctx);
    if (text) return text;
  }
  return 'Untitled';
}

export function rawValue(item, field) {
  const v = item.values?.[field.id];
  return v === undefined ? emptyValue(field) : v;
}

export function isItemDone(item, tracker) {
  for (const field of tracker.fields) {
    if (field.type !== 'select' && field.type !== 'multiselect') continue;
    const v = item.values?.[field.id];
    const ids = Array.isArray(v) ? v : v ? [v] : [];
    if (ids.some((id) => options(field).find((o) => o.id === id)?.done)) return true;
  }
  return false;
}

/** Value as seen from a formula. */
function formulaValue(item, field, ctx) {
  const v = getValue(item, field, ctx);
  if (v === null || v === undefined) return null;
  switch (field.type) {
    case 'select':
    case 'multiselect': {
      const labels = (Array.isArray(v) ? v : [v]).map((id) => options(field).find((o) => o.id === id)?.label ?? id);
      return field.type === 'multiselect' || field.config?.multiple ? labels : labels[0] ?? null;
    }
    case 'relation':
      return Array.isArray(v) ? v : [v];
    case 'file':
      return (v || []).map((f) => f.name);
    default:
      return v;
  }
}

function buildScope(item, tracker, ctx) {
  return {
    field: (name) => {
      const f = findField(tracker, name);
      return f ? formulaValue(item, f, ctx) : undefined;
    },
    today: () => ctx.today,
    now: () => nowLocalIso(),
    fns: {
      labels: ([ids]) => (Array.isArray(ids) ? ids : ids ? [ids] : []).map((id) => ctx.itemLabel(id)),
      rollup: ([ids, fieldName, agg]) => {
        const list = (Array.isArray(ids) ? ids : ids ? [ids] : []).map((id) => ctx.itemById(id)).filter(Boolean);
        const values = [];
        for (const target of list) {
          const tt = ctx.trackerById(target.trackerId);
          const f = tt && findField(tt, fieldName);
          if (!f) continue;
          const v = getValue(target, f, ctx);
          if (v !== null && v !== undefined && v !== '') values.push(v);
        }
        const numbers = values.map(toNumber).filter((n) => n !== null);
        switch (String(agg || 'sum').toLowerCase()) {
          case 'count': return values.length;
          case 'avg': return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null;
          case 'min': return numbers.length ? Math.min(...numbers) : null;
          case 'max': return numbers.length ? Math.max(...numbers) : null;
          default: return numbers.reduce((a, b) => a + b, 0);
        }
      },
      children: () => ctx.children(item.id).length,
      childrendone: () => ctx.children(item.id).filter((c) => {
        const ct = ctx.trackerById(c.trackerId);
        return ct && isItemDone(c, ct);
      }).length,
      isdone: () => isItemDone(item, tracker),
    },
  };
}

/** { value } | { error } for a formula field on an item. */
export function getFormula(item, field, ctx) {
  const key = `${item.id}:${field.id}:${field.config?.expression}`;
  if (ctx.formulaCache.has(key)) return ctx.formulaCache.get(key);
  const tracker = ctx.trackerById(item.trackerId);
  if (!tracker) return { value: null };
  if (ctx.depth >= MAX_FORMULA_DEPTH) return { error: 'Formula too deeply nested (circular?)' };
  ctx.depth += 1;
  let result;
  try {
    result = evaluateFormula(field.config?.expression || '', buildScope(item, tracker, ctx));
  } finally {
    ctx.depth -= 1;
  }
  if (ctx.depth === 0) ctx.formulaCache.set(key, result);
  return result;
}

/** The typed value of a field on an item (formulas are computed). */
export function getValue(item, field, ctx) {
  if (field.type === 'formula') {
    const r = getFormula(item, field, ctx);
    return r.error ? null : r.value ?? null;
  }
  return rawValue(item, field);
}
