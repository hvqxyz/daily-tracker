// Pure operations on tracker schemas and items. The store wraps these; they
// are kept free of React/localStorage so they can be unit-tested.

import { newId } from './ids.js';
import { createField, createOption, defaultValue, fieldKind, isMultiValued, options, typeInfo } from './fieldTypes.js';

export const VIEW_TYPES = [
  { value: 'table', label: 'Table', icon: '▦' },
  { value: 'list', label: 'List', icon: '☰' },
  { value: 'board', label: 'Board', icon: '▥' },
  { value: 'hierarchy', label: 'Hierarchy', icon: '🌳' },
  { value: 'calendar', label: 'Calendar', icon: '📅' },
  { value: 'timeline', label: 'Timeline', icon: '⏱' },
];

export function moveInList(list, from, to) {
  if (to < 0 || to >= list.length || from === to) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

const selectFields = (tracker) => tracker.fields.filter((f) => fieldKind(f) === 'select');
const dateFields = (tracker) => tracker.fields.filter((f) => ['date', 'datetime'].includes(f.type) || f.config?.format === 'date');

export function createView(tracker, type, name) {
  const label = name || VIEW_TYPES.find((v) => v.value === type)?.label || 'View';
  const config = { filters: [], sorts: [], groupBy: null };
  const title = tracker.settings?.titleFieldId || tracker.fields[0]?.id;

  if (type === 'table' || type === 'list') {
    const cols = [];
    if (title) cols.push({ fieldId: title, width: null });
    for (const f of tracker.fields) {
      if (f.id === title || f.type === 'longtext' || f.type === 'file') continue;
      if (cols.length >= 5) break;
      cols.push({ fieldId: f.id, width: null });
    }
    config.columns = cols;
  }
  if (type === 'board') {
    config.boardFieldId = selectFields(tracker)[0]?.id ?? null;
    config.columns = tracker.fields.filter((f) => f.id !== title && f.id !== config.boardFieldId && f.type !== 'longtext' && f.type !== 'file').slice(0, 3).map((f) => ({ fieldId: f.id, width: null }));
  }
  if (type === 'calendar') config.dateFieldId = dateFields(tracker)[0]?.id ?? null;
  if (type === 'timeline') {
    const dates = dateFields(tracker);
    config.startFieldId = dates[0]?.id ?? null;
    config.endFieldId = dates[1]?.id ?? null;
  }
  if (type === 'hierarchy') {
    config.columns = tracker.fields.filter((f) => f.id !== title && f.type !== 'longtext' && f.type !== 'file').slice(0, 3).map((f) => ({ fieldId: f.id, width: null }));
  }
  return { id: newId('view'), name: label, type, config };
}

export function newTracker({ name, icon = '📋', description = '' }) {
  return {
    id: newId('trk'),
    name,
    icon,
    description,
    fields: [],
    views: [],
    widgets: [],
    settings: {
      titleFieldId: null,
      defaultViewId: null,
      defaultSort: null,
      allowHierarchy: false,
      allowAttachments: true,
      quickFieldIds: [],
      activity: { categoryId: null, durationFieldId: null, startFieldId: null, updateFieldIds: [] },
    },
    createdAt: Date.now(),
  };
}

/**
 * Fields offered for one-tap updates in the item summary. Uses the tracker's own
 * choice when set; otherwise every percentage / progress field, or — when
 * progress is calculated — the numeric field its percent formula is based on.
 */
export function quickFields(tracker) {
  const chosen = tracker.settings?.quickFieldIds || [];
  const byId = (id) => tracker.fields.find((f) => f.id === id);
  if (chosen.length) return chosen.map(byId).filter((f) => f && f.type !== 'formula');
  const direct = tracker.fields.filter((f) => f.type === 'percentage' || f.type === 'progress');
  if (direct.length) return direct;
  const derived = [];
  for (const f of tracker.fields) {
    if (f.type !== 'formula' || f.config?.format !== 'percent') continue;
    for (const m of String(f.config.expression || '').matchAll(/\{([^}]+)\}/g)) {
      const ref = tracker.fields.find((x) => x.name.trim().toLowerCase() === m[1].trim().toLowerCase());
      if (ref && ['number', 'decimal', 'duration'].includes(ref.type) && !derived.includes(ref)) { derived.push(ref); break; }
    }
  }
  return derived;
}

/**
 * For a numeric quick field that feeds a calculated percentage (e.g. pages read
 * out of pages), returns the field it is measured against: { field, total }.
 */
