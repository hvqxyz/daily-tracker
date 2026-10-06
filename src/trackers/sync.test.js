import test from 'node:test';
import assert from 'node:assert/strict';

const memory = () => ({ getItem: () => null, setItem() {}, removeItem() {} });
globalThis.localStorage = memory();
globalThis.sessionStorage = memory();
const { stateToRows, rowsToState } = await import('../common/sheets-sync.js');
const { buildSeed: rawSeed } = await import('../common/seed.js');
const { ensureNotesState } = await import('../notes/migrate.js');
const buildSeed = () => ensureNotesState(rawSeed());

const ORDER = ['Categories', 'Templates', 'TemplateItems', 'ActivityDictionary', 'Recurrences', 'Activities', 'DayMeta', 'Settings', 'Trackers', 'TrackerItems', 'TrackerTemplates'];
const ORDER_ALL = [...ORDER, 'Notes', 'NoteBlocks', 'NoteCollections', 'NoteTags', 'NoteStatuses', 'NoteTemplates'];

test('trackers, items and activity links survive a Sheets round trip', () => {
  const state = buildSeed();
  const day = Object.values(state.days)[0];
  const item = state.trackerItems[0];
  day.activities[0].link = { trackerId: item.trackerId, itemId: item.id };
  state.trackerTemplates = [{ key: 'tpl_1', name: 'Mine', icon: '🧪', fields: [], views: [], widgets: [] }];
  // an attachment: data must stay local, metadata must sync
  const tracker = state.trackers[0];
  state.trackerItems[0] = { ...item, values: { ...item.values, file: [{ name: 'a.txt', size: 3, type: 'text/plain', data: 'data:text/plain;base64,QUJD' }] } };

  const tables = stateToRows(state);
  const back = rowsToState(ORDER.map((n) => JSON.parse(JSON.stringify(tables[n]))), { ...state, trackers: [], trackerItems: [] });

  assert.deepEqual(back.trackers.map((t) => t.id), state.trackers.map((t) => t.id));
  assert.deepEqual(back.trackers[0].fields, tracker.fields);
  assert.deepEqual(back.trackers[0].views, tracker.views);
  assert.deepEqual(back.trackers[0].widgets, tracker.widgets);
  assert.deepEqual(back.trackers[0].settings, tracker.settings);
  assert.equal(back.trackerItems.length, state.trackerItems.length);
  const restored = back.trackerItems.find((i) => i.id === item.id);
  assert.equal(restored.createdAt, item.createdAt);
  assert.deepEqual(Object.keys(restored.values).sort(), Object.keys(state.trackerItems[0].values).sort());
  assert.equal(restored.values.file[0].data, undefined);
  assert.equal(restored.values.file[0].name, 'a.txt');
  const child = state.trackerItems.find((i) => i.parentId);
  assert.equal(back.trackerItems.find((i) => i.id === child.id).parentId, child.parentId);
  const backAct = Object.values(back.days).flatMap((d) => d.activities).find((a) => a.link);
  assert.deepEqual(backAct.link, { trackerId: item.trackerId, itemId: item.id });
  assert.equal(back.trackerTemplates[0].name, 'Mine');
});

test('an empty remote never wipes local trackers', () => {
  const state = buildSeed();
  const empty = ORDER.map(() => []);
  const back = rowsToState(empty, state);
  assert.equal(back.trackers.length, state.trackers.length);
  assert.equal(back.trackerItems.length, state.trackerItems.length);
});

test('notes, blocks, collections, tags, statuses, templates and note links round trip', () => {
  const state = buildSeed();
  const note = state.notes.find((n) => n.blocks.some((b) => b.type === 'code'));
  // an image whose data must stay local
  state.notes[0] = { ...state.notes[0], blocks: [...state.notes[0].blocks, { id: 'blk_img', type: 'image', content: '', config: { url: 'data:image/png;base64,AAAA', name: 'p.png', size: 4 } }] };
  const act = Object.values(state.days)[0].activities[0];
  act.noteId = note.id;

  const tables = stateToRows(state);
  const back = rowsToState(ORDER_ALL.map((n) => JSON.parse(JSON.stringify(tables[n]))), { ...state, notes: [], trackers: [], trackerItems: [] });

  assert.equal(back.notes.length, state.notes.length);
  const b = back.notes.find((n) => n.id === note.id);
  assert.deepEqual(b.blocks.map((x) => [x.id, x.type, x.content]), note.blocks.map((x) => [x.id, x.type, x.content]));
  assert.deepEqual(b.blocks.map((x) => x.config), note.blocks.map((x) => x.config));
  assert.deepEqual(b.tagIds, note.tagIds);
  assert.deepEqual(b.collectionIds, note.collectionIds);
  assert.equal(b.parentId, note.parentId);
  assert.deepEqual(b.relations, note.relations);
  assert.deepEqual(b.trackerItemIds, note.trackerItemIds);
  assert.equal(b.statusId, note.statusId);
  assert.equal(back.notes.find((n) => n.favorite)?.title, state.notes.find((n) => n.favorite).title);
  assert.deepEqual(back.noteCollections, state.noteCollections);
  assert.deepEqual(back.noteTags, state.noteTags);
  assert.deepEqual(back.noteConfig.statuses, state.noteConfig.statuses);
  assert.deepEqual(back.noteTemplates.map((t) => t.name), state.noteTemplates.map((t) => t.name));
  assert.equal(Object.values(back.days).flatMap((d) => d.activities).find((a) => a.noteId)?.noteId, note.id);

  const img = back.notes[0].blocks.find((x) => x.id === 'blk_img');
  assert.equal(img.config.url, undefined);            // not synced…
  const restoredLocally = rowsToState(ORDER_ALL.map((n) => JSON.parse(JSON.stringify(tables[n]))), state).notes[0].blocks.find((x) => x.id === 'blk_img');
  assert.equal(restoredLocally.config.url, 'data:image/png;base64,AAAA'); // …but kept for the local copy
});

