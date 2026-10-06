import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRule, occursOn, occurrencesBetween, resolveDay, describeRule, repeatToRule, defaultRepeat, ruleToRepeat, validateRepeat,
  updateSeries, splitSeries, deleteSeriesFrom, pauseSeries, resumeSeries, excludeOccurrence, materializeOccurrence, changedFields, occurrenceId,
} from './recurrence.js';

const rule = (o) => normalizeRule({ id: 'r1', title: 'Gym', icon: '🏋️', categoryId: 'body', priority: 'should', start: 1080, duration: 60, fixed: true, ...o }, '2026-09-01');
const state = (rules, days = {}) => ({ recurrences: rules, days });
// 2026-09-21 is a Monday
const dates = (r, from, to) => occurrencesBetween(r, from, to);

test('weekly: chosen weekdays only, from the start date on', () => {
  const r = rule({ freq: 'weekly', weekdays: [0, 2, 4], startDate: '2026-09-01' });
  assert.deepEqual(dates(r, '2026-09-21', '2026-09-27'), ['2026-09-21', '2026-09-23', '2026-09-25']); // Mon Wed Fri
  assert.equal(occursOn(r, '2026-08-31'), false);                                                       // before the series
});

test('daily and every-N-days', () => {
  assert.equal(dates(rule({ freq: 'daily', startDate: '2026-09-01' }), '2026-09-10', '2026-09-16').length, 7);
  const every3 = rule({ freq: 'daily', interval: 3, startDate: '2026-09-01' });
  assert.deepEqual(dates(every3, '2026-09-01', '2026-09-10'), ['2026-09-01', '2026-09-04', '2026-09-07', '2026-09-10']);
});

test('every 2 weeks on Sunday until a date (the "Running" example)', () => {
  const r = rule({ freq: 'weekly', interval: 2, weekdays: [6], startDate: '2026-09-20', endDate: '2026-12-31', start: 600, duration: 60 });
  assert.deepEqual(dates(r, '2026-09-20', '2026-10-31'), ['2026-09-20', '2026-10-04', '2026-10-18']);
  assert.equal(occursOn(r, '2026-12-27'), true);   // 14 weeks from Sep 20 (even)
  assert.equal(occursOn(r, '2027-01-10'), false);  // after the end date
});

test('monthly: specific day, last day, short months and every N months', () => {
  const first = rule({ freq: 'monthly', monthDay: 1, startDate: '2026-09-01' });
  assert.deepEqual(dates(first, '2026-09-01', '2026-12-31'), ['2026-10-01', '2026-11-01', '2026-12-01', '2026-09-01'].sort());
  const d31 = rule({ freq: 'monthly', monthDay: 31, startDate: '2026-01-31' });
  assert.deepEqual(dates(d31, '2026-02-01', '2026-04-30'), ['2026-02-28', '2026-03-31', '2026-04-30']); // clamps to month length
  const last = rule({ freq: 'monthly', monthDay: 'last', startDate: '2026-01-01' });
  assert.equal(occursOn(last, '2028-02-29'), true);
  const quarterly = rule({ freq: 'monthly', interval: 3, monthDay: 15, startDate: '2026-01-15' });
  assert.deepEqual(dates(quarterly, '2026-01-01', '2026-12-31'), ['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15']);
});

test('end conditions: end date, number of occurrences, pause, skipped dates', () => {
  const counted = rule({ freq: 'daily', startDate: '2026-09-01', count: 3 });
  assert.deepEqual(dates(counted, '2026-09-01', '2026-09-30'), ['2026-09-01', '2026-09-02', '2026-09-03']);
  const paused = rule({ freq: 'daily', startDate: '2026-09-01', pausedFrom: '2026-09-05' });
  assert.equal(dates(paused, '2026-09-01', '2026-09-10').length, 4);
  const except = rule({ freq: 'daily', startDate: '2026-09-01', exceptDates: ['2026-09-02'] });
  assert.equal(occursOn(except, '2026-09-02'), false);
  assert.equal(occursOn(except, '2026-09-03'), true);
});

