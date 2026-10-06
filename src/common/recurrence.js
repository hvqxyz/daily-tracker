// Recurring activities are stored as *rules*; individual occurrences are
// resolved from the rule on demand (so future days need no records at all).
// An occurrence only becomes a stored activity when it is changed — moved,
// completed, skipped, edited — and it then carries `recurrenceId` +
// `occurrenceDate` so the rule never generates it a second time.
//
//   rule: { id, title, icon, categoryId, priority, start, duration, fixed, notes,
//           freq: 'daily'|'weekly'|'monthly', interval, weekdays (Mon=0), monthDay (1-31 | 'last'),
//           startDate, endDate, count, pausedFrom, exceptDates[], createdAt }

import { keyToDate, dateToKey, shiftDateKey, weekdayIndex } from './time.js';

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const OVERRIDABLE = ['title', 'icon', 'categoryId', 'priority', 'start', 'duration', 'fixed', 'notes'];

const MS_DAY = 86400000;
const dayNumber = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_DAY);
};
const daysInMonth = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
const parts = (key) => key.split('-').map(Number);

export const occurrenceId = (ruleId, dateKey) => `occ_${ruleId}_${dateKey}`;

/** Upgrades old { type, weekdays } rules and fills defaults. Idempotent. */
export function normalizeRule(rule, today) {
  if (rule.freq && rule.startDate !== undefined) return rule;
  return {
    interval: 1,
    monthDay: null,
    endDate: null,
    count: null,
    pausedFrom: null,
    exceptDates: [],
    notes: '',
    createdAt: Date.now(),
    ...rule,
    freq: rule.freq || rule.type || 'daily',
    startDate: rule.startDate ?? today,
    weekdays: rule.weekdays || [],
  };
}

function matchesPattern(rule, dateKey) {
  const start = rule.startDate;
  const n = Math.max(1, Number(rule.interval) || 1);

  if (rule.freq === 'daily') {
    return start ? (dayNumber(dateKey) - dayNumber(start)) % n === 0 : true;
  }
  if (rule.freq === 'weekly') {
    const days = rule.weekdays?.length ? rule.weekdays : start ? [weekdayIndex(start)] : [];
    if (!days.includes(weekdayIndex(dateKey))) return false;
    if (n === 1 || !start) return true;
    const weeksApart = (dayNumber(dateKey) - weekdayIndex(dateKey) - (dayNumber(start) - weekdayIndex(start))) / 7;
    return weeksApart % n === 0;
  }
  if (rule.freq === 'monthly') {
    const [y, m, d] = parts(dateKey);
    const target = rule.monthDay === 'last' ? daysInMonth(y, m - 1) : Math.min(Number(rule.monthDay) || (start ? parts(start)[2] : 1), daysInMonth(y, m - 1));
    if (d !== target) return false;
    if (n === 1 || !start) return true;
    const [sy, sm] = parts(start);
    return ((y * 12 + m) - (sy * 12 + sm)) % n === 0;
  }
  return false;
}

/** Does the rule produce an occurrence on this date (ignoring exceptions)? */
function scheduledOn(rule, dateKey) {
  if (rule.startDate && dateKey < rule.startDate) return false;
  if (rule.endDate && dateKey > rule.endDate) return false;
  if (rule.pausedFrom && dateKey >= rule.pausedFrom) return false;
  return matchesPattern(rule, dateKey);
}

/** 1-based index of this date among the rule's scheduled occurrences (for "N times" limits). */
export function occurrenceIndex(rule, dateKey) {
  const from = rule.startDate || dateKey;
  let count = 0;
  let cur = from;
  for (let guard = 0; cur <= dateKey && guard < 6000; guard += 1) {
    if (matchesPattern(rule, cur) && (!rule.endDate || cur <= rule.endDate)) count += 1;
    cur = shiftDateKey(cur, 1);
  }
  return count;
}

export function occursOn(rule, dateKey) {
  if (!scheduledOn(rule, dateKey)) return false;
  if ((rule.exceptDates || []).includes(dateKey)) return false;
  if (rule.count && occurrenceIndex(rule, dateKey) > rule.count) return false;
  return true;
}