export function quickTotal(tracker, field, item) {
  for (const f of tracker.fields) {
    if (f.type !== 'formula' || f.config?.format !== 'percent') continue;
    const refs = [...String(f.config.expression || '').matchAll(/\{([^}]+)\}/g)]
      .map((m) => tracker.fields.find((x) => x.name.trim().toLowerCase() === m[1].trim().toLowerCase()))
      .filter(Boolean);
    if (refs[0]?.id !== field.id) continue;
    const denominator = refs.find((r) => r.id !== field.id && ['number', 'decimal', 'duration'].includes(r.type));
    const total = denominator ? Number(item.values?.[denominator.id]) : NaN;
    if (denominator && Number.isFinite(total) && total > 0) return { field: denominator, total };
  }
  return null;
}

/** Fields that can be edited by hand (formulas are computed). */
export const editableFields = (tracker) => tracker.fields.filter((f) => f.type !== 'formula');

export function removeFieldFromTracker(tracker, fieldId) {
  const fields = tracker.fields.filter((f) => f.id !== fieldId);
  const clean = (cfg) => {
    const next = { ...cfg };
    if (next.columns) next.columns = next.columns.filter((c) => c.fieldId !== fieldId);
    if (next.filters) next.filters = next.filters.filter((f) => f.fieldId !== fieldId);
    if (next.sorts) next.sorts = next.sorts.filter((s) => s.fieldId !== fieldId);
    for (const key of ['groupBy', 'boardFieldId', 'dateFieldId', 'startFieldId', 'endFieldId']) {
      if (next[key] === fieldId) next[key] = null;
    }
    return next;
  };
  const cleanWidget = (w) => {
    const cfg = clean(w.config || {});
    for (const key of ['fieldId', 'groupFieldId', 'dateFieldId', 'doneFieldId']) {
      if (cfg[key] === fieldId) cfg[key] = null;
    }
    return { ...w, config: cfg };
  };
  const settings = { ...tracker.settings };
  if (settings.titleFieldId === fieldId) settings.titleFieldId = null;
  if (settings.defaultSort?.fieldId === fieldId) settings.defaultSort = null;
  if (settings.activity) {
    settings.activity = {
      ...settings.activity,
      durationFieldId: settings.activity.durationFieldId === fieldId ? null : settings.activity.durationFieldId,
      startFieldId: settings.activity.startFieldId === fieldId ? null : settings.activity.startFieldId,
      updateFieldIds: (settings.activity.updateFieldIds || []).filter((id) => id !== fieldId),
    };
  }
  return {
    ...tracker,
    fields,
    settings,
    views: tracker.views.map((v) => ({ ...v, config: clean(v.config || {}) })),
    widgets: (tracker.widgets || []).map(cleanWidget),
  };
}

// ---------------------------------------------------------------------------
// Changing a field's type — only allowed when existing values stay meaningful.

const CONVERSION_FAMILIES = [
  ['text', 'longtext', 'url', 'email'],
  ['number', 'decimal', 'percentage', 'progress', 'rating', 'duration'],
  ['date', 'datetime'],
  ['time', 'starttime', 'endtime'],
  ['select', 'multiselect'],
];

export function canConvert(from, to) {
  if (from === to) return true;
  return CONVERSION_FAMILIES.some((fam) => fam.includes(from) && fam.includes(to));
}

/** Returns { field, convertValue } — convertValue maps stored values to the new type. */
export function convertField(field, newType) {
  if (field.type === newType) return { field, convertValue: (v) => v };
  if (!canConvert(field.type, newType)) return null;
  const info = typeInfo(newType);
  const base = createField(newType, field.name);
  const keep = ['options', 'unit', 'min', 'max', 'precision', 'placeholder'];
  const config = { ...base.config };
  for (const k of keep) if (field.config?.[k] !== undefined && k in base.config) config[k] = field.config[k];
  if (info.kind === 'select') config.options = options(field);
  const next = { ...field, type: newType, config };

  let convertValue = (v) => v;
  if (field.type === 'select' && newType === 'multiselect') convertValue = (v) => (v ? [v] : []);
  if (field.type === 'multiselect' && newType === 'select') convertValue = (v) => (Array.isArray(v) ? v[0] ?? null : v);
  if (field.type === 'date' && newType === 'datetime') convertValue = (v) => (v ? `${String(v).slice(0, 10)}T00:00` : v);
  if (field.type === 'datetime' && newType === 'date') convertValue = (v) => (v ? String(v).slice(0, 10) : v);
  if (newType === 'number' || newType === 'duration') convertValue = (v) => (v === null || v === undefined ? v : Math.round(Number(v)));
  return { field: next, convertValue };
}