test('legacy rules ({type, weekdays}) keep working', () => {
  const r = normalizeRule({ id: 'x', title: 'Old', type: 'weekly', weekdays: [1, 3], start: null, duration: 30 }, '2026-09-01');
  assert.equal(r.freq, 'weekly');
  assert.equal(r.interval, 1);
  assert.equal(r.startDate, '2026-09-01');
  assert.equal(occursOn(r, '2026-09-22'), true);   // Tuesday
  assert.equal(occursOn(r, '2026-09-21'), false);
  assert.equal(normalizeRule(r, '2030-01-01'), r); // idempotent
});

test('resolving a day: occurrences appear with no stored records', () => {
  const s = state([rule({ freq: 'weekly', weekdays: [0], startDate: '2026-09-01' })]);
  const day = resolveDay(s, '2026-09-28');
  assert.equal(day.activities.length, 1);
  assert.equal(day.activities[0].id, occurrenceId('r1', '2026-09-28'));
  assert.equal(day.activities[0].start, 1080);
  assert.equal(s.days['2026-09-28'], undefined);                         // nothing stored
  assert.equal(resolveDay(s, '2026-09-29').activities.length, 0);
  // a day flagged as already handled (legacy) does not generate
  const legacy = state(s.recurrences, { '2026-09-28': { activities: [], materializedRuleIds: ['r1'] } });
  assert.equal(resolveDay(legacy, '2026-09-28').activities.length, 0);
});

test('changing one occurrence only affects that occurrence', () => {
  let s = state([rule({ freq: 'weekly', weekdays: [0, 2, 4], startDate: '2026-09-01' })]);
  const wed = occurrenceId('r1', '2026-09-23');
  s = materializeOccurrence(s, '2026-09-23', wed);
  s.days['2026-09-23'].activities[0] = { ...s.days['2026-09-23'].activities[0], start: 1140, overrides: changedFields({ start: 1080 }, { start: 1140 }) };
  const wedDay = resolveDay(s, '2026-09-23');
  assert.equal(wedDay.activities.length, 1);                              // materialized, not duplicated
  assert.equal(wedDay.activities[0].start, 1140);
  assert.equal(resolveDay(s, '2026-09-25').activities[0].start, 1080);    // Friday untouched
  assert.equal(resolveDay(s, '2026-09-21').activities[0].start, 1080);
});

test('deleting an occurrence adds an exception; the rest of the series stays', () => {
  let s = state([rule({ freq: 'daily', startDate: '2026-09-01' })]);
  s = excludeOccurrence(s, 'r1', '2026-09-10');
  assert.equal(resolveDay(s, '2026-09-10').activities.length, 0);
  assert.equal(resolveDay(s, '2026-09-11').activities.length, 1);
});

test('entire series edit skips occurrences that were changed individually', () => {
  let s = state([rule({ freq: 'daily', startDate: '2026-09-01' })]);
  s = materializeOccurrence(s, '2026-09-23', occurrenceId('r1', '2026-09-23'));
  s = materializeOccurrence(s, '2026-09-24', occurrenceId('r1', '2026-09-24'));
  const a = s.days['2026-09-24'].activities[0];
  s.days['2026-09-24'].activities[0] = { ...a, start: 1200, overrides: { start: true } };
  s = updateSeries(s, 'r1', { fields: { start: 1140, title: 'Gym+' } });
  assert.equal(s.recurrences[0].start, 1140);
  assert.equal(s.days['2026-09-23'].activities[0].start, 1140);            // untouched occurrence follows the series
  assert.equal(s.days['2026-09-24'].activities[0].start, 1200);            // individually moved one keeps its time…
  assert.equal(s.days['2026-09-24'].activities[0].title, 'Gym+');          // …but still follows other fields
  assert.equal(resolveDay(s, '2026-09-30').activities[0].start, 1140);
});

test('completed occurrences are history and never rewritten by a series edit', () => {
  let s = state([rule({ freq: 'daily', startDate: '2026-09-01' })]);
  s = materializeOccurrence(s, '2026-09-20', occurrenceId('r1', '2026-09-20'));
  s.days['2026-09-20'].activities[0] = { ...s.days['2026-09-20'].activities[0], status: 'completed' };
  s = updateSeries(s, 'r1', { fields: { duration: 90 } });
  assert.equal(s.days['2026-09-20'].activities[0].duration, 60);
  assert.equal(resolveDay(s, '2026-09-21').activities[0].duration, 90);
});