/** All dates the rule occurs on within [from, to] inclusive. */
export function occurrencesBetween(rule, from, to) {
  const out = [];
  let cur = from;
  for (let guard = 0; cur <= to && guard < 4000; guard += 1) {
    if (occursOn(rule, cur)) out.push(cur);
    cur = shiftDateKey(cur, 1);
  }
  return out;
}

/** The (not yet stored) activity a rule yields on a date. */
export function occurrenceOf(rule, dateKey) {
  const start = rule.start ?? null;
  const duration = rule.duration ?? 30;
  return {
    id: occurrenceId(rule.id, dateKey),
    recurrenceId: rule.id,
    occurrenceDate: dateKey,
    virtual: true,
    title: rule.title,
    icon: rule.icon,
    categoryId: rule.categoryId,
    priority: rule.priority,
    start,
    duration,
    plannedStart: start,
    plannedDuration: duration,
    fixed: rule.fixed !== false,
    status: 'planned',
    notes: rule.notes || '',
    overrides: {},
    createdAt: rule.createdAt || 0,
  };
}

export const occDate = (activity, dateKey) => activity.occurrenceDate || dateKey;

/** Occurrences the rules imply for a day that are not already stored on it. */
export function virtualOccurrences(state, dateKey) {
  const day = state.days[dateKey];
  const handled = new Set(day?.materializedRuleIds || []);
  const present = new Set((day?.activities || []).filter((a) => a.recurrenceId).map((a) => `${a.recurrenceId}:${occDate(a, dateKey)}`));
  return (state.recurrences || [])
    .filter((r) => !handled.has(r.id) && !present.has(`${r.id}:${dateKey}`) && occursOn(r, dateKey))
    .map((r) => occurrenceOf(r, dateKey));
}

export function resolveDay(state, dateKey) {
  const day = state.days[dateKey] || { activities: [], materializedRuleIds: [] };
  const virtuals = virtualOccurrences(state, dateKey);
  return virtuals.length ? { ...day, activities: [...day.activities, ...virtuals] } : day;
}

// ---------------------------------------------------------------------------
// Human readable + UI <-> rule conversion

export function describeRule(rule, fmt = (k) => k) {
  const n = Math.max(1, Number(rule.interval) || 1);
  let text;
  if (rule.freq === 'daily') text = n === 1 ? 'Every day' : `Every ${n} days`;
  else if (rule.freq === 'weekly') {
    const days = (rule.weekdays?.length ? rule.weekdays : []).map((d) => WEEKDAY_SHORT[d]).join(', ');
    text = `${n === 1 ? 'Weekly' : `Every ${n} weeks`}${days ? ` on ${days}` : ''}`;
  } else {
    const day = rule.monthDay === 'last' ? 'the last day' : `day ${rule.monthDay || 1}`;
    text = `${n === 1 ? 'Monthly' : `Every ${n} months`} on ${day}`;
  }
  if (rule.endDate) text += ` until ${fmt(rule.endDate)}`;
  else if (rule.count) text += `, ${rule.count} time${rule.count === 1 ? '' : 's'}`;
  if (rule.pausedFrom) text += ' (paused)';
  return text;
}

/** Form state -> the schedule part of a rule. */
export function repeatToRule(repeat, startDate) {
  const base = { startDate, endDate: null, count: null, pausedFrom: null };
  if (repeat.endMode === 'date' && repeat.endDate) base.endDate = repeat.endDate;
  if (repeat.endMode === 'count' && Number(repeat.count) > 0) base.count = Math.floor(Number(repeat.count));
  const interval = Math.max(1, Math.floor(Number(repeat.interval) || 1));
  const [, , d] = parts(startDate);
  const monthDay = repeat.monthLast ? 'last' : Math.min(31, Math.max(1, Number(repeat.monthDay) || d));

  switch (repeat.mode) {
    case 'daily': return { ...base, freq: 'daily', interval: 1, weekdays: [], monthDay: null };
    case 'weekly': return { ...base, freq: 'weekly', interval: 1, weekdays: [...repeat.weekdays].sort(), monthDay: null };
    case 'monthly': return { ...base, freq: 'monthly', interval: 1, weekdays: [], monthDay };
    case 'custom': {
      if (repeat.unit === 'weeks') return { ...base, freq: 'weekly', interval, weekdays: [...repeat.weekdays].sort(), monthDay: null };
      if (repeat.unit === 'months') return { ...base, freq: 'monthly', interval, weekdays: [], monthDay };
      return { ...base, freq: 'daily', interval, weekdays: [], monthDay: null };
    }
    default: return null;
  }
}

