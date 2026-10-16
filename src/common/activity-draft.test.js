import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDraft, selectDefinition, backToPicker, startNew, setField, setPicker, validateDraft, draftToSubmission, definitionFromFields, initialStart,
  STEPS, editorRequest, addButtonStart, draftChanged, quickAddFields,
} from './activity-draft.js';

const categories = [{ id: 'career' }, { id: 'body' }];
const gym = { id: 'ad_gym', title: 'Gym', icon: '🏋️', categoryId: 'body', priority: 'should', duration: 75, fixed: false, start: null };
const read = { id: 'ad_read', title: 'Reading', icon: '📚', categoryId: 'career', priority: 'optional', duration: 30, fixed: true, start: 1200 };
const dictionary = [gym, read];
const ctx = { categories, defaultStart: 600 };

test('a new editor opens on the picker and nothing can be submitted from it', () => {
  const d = createDraft({ ...ctx, dictionary });
  assert.equal(d.step, 'pick');
  assert.ok(validateDraft(d, { dictionary }).form);
});

test('selecting a library activity fills its defaults and its reference', () => {
  const d = selectDefinition(createDraft({ ...ctx, dictionary }), gym, ctx);
  assert.deepEqual([d.step, d.activityId, d.title, d.icon, d.categoryId, d.priority, d.duration, d.fixed], ['library', 'ad_gym', 'Gym', '🏋️', 'body', 'should', 75, false]);
  assert.deepEqual([d.hasTime, d.time], [true, '10:00']);
  assert.deepEqual(validateDraft(d, { dictionary }), {});
  const { fields, saveToLibrary } = draftToSubmission(d);
  assert.equal(fields.activityId, 'ad_gym');
  assert.equal(saveToLibrary, false);
});

test('identity fields of a selected library activity are not editable in the occurrence form', () => {
  const d = selectDefinition(createDraft({ ...ctx, dictionary }), gym, ctx);
  assert.equal(setField(d, 'title', 'Other'), d);
  assert.equal(setField(d, 'duration', 45).duration, 45);
});

test('start time: a clicked slot wins, then the activity default, then the editor default', () => {
  assert.equal(initialStart({ itemStart: 1200, defaultStart: 900, explicitSlot: true }), 900);
  assert.equal(initialStart({ itemStart: 1200, defaultStart: 900 }), 1200);
  assert.equal(initialStart({ itemStart: null, defaultStart: 900 }), 900);
  assert.equal(initialStart({}), null);
  const picked = selectDefinition(createDraft({ ...ctx, dictionary }), read, { ...ctx, explicitSlot: true });
  assert.equal(picked.time, '10:00');
});

test('switching activities never carries notes or links over from the previous one', () => {
  let d = selectDefinition(createDraft({ ...ctx, dictionary }), gym, ctx);
  d = setField(setField(setField(d, 'notes', 'leg day'), 'linkTrackerId', 'trk'), 'linkItemId', 'it');
  d = selectDefinition(backToPicker(d), read, ctx);
  assert.deepEqual([d.notes, d.linkTrackerId, d.linkItemId, d.noteId], ['', '', '', '']);
  assert.equal(d.duration, 30);
});

test('a start time the user chose stays when they switch activity; untouched times follow the new activity', () => {
  const opened = createDraft({ ...ctx, dictionary }); // Add button at 10:00
  let d = selectDefinition(opened, read, ctx);
  assert.equal(d.time, '20:00', 'Reading has a default time of its own');
  d = selectDefinition(backToPicker(d), gym, ctx);
  assert.equal(d.time, '10:00', 'Gym has none, so the editor default applies');
  d = selectDefinition(backToPicker(setField(d, 'time', '06:00')), read, ctx);
  assert.deepEqual([d.time, d.hasTime], ['06:00', true], 'the user\'s own time is kept');
  d = selectDefinition(backToPicker(setField(d, 'hasTime', false)), gym, ctx);
  assert.equal(d.hasTime, false, '"no time" is a choice too');
});

test('going back to the picker drops the selection so it cannot be submitted', () => {
  const d = backToPicker(selectDefinition(createDraft({ ...ctx, dictionary }), gym, ctx));
  assert.equal(d.activityId, null);
  assert.ok(validateDraft(d, { dictionary }).form);
});

