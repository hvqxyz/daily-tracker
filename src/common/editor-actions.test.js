import test from 'node:test';
import assert from 'node:assert/strict';
import { submitActions, deleteActions, statusActions } from './editor-actions.js';

const fields = { title: 'Gym', icon: '🏋️', categoryId: 'body', priority: 'required', duration: 60, fixed: true, start: 600, notes: 'n', link: { trackerId: 't', itemId: 'i' }, noteId: 'note1', activityId: 'ad_gym' };
const add = { editing: null, series: null, rule: null, dateKey: '2026-10-16' };
const types = (actions) => actions.map((a) => a.type);

test('adding a library activity schedules it and records it as recent — nothing is added to the library', () => {
  const actions = submitActions(add, { ...fields, repeat: null });
  assert.deepEqual(types(actions), ['addActivity', 'recordRecent']);
  assert.deepEqual(actions[0].fields, fields, 'notes, link, note and library reference are all kept');
});

test('a one-off reaches the library only when asked', () => {
  const oneOff = { ...fields, activityId: null, title: 'Dentist' };
  assert.deepEqual(types(submitActions(add, oneOff)), ['addActivity', 'recordRecent']);
  const saved = submitActions(add, oneOff, { saveToLibrary: true });
  assert.deepEqual(types(saved), ['saveDefinition', 'addActivity', 'recordRecent']);
  assert.deepEqual(saved[0].definition, { title: 'Dentist', icon: '🏋️', categoryId: 'body', priority: 'required', duration: 60, fixed: true, start: null });
});

test('adding with repeat creates a recurring rule carrying every field', () => {
  const repeat = { mode: 'daily' };
  const actions = submitActions(add, { ...fields, repeat });
  assert.deepEqual(types(actions), ['addRecurring', 'recordRecent']);
  assert.equal(actions[0].repeat, repeat);
  assert.deepEqual(actions[0].fields, fields);
});

test('editing a one-off updates just that activity', () => {
  const editing = { id: 'act_1' };
  assert.deepEqual(submitActions({ ...add, editing }, fields), [{ type: 'updateActivity', dateKey: '2026-10-16', id: 'act_1', fields }]);
});

test('editing a recurring occurrence follows the chosen scope and always updates the occurrence itself', () => {
  const session = { ...add, editing: { id: 'occ_r1_2026-10-16', recurrenceId: 'r1' }, rule: { id: 'r1' } };
  assert.throws(() => submitActions(session, fields));
  assert.deepEqual(types(submitActions(session, fields, { scope: 'occurrence' })), ['updateActivity']);
  const following = submitActions(session, fields, { scope: 'following' });
  assert.deepEqual(types(following), ['splitSeries', 'updateActivity']);
  assert.equal(following[0].from, '2026-10-16');
  assert.deepEqual(types(submitActions(session, fields, { scope: 'series' })), ['updateSeries', 'updateActivity']);
});

test('a moved occurrence splits the series at its own date, not the day it was moved to', () => {
  const session = { ...add, editing: { id: 'act_x', recurrenceId: 'r1', occurrenceDate: '2026-10-14' }, rule: { id: 'r1' } };
  assert.equal(submitActions(session, fields, { scope: 'following' })[0].from, '2026-10-14');
});

test('editing the whole series updates the rule and its schedule', () => {
  const repeat = { mode: 'weekly', weekdays: [0] };
  const actions = submitActions({ ...add, editing: { id: null }, series: { id: 'r1' } }, { ...fields, repeat });
  assert.deepEqual(actions, [{ type: 'updateSeries', ruleId: 'r1', fields, repeat }]);
});

test('deleting: one-off, occurrence scopes, and the whole series', () => {
  assert.deepEqual(deleteActions({ ...add, editing: { id: 'a' } }), [{ type: 'deleteActivity', dateKey: '2026-10-16', id: 'a' }]);
  const session = { ...add, editing: { id: 'o', recurrenceId: 'r1' }, rule: { id: 'r1' } };
  assert.deepEqual(types(deleteActions(session, { scope: 'occurrence' })), ['deleteActivity']);
  assert.deepEqual(types(deleteActions(session, { scope: 'following' })), ['deleteSeriesFrom']);
  assert.deepEqual(types(deleteActions(session, { scope: 'series' })), ['deleteRecurrence']);
  assert.deepEqual(deleteActions({ ...add, editing: { id: null }, series: { id: 'r1' } }), [{ type: 'deleteRecurrence', ruleId: 'r1', confirm: true }]);
});

test('marking done keeps unsaved edits on the occurrence first', () => {
  const session = { ...add, editing: { id: 'a' } };
  assert.deepEqual(types(statusActions(session, 'completed')), ['setStatus']);
  const withEdits = statusActions(session, 'completed', { notes: 'x' });
  assert.deepEqual(types(withEdits), ['updateActivity', 'setStatus']);
  assert.deepEqual(withEdits[0].fields, { notes: 'x' });
});

test('an edited activity can be saved to the library and then refers to it', () => {
  const actions = submitActions({ ...add, editing: { id: 'a' } }, { ...fields, activityId: null }, { saveToLibrary: true });
  assert.deepEqual(types(actions), ['saveDefinition', 'updateActivity']);
});