export function defaultRepeat(dateKey) {
  const [, , d] = parts(dateKey);
  return { mode: 'never', weekdays: [weekdayIndex(dateKey)], monthDay: d, monthLast: false, interval: 2, unit: 'weeks', endMode: 'never', endDate: '', count: 10 };
}

/** A rule -> form state (for editing a series). */
export function ruleToRepeat(rule) {
  const base = defaultRepeat(rule.startDate || dateToKey(new Date()));
  const n = rule.interval || 1;
  const repeat = {
    ...base,
    weekdays: rule.weekdays?.length ? [...rule.weekdays] : base.weekdays,
    monthDay: rule.monthDay === 'last' ? base.monthDay : rule.monthDay || base.monthDay,
    monthLast: rule.monthDay === 'last',
    interval: n,
    endMode: rule.endDate ? 'date' : rule.count ? 'count' : 'never',
    endDate: rule.endDate || '',
    count: rule.count || 10,
  };
  if (n === 1) return { ...repeat, mode: rule.freq };
  return { ...repeat, mode: 'custom', unit: rule.freq === 'weekly' ? 'weeks' : rule.freq === 'monthly' ? 'months' : 'days' };
}

export function validateRepeat(repeat) {
  if (repeat.mode === 'weekly' && repeat.weekdays.length === 0) return 'Pick at least one weekday.';
  if (repeat.mode === 'custom' && repeat.unit === 'weeks' && repeat.weekdays.length === 0) return 'Pick at least one weekday.';
  if (repeat.endMode === 'date' && !repeat.endDate) return 'Choose an end date.';
  return '';
}

// ---------------------------------------------------------------------------
// Series operations (pure state -> state)

const ACTIVITY_FIELDS = ['title', 'icon', 'categoryId', 'priority', 'start', 'duration', 'fixed', 'notes'];
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

const mapDays = (state, fn) => {
  const days = {};
  for (const [date, day] of Object.entries(state.days)) days[date] = fn(date, day);
  return { ...state, days };
};

const mapRule = (state, ruleId, fn) => ({ ...state, recurrences: state.recurrences.map((r) => (r.id === ruleId ? fn(r) : r)) });

/** Copies changed fields onto stored occurrences of a series that were never touched individually. */
function propagate(state, ruleId, fields, fromDate = null) {
  const keys = ACTIVITY_FIELDS.filter((k) => k in fields);
  if (keys.length === 0) return state;
  return mapDays(state, (date, day) => {
    if (fromDate && date < fromDate) return day;
    let changed = false;
    const activities = day.activities.map((a) => {
      if (a.recurrenceId !== ruleId || a.status !== 'planned') return a;
      const next = { ...a };
      for (const k of keys) {
        if (a.overrides?.[k]) continue;
        next[k] = fields[k];
        if (k === 'start') next.plannedStart = fields[k];
        if (k === 'duration') next.plannedDuration = fields[k];
      }
      changed = true;
      return next;
    });
    return changed ? { ...day, activities } : day;
  });
}

/** Edit the whole series: schedule and/or activity fields. */
export function updateSeries(state, ruleId, { fields = {}, schedule = null }) {
  // the anchor date and a pause survive an edit of the schedule
  const next = mapRule(state, ruleId, (r) => ({ ...r, ...pick(fields, ACTIVITY_FIELDS), ...(schedule || {}), startDate: r.startDate, pausedFrom: r.pausedFrom }));
  return propagate(next, ruleId, fields);
}