export function ensureDefaultView(tracker) {
  if (tracker.views.length > 0) return tracker;
  return { ...tracker, views: [createView(tracker, 'table', 'All items')] };
}

// ---------------------------------------------------------------------------
// Items

export function newItem(tracker, values = {}, parentId = null) {
  const base = {};
  for (const f of tracker.fields) {
    const d = defaultValue(f);
    if (d !== null && d !== undefined && !(Array.isArray(d) && d.length === 0)) base[f.id] = d;
  }
  return {
    id: newId('itm'),
    trackerId: tracker.id,
    parentId,
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    values: { ...base, ...values },
  };
}

/** Which required fields are missing a value? */
export function missingRequired(tracker, values) {
  return tracker.fields.filter((f) => {
    if (!f.required || f.type === 'formula') return false;
    const v = values[f.id];
    if (f.type === 'boolean') return false;
    return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
  });
}

/** Walks up the parent chain: would making `parentId` the parent of `itemId` create a cycle? */
export function wouldCycle(items, itemId, parentId) {
  const byId = new Map(items.map((i) => [i.id, i]));
  let cur = parentId;
  let guard = 0;
  while (cur && guard < 1000) {
    if (cur === itemId) return true;
    cur = byId.get(cur)?.parentId;
    guard += 1;
  }
  return false;
}

/** Maps values from one tracker's item to another by matching field name + type. */
export function mapValuesToTracker(item, fromTracker, toTracker) {
  const values = {};
  for (const f of fromTracker.fields) {
    const target = toTracker.fields.find((t) => t.name.toLowerCase() === f.name.toLowerCase() && t.type === f.type);
    if (!target || item.values?.[f.id] === undefined) continue;
    let v = item.values[f.id];
    if (fieldKind(f) === 'select') {
      const labelOf = (id) => options(f).find((o) => o.id === id)?.label;
      const map = (id) => options(target).find((o) => o.label === labelOf(id))?.id;
      v = isMultiValued(f) ? (v || []).map(map).filter(Boolean) : map(v) ?? null;
    }
    values[target.id] = v;
  }
  return values;
}

// ---------------------------------------------------------------------------
// Dashboard widgets

export const WIDGET_TYPES = [
  { value: 'count', label: 'Count', needs: [] },
  { value: 'number', label: 'Sum / average / min / max', needs: ['field', 'agg'] },
  { value: 'progress', label: 'Progress (average)', needs: ['field'] },
  { value: 'completion', label: 'Completion rate', needs: ['doneField'] },
  { value: 'distribution', label: 'Distribution (status, category, …)', needs: ['groupField'] },
  { value: 'chart', label: 'Chart (group + aggregate)', needs: ['groupField', 'agg'] },
  { value: 'recent', label: 'Recent items', needs: [] },
  { value: 'upcoming', label: 'Upcoming dates', needs: ['dateField'] },
  { value: 'list', label: 'Custom filtered list', needs: [] },
];

export function newWidget(type, title, config = {}) {
  return { id: newId('wid'), type, title, config: { filters: [], agg: 'count', limit: 5, ...config } };
}

/** Widgets suggested purely from the schema — no domain knowledge. */
export function suggestWidgets(tracker) {
  const widgets = [newWidget('count', 'Total items')];
  const selects = selectFields(tracker);
  const withDone = selects.find((f) => options(f).some((o) => o.done));
  if (withDone) widgets.push(newWidget('completion', 'Completion', { doneFieldId: withDone.id }));
  for (const f of selects.slice(0, 2)) widgets.push(newWidget('distribution', `By ${f.name.toLowerCase()}`, { groupFieldId: f.id }));
  const progress = tracker.fields.find((f) => f.type === 'progress' || f.type === 'percentage');
  if (progress) widgets.push(newWidget('progress', `Average ${progress.name.toLowerCase()}`, { fieldId: progress.id, agg: 'avg' }));
  const date = dateFields(tracker)[0];
  if (date) widgets.push(newWidget('upcoming', `Upcoming ${date.name.toLowerCase()}`, { dateFieldId: date.id }));
  widgets.push(newWidget('recent', 'Recently added'));
  return widgets;
}

export { createField, createOption };