test('an empty remote never wipes local notes', () => {
  const state = buildSeed();
  const back = rowsToState(ORDER_ALL.map(() => []), state);
  assert.equal(back.notes.length, state.notes.length);
  assert.equal(back.noteCollections.length, state.noteCollections.length);
});

test('recurrence rules and stored occurrences survive a Sheets round trip', () => {
  const state = buildSeed();
  state.recurrences = [
    { id: 'rec_a', title: 'Running', icon: '🏃', categoryId: 'body', priority: 'should', start: 600, duration: 60, fixed: true, freq: 'weekly', interval: 2, weekdays: [6], monthDay: null, startDate: '2026-09-20', endDate: '2026-12-31', count: null, pausedFrom: null, exceptDates: ['2026-10-04'], notes: 'n', createdAt: 5 },
    { id: 'rec_b', title: 'Rent', icon: '💰', categoryId: 'finance', priority: 'required', start: null, duration: 15, fixed: false, freq: 'monthly', interval: 1, weekdays: [], monthDay: 'last', startDate: '2026-09-01', endDate: null, count: 6, pausedFrom: '2027-01-01', exceptDates: [], notes: '', createdAt: 6 },
  ];
  const day = Object.values(state.days)[0];
  day.activities.push({ id: 'occ_rec_a_2026-09-20', recurrenceId: 'rec_a', occurrenceDate: '2026-09-20', overrides: { start: true }, title: 'Running', icon: '🏃', categoryId: 'body', priority: 'should', start: 660, duration: 60, plannedStart: 600, plannedDuration: 60, fixed: true, status: 'moved', notes: '', createdAt: 1 });

  const tables = stateToRows(state);
  const back = rowsToState(ORDER_ALL.map((n) => JSON.parse(JSON.stringify(tables[n]))), state);
  assert.deepEqual(back.recurrences, state.recurrences);
  const occ = Object.values(back.days).flatMap((d) => d.activities).find((a) => a.recurrenceId === 'rec_a');
  assert.equal(occ.occurrenceDate, '2026-09-20');
  assert.deepEqual(occ.overrides, { start: true });
});

test('a rule row written by an older version still loads (the store upgrades it)', () => {
  const state = buildSeed();
  const tables = stateToRows(state);
  const legacyRow = ['rec_old', 'Old', '🔁', 'body', 'should', '', 30, false, 'weekly', '1,3'];  // only the original ten columns
  const back = rowsToState(ORDER_ALL.map((n) => (n === 'Recurrences' ? [legacyRow] : JSON.parse(JSON.stringify(tables[n])))), state);
  assert.equal(back.recurrences[0].freq, 'weekly');
  assert.deepEqual(back.recurrences[0].weekdays, [1, 3]);
  assert.equal(back.recurrences[0].startDate, undefined);
});

test('day well-being and note survive a Sheets round trip, and old DayMeta rows still load', () => {
  const state = buildSeed();
  const [first, second, third] = Object.keys(state.days);
  state.days[first].wellbeing = 4;
  state.days[first].note = 'Good day.\nTrained, understood Kafka rebalancing.';
  state.days[second].wellbeing = 2;

  const tables = stateToRows(state);
  const back = rowsToState(ORDER_ALL.map((n) => JSON.parse(JSON.stringify(tables[n]))), state);
  assert.equal(back.days[first].wellbeing, 4);
  assert.equal(back.days[first].note, 'Good day.\nTrained, understood Kafka rebalancing.');
  assert.equal(back.days[second].wellbeing, 2);
  assert.equal(back.days[second].note, undefined);
  assert.equal(back.days[third].wellbeing, undefined);

  // rows written before these columns existed
  const legacy = ORDER_ALL.map((n) => (n === 'DayMeta' ? [[first, '']] : JSON.parse(JSON.stringify(tables[n]))));
  assert.equal(rowsToState(legacy, state).days[first].wellbeing, undefined);
});

test('the activity dictionary survives a Sheets round trip, and an empty remote keeps local entries', () => {
  const state = buildSeed();
  state.activityDictionary = [
    { id: 'ad_1', title: 'Gym', icon: '🏋️', categoryId: 'body', priority: 'required', start: null, duration: 75, fixed: true },
    { id: 'ad_2', title: 'Reading', icon: '📚', categoryId: 'mind', priority: 'should', start: 1200, duration: 30, fixed: false },
  ];

  const tables = stateToRows(state);
  const back = rowsToState(ORDER.map((n) => JSON.parse(JSON.stringify(tables[n]))), state);
  assert.deepEqual(back.activityDictionary, state.activityDictionary);

  // an older spreadsheet gets the tab added by ensureTabs before this runs, so it reads back empty, not missing
  const empty = ORDER.map((n) => (n === 'ActivityDictionary' ? [] : JSON.parse(JSON.stringify(tables[n]))));
  assert.deepEqual(rowsToState(empty, state).activityDictionary, state.activityDictionary);
});