test('a one-off activity needs no library selection, and what was typed survives a trip to the picker', () => {
  let d = startNew(createDraft({ ...ctx, dictionary }), ctx, '  Dentist ');
  assert.deepEqual([d.step, d.title, d.activityId, d.categoryId], ['new', 'Dentist', null, 'career']);
  d = setField(setField(d, 'notes', 'bring card'), 'categoryId', 'body');
  d = backToPicker(d);
  d = selectDefinition(d, gym, ctx); // look at a library activity…
  d = startNew(backToPicker(d), ctx); // …and come back
  assert.deepEqual([d.title, d.notes, d.categoryId, d.activityId], ['Dentist', 'bring card', 'body', null]);
  const { fields, saveToLibrary } = draftToSubmission(d, { canLink: true, knowledge: true });
  assert.equal(fields.activityId, null);
  assert.equal(saveToLibrary, false, 'nothing is added to the library unless asked');
  assert.equal(fields.link, null);
});

test('saving to the library is explicit and only possible for a new activity', () => {
  let d = setField(startNew(createDraft({ ...ctx, dictionary }), ctx, 'Swim'), 'saveToLibrary', true);
  const { fields, saveToLibrary } = draftToSubmission(d);
  assert.equal(saveToLibrary, true);
  assert.deepEqual(definitionFromFields(fields), { title: 'Swim', icon: '📌', categoryId: 'career', priority: 'required', duration: 30, fixed: true, start: null });
  d = selectDefinition(backToPicker(d), gym, ctx);
  assert.equal(draftToSubmission({ ...d, saveToLibrary: true }).saveToLibrary, false);
});

test('invalid submissions are rejected', () => {
  const d = startNew(createDraft({ ...ctx, dictionary }), ctx);
  assert.ok(validateDraft(d).title);
  assert.ok(validateDraft({ ...d, title: 'x', duration: 0 }).duration);
  assert.ok(validateDraft({ ...d, title: 'x', duration: 'abc' }).duration);
  assert.ok(validateDraft({ ...d, title: 'x', hasTime: true, time: '' }).time);
  const stale = selectDefinition(createDraft({ ...ctx, dictionary }), gym, ctx);
  assert.ok(validateDraft(stale, { dictionary: [read] }).form, 'a definition deleted meanwhile is not accepted');
});

test('a recent entry opens its library activity, or a prefilled one-off when the definition is gone', () => {
  const fromLib = createDraft({ ...ctx, dictionary, preset: { source: 'library', sourceId: 'ad_gym', title: 'Old name' } });
  assert.deepEqual([fromLib.step, fromLib.title], ['library', 'Gym']);
  const orphan = createDraft({ ...ctx, dictionary, preset: { sourceId: null, title: 'Walk', icon: '🚶', duration: 20 } });
  assert.deepEqual([orphan.step, orphan.title, orphan.duration, orphan.activityId], ['new', 'Walk', 20, null]);
});

test('editing a scheduled activity keeps its own values and its reference', () => {
  const d = createDraft({ ...ctx, activity: { id: 'a1', activityId: 'ad_gym', title: 'Gym (short)', icon: '🏋️', categoryId: 'body', duration: 40, start: null, notes: 'n', link: { trackerId: 't', itemId: 'i' } } });
  assert.deepEqual([d.step, d.title, d.duration, d.hasTime, d.notes, d.linkItemId], ['edit', 'Gym (short)', 40, false, 'n', 'i']);
  const { fields } = draftToSubmission(setField(d, 'title', 'Gym!'), { canLink: true });
  assert.deepEqual([fields.title, fields.activityId, fields.link.itemId], ['Gym!', 'ad_gym', 'i']);
});

test('opening from a timeline slot prefills that exact time, even over an activity\'s default', () => {
  const req = editorRequest.slot(17 * 60 + 15);
  const d = createDraft({ ...req, categories, dictionary });
  assert.deepEqual([d.step, d.hasTime, d.time], [STEPS.PICK_ACTIVITY, true, '17:15']);
  const picked = selectDefinition(d, read, { ...req, categories });
  assert.equal(picked.time, '17:15');
  assert.equal(startNew(d, { ...req, categories }).time, '17:15');
});

test('opening from the Add Activity button uses the nearest quarter hour today and 09:00 on other days', () => {
  assert.equal(addButtonStart(true, 10 * 60 + 7), 10 * 60);
  assert.equal(addButtonStart(true, 10 * 60 + 8), 10 * 60 + 15);
  assert.equal(addButtonStart(true, 23 * 60 + 58), 24 * 60 - 15);
  assert.equal(addButtonStart(false, 10 * 60 + 7), 9 * 60);
  const req = editorRequest.button({ isToday: false, nowMinutes: 600 });
  assert.equal(req.explicitSlot, false);
  const d = createDraft({ ...req, categories, dictionary });
  assert.deepEqual([d.step, d.time], [STEPS.PICK_ACTIVITY, '09:00']);
  assert.equal(selectDefinition(d, read, { ...req, categories }).time, '20:00', 'not a clicked slot, so the activity\'s own time wins');
});