test('this and following: old series ends, new one starts with the new values', () => {
  let s = state([rule({ freq: 'weekly', weekdays: [0, 2], startDate: '2026-09-01' })]);
  s = materializeOccurrence(s, '2026-10-05', occurrenceId('r1', '2026-10-05'));
  s = splitSeries(s, 'r1', '2026-10-05', { fields: { start: 1200 } }, 'r2');
  assert.equal(s.recurrences.length, 2);
  assert.equal(s.recurrences[0].endDate, '2026-10-04');
  assert.equal(s.recurrences[1].startDate, '2026-10-05');
  assert.equal(resolveDay(s, '2026-09-28').activities[0].start, 1080);      // before: old time
  assert.equal(resolveDay(s, '2026-10-07').activities[0].start, 1200);      // after: new time
  assert.equal(resolveDay(s, '2026-10-05').activities.length, 1);           // no duplicate on the split day
  assert.equal(s.days['2026-10-05'].activities[0].recurrenceId, 'r2');
  assert.equal(s.days['2026-10-05'].activities[0].start, 1200);
});

test('delete this and following / entire series / pause and resume', () => {
  let s = state([rule({ freq: 'daily', startDate: '2026-09-01' })]);
  s = deleteSeriesFrom(s, 'r1', '2026-09-10');
  assert.equal(s.recurrences[0].endDate, '2026-09-09');
  assert.equal(resolveDay(s, '2026-09-09').activities.length, 1);
  assert.equal(resolveDay(s, '2026-09-10').activities.length, 0);
  assert.equal(deleteSeriesFrom(s, 'r1', '2026-08-01').recurrences.length, 0);

  let p = state([rule({ freq: 'daily', startDate: '2026-09-01' })]);
  p = materializeOccurrence(p, '2026-09-22', occurrenceId('r1', '2026-09-22'));
  p = pauseSeries(p, 'r1', '2026-09-21');
  assert.equal(resolveDay(p, '2026-09-22').activities.length, 0);           // stored future occurrence removed
  assert.equal(resolveDay(p, '2026-09-20').activities.length, 1);           // history intact
  p = resumeSeries(p, 'r1');
  assert.equal(resolveDay(p, '2026-09-22').activities.length, 1);
});

test('form <-> rule round trip and descriptions', () => {
  const start = '2026-09-20';
  const repeat = { ...defaultRepeat(start), mode: 'weekly', weekdays: [0, 2, 4] };
  const r = repeatToRule(repeat, start);
  assert.deepEqual([r.freq, r.interval, r.weekdays], ['weekly', 1, [0, 2, 4]]);
  assert.equal(describeRule(r), 'Weekly on Mon, Wed, Fri');
  const custom = repeatToRule({ ...defaultRepeat(start), mode: 'custom', unit: 'weeks', interval: 2, weekdays: [6], endMode: 'date', endDate: '2026-12-31' }, start);
  assert.equal(describeRule(custom, (k) => k), 'Every 2 weeks on Sun until 2026-12-31');
  assert.deepEqual([ruleToRepeat(custom).mode, ruleToRepeat(custom).unit, ruleToRepeat(custom).endMode], ['custom', 'weeks', 'date']);
  assert.equal(ruleToRepeat(r).mode, 'weekly');
  assert.equal(describeRule(repeatToRule({ ...defaultRepeat(start), mode: 'monthly', monthDay: 1 }, start)), 'Monthly on day 1');
  assert.equal(describeRule(repeatToRule({ ...defaultRepeat(start), mode: 'monthly', monthLast: true }, start)), 'Monthly on the last day');
  assert.equal(describeRule(repeatToRule({ ...defaultRepeat(start), mode: 'daily', endMode: 'count', count: 5 }, start)), 'Every day, 5 times');
  assert.equal(repeatToRule({ ...defaultRepeat(start), mode: 'never' }, start), null);
  assert.ok(validateRepeat({ ...defaultRepeat(start), mode: 'weekly', weekdays: [] }));
  assert.equal(validateRepeat({ ...defaultRepeat(start), mode: 'weekly' }), '');
});
