// Dashboard widget computation. Widgets are pure config — each one names the
// fields it reads, so no tracker needs a hard-coded dashboard.

import { fieldKind, formatValue, options, toNumber } from './fieldTypes.js';
import { getValue, isItemDone, itemLabel } from './data.js';
import { groupItems, matchesFilter } from './query.js';
import { shiftDateKey } from '../../common/time.js';

function scopedItems(widget, tracker, items, ctx) {
  let rows = items.filter((i) => i.trackerId === tracker.id && !i.archived);
  for (const f of widget.config?.filters || []) rows = rows.filter((i) => matchesFilter(i, f, tracker, ctx));
  return rows;
}

export function aggregate(values, agg) {
  const numbers = values.map(toNumber).filter((n) => n !== null);
  switch (agg) {
    case 'sum': return numbers.reduce((a, b) => a + b, 0);
    case 'avg': return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null;
    case 'min': return numbers.length ? Math.min(...numbers) : null;
    case 'max': return numbers.length ? Math.max(...numbers) : null;
    default: return values.filter((v) => v !== null && v !== undefined && v !== '').length;
  }
}

const field = (tracker, id) => tracker.fields.find((f) => f.id === id);

/** Returns a plain data object the widget renderer draws; { missing } when config is incomplete. */
export function computeWidget(widget, tracker, allItems, ctx) {
  const cfg = widget.config || {};
  const rows = scopedItems(widget, tracker, allItems, ctx);

  switch (widget.type) {
    case 'count':
      return { kind: 'value', value: rows.length, label: 'items' };

    case 'number': {
      const f = field(tracker, cfg.fieldId);
      if (!f && cfg.agg !== 'count') return { missing: 'Choose a field' };
      const values = f ? rows.map((i) => getValue(i, f, ctx)) : rows.map(() => 1);
      const result = aggregate(values, cfg.agg || 'sum');
      return { kind: 'value', value: result === null ? null : Math.round(result * 100) / 100, label: `${cfg.agg || 'sum'}${f ? ` of ${f.name}` : ''}`, unit: f?.config?.unit || (f && ['percentage', 'progress'].includes(f.type) ? '%' : '') };
    }

    case 'progress': {
      const f = field(tracker, cfg.fieldId);
      if (!f) return { missing: 'Choose a percentage / progress field' };
      const max = f.config?.max ?? 100;
      const min = f.config?.min ?? 0;
      const avg = aggregate(rows.map((i) => getValue(i, f, ctx)), cfg.agg === 'sum' ? 'sum' : 'avg');
      const percent = avg === null ? 0 : Math.max(0, Math.min(100, ((avg - min) / (max - min || 1)) * 100));
      return { kind: 'progress', percent: Math.round(percent), label: f.name, count: rows.length };
    }

    case 'completion': {
      const f = field(tracker, cfg.doneFieldId);
      if (!f || fieldKind(f) !== 'select') return { missing: 'Choose a select field with a "completed" option' };
      const doneIds = new Set(options(f).filter((o) => o.done).map((o) => o.id));
      if (doneIds.size === 0) return { missing: `No option of "${f.name}" is marked as completed` };
      const done = rows.filter((i) => {
        const v = getValue(i, f, ctx);
        return (Array.isArray(v) ? v : [v]).some((id) => doneIds.has(id));
      }).length;
      return { kind: 'progress', percent: rows.length ? Math.round((done / rows.length) * 100) : 0, label: `${done} of ${rows.length} completed` };
    }

    case 'distribution':
    case 'chart': {
      const g = field(tracker, cfg.groupFieldId);
      if (!g) return { missing: 'Choose a field to group by' };
      const groups = groupItems(rows, g.id, tracker, ctx);
      const valueField = widget.type === 'chart' ? field(tracker, cfg.fieldId) : null;
      const agg = widget.type === 'chart' ? cfg.agg || 'count' : 'count';
      const bars = groups.map((grp) => ({
        key: grp.key,
        label: grp.label ?? 'All',
        color: grp.meta?.color || null,
        icon: grp.meta?.icon || '',
        value: agg === 'count' || !valueField
          ? grp.items.length
          : aggregate(grp.items.map((i) => getValue(i, valueField, ctx)), agg) ?? 0,
      }));
      return { kind: 'bars', bars, total: rows.length };
    }

    case 'recent': {
      const limit = cfg.limit || 5;
      const list = [...rows].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, limit);
      return { kind: 'items', items: list.map((i) => ({ id: i.id, label: itemLabel(tracker, i, ctx) })) };
    }

    case 'upcoming': {
      const f = field(tracker, cfg.dateFieldId);
      if (!f) return { missing: 'Choose a date field' };
      const from = ctx.today;
      const to = cfg.days ? shiftDateKey(from, Number(cfg.days)) : null;
      const list = rows
        .map((i) => ({ i, date: String(getValue(i, f, ctx) || '').slice(0, 10) }))
        .filter(({ date }) => date && date >= from && (!to || date <= to))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, cfg.limit || 5);
      return { kind: 'items', items: list.map(({ i, date }) => ({ id: i.id, label: itemLabel(tracker, i, ctx), meta: formatValue(date, { type: 'date' }) })) };
    }

    case 'list': {
      const limit = cfg.limit || 8;
      return { kind: 'items', items: rows.slice(0, limit).map((i) => ({ id: i.id, label: itemLabel(tracker, i, ctx), done: isItemDone(i, tracker) })), total: rows.length };
    }

    default:
      return { missing: 'Unknown widget type' };
  }
}