test('opening on an existing activity goes straight to editing it', () => {
  const activity = { id: 'a1', title: 'Gym', icon: '🏋️', categoryId: 'body', duration: 60, start: 600, notes: 'x' };
  const d = createDraft({ ...editorRequest.activity(activity), categories, dictionary });
  assert.deepEqual([d.step, d.title, d.time, d.notes], [STEPS.EDIT_EXISTING, 'Gym', '10:00', 'x']);
  assert.equal(draftChanged(d, d), false);
  assert.equal(draftChanged(d, setField(d, 'notes', 'y')), true);
});

test('picking an activity stays inside the editor and the picker keeps its search when coming back', () => {
  let d = createDraft({ ...ctx, dictionary });
  d = setPicker(d, { query: 'rea', categoryId: 'career' });
  d = selectDefinition(d, read, ctx);
  assert.equal(d.step, STEPS.EDIT_ACTIVITY);
  d = backToPicker(d);
  assert.deepEqual([d.step, d.picker.query, d.picker.categoryId], [STEPS.PICK_ACTIVITY, 'rea', 'career']);
  d = startNew(d, ctx);
  assert.equal(d.picker.query, 'rea');
});

test('recurrence-relevant and link fields reach the submission unchanged', () => {
  let d = selectDefinition(createDraft({ ...ctx, dictionary }), gym, ctx);
  d = setField(setField(setField(setField(d, 'notes', 'n'), 'linkTrackerId', 't'), 'linkItemId', 'i'), 'noteId', 'note1');
  const { fields } = draftToSubmission(d, { canLink: true, knowledge: true });
  assert.deepEqual([fields.notes, fields.link, fields.noteId, fields.activityId], ['n', { trackerId: 't', itemId: 'i' }, 'note1', 'ad_gym']);
});

test('editing an existing activity: Change swaps the activity for this occurrence and keeps its time', () => {
  const activity = { id: 'a1', activityId: 'ad_gym', title: 'Gym', icon: '🏋️', categoryId: 'body', priority: 'should', duration: 75, start: 990, notes: 'legs', link: { trackerId: 't', itemId: 'i' } };
  const d = createDraft({ ...editorRequest.activity(activity), categories, dictionary });
  const swapped = selectDefinition(backToPicker(d), read, { categories });
  assert.deepEqual([swapped.step, swapped.activityId, swapped.title, swapped.duration], [STEPS.EDIT_ACTIVITY, 'ad_read', 'Reading', 30]);
  assert.equal(swapped.time, '16:30', 'the occurrence keeps its time, not Reading\'s 20:00 default');
  assert.deepEqual([swapped.notes, swapped.linkItemId], ['', ''], 'notes and links of the old activity don\'t leak');
  assert.equal(draftToSubmission(swapped).fields.activityId, 'ad_read');
});

test('editing an existing activity: "Create new" reopens its own details to rename it as a one-off', () => {
  const activity = { id: 'a1', activityId: 'ad_gym', title: 'Gym', icon: '🏋️', categoryId: 'body', duration: 75, start: 990, notes: 'legs' };
  const d = startNew(backToPicker(createDraft({ ...editorRequest.activity(activity), categories, dictionary })), { categories });
  assert.deepEqual([d.step, d.title, d.icon, d.notes, d.time, d.activityId], [STEPS.CREATE_ACTIVITY, 'Gym', '🏋️', 'legs', '16:30', null]);
});

test('quick add: picking a library or recent activity yields ready-to-add fields with its defaults', () => {
  const req = editorRequest.slot(17 * 60);
  const opened = createDraft({ ...req, categories, dictionary });
  const fields = quickAddFields(selectDefinition(opened, gym, { ...req, categories }), { dictionary });
  assert.deepEqual([fields.title, fields.activityId, fields.duration, fields.priority, fields.start, fields.notes], ['Gym', 'ad_gym', 75, 'should', 17 * 60, '']);
  const oneOff = createDraft({ ...req, categories, dictionary, preset: { sourceId: null, title: 'Walk', icon: '🚶', duration: 20 } });
  assert.deepEqual(Object.values((({ title, activityId, duration, start }) => ({ title, activityId, duration, start }))(quickAddFields(oneOff, { dictionary }))), ['Walk', null, 20, 17 * 60]);
  const gone = selectDefinition(opened, { ...gym, id: 'ad_deleted' }, { ...req, categories });
  assert.equal(quickAddFields(gone, { dictionary }), null, 'a definition that no longer exists is not added blindly');
});