/** "This and following": end the old series the day before and start a new one from `dateKey`. */
export function splitSeries(state, ruleId, dateKey, { fields = {}, schedule = null }, newId) {
  const rule = state.recurrences.find((r) => r.id === ruleId);
  if (!rule) return state;
  if (dateKey <= (rule.startDate || '0000-00-00')) return updateSeries(state, ruleId, { fields, schedule });

  const fresh = {
    ...rule,
    ...pick(fields, ACTIVITY_FIELDS),
    ...(schedule || {}),
    id: newId,
    startDate: dateKey,
    exceptDates: (rule.exceptDates || []).filter((d) => d >= dateKey),
    createdAt: Date.now(),
  };
  if (!schedule) fresh.count = null; // the old series ends here; a count no longer applies to the new part
  let next = {
    ...state,
    recurrences: [
      ...state.recurrences.map((r) => (r.id === ruleId ? { ...r, endDate: shiftDateKey(dateKey, -1), count: null, exceptDates: (r.exceptDates || []).filter((d) => d < dateKey) } : r)),
      fresh,
    ],
  };
  next = mapDays(next, (date, day) => (date >= dateKey && day.activities.some((a) => a.recurrenceId === ruleId)
    ? { ...day, activities: day.activities.map((a) => (a.recurrenceId === ruleId ? { ...a, recurrenceId: newId } : a)) }
    : day));
  return propagate(next, newId, fields, dateKey);
}

const removeFuture = (state, ruleId, fromDate) =>
  mapDays(state, (date, day) => {
    if (date < fromDate || !day.activities.some((a) => a.recurrenceId === ruleId && (a.status === 'planned' || a.status === 'moved'))) return day;
    return { ...day, activities: day.activities.filter((a) => !(a.recurrenceId === ruleId && (a.status === 'planned' || a.status === 'moved'))) };
  });

/** Delete the series from a date on (or all of it when the date is at/before its start). */
export function deleteSeriesFrom(state, ruleId, dateKey) {
  const rule = state.recurrences.find((r) => r.id === ruleId);
  if (!rule) return state;
  const next = removeFuture(state, ruleId, dateKey);
  if (dateKey <= (rule.startDate || '0000-00-00')) return { ...next, recurrences: next.recurrences.filter((r) => r.id !== ruleId) };
  return mapRule(next, ruleId, (r) => ({ ...r, endDate: shiftDateKey(dateKey, -1), count: null }));
}

/** Remove the rule and its not-yet-done occurrences from a date on; history stays. */
export function removeSeries(state, ruleId, fromDate) {
  const next = removeFuture(state, ruleId, fromDate);
  return { ...next, recurrences: next.recurrences.filter((r) => r.id !== ruleId) };
}

export function pauseSeries(state, ruleId, dateKey) {
  return mapRule(removeFuture(state, ruleId, dateKey), ruleId, (r) => ({ ...r, pausedFrom: dateKey }));
}

export function resumeSeries(state, ruleId) {
  return mapRule(state, ruleId, (r) => ({ ...r, pausedFrom: null }));
}

/** Stops one occurrence from being generated (deleted, or moved away). */
export function excludeOccurrence(state, ruleId, dateKey) {
  return mapRule(state, ruleId, (r) => ({ ...r, exceptDates: [...new Set([...(r.exceptDates || []), dateKey])] }));
}

/** Turns an implied occurrence into a stored activity (so it can be edited independently). */
export function materializeOccurrence(state, dateKey, activityId) {
  if (!activityId.startsWith('occ_')) return state;
  const day = state.days[dateKey] || { activities: [], materializedRuleIds: [] };
  if (day.activities.some((a) => a.id === activityId)) return state;
  const virtual = virtualOccurrences(state, dateKey).find((a) => a.id === activityId);
  if (!virtual) return state;
  const { virtual: _v, ...stored } = virtual;
  return { ...state, days: { ...state.days, [dateKey]: { ...day, activities: [...day.activities, stored] } } };
}

/** Which fields of a changed activity differ from the stored one (recorded as per-occurrence overrides). */
export function changedFields(before, patch) {
  const out = {};
  for (const k of OVERRIDABLE) if (k in patch && patch[k] !== before[k]) out[k] = true;
  return out;
}

export { keyToDate };
