import test from 'node:test';
import assert from 'node:assert/strict';

const memory = () => ({ getItem: () => null, setItem() {}, removeItem() {} });
globalThis.localStorage = memory();
globalThis.sessionStorage = memory();
const { stateToRows, rowsToState } = await import('./sheets-sync.js');
const { buildSeed: rawSeed } = await import('./seed.js');
const { ensureNotesState } = await import('../notes/migrate.js');
const { migrateLibraryRefs } = await import('./library.js');

const ORDER = ['Categories', 'Templates', 'TemplateItems', 'ActivityDictionary', 'Recurrences', 'Activities', 'DayMeta', 'Settings', 'Trackers', 'TrackerItems', 'TrackerTemplates', 'Notes', 'NoteBlocks', 'NoteCollections', 'NoteTags', 'NoteStatuses', 'NoteTemplates', 'References'];
const migratedSeed = () => migrateLibraryRefs(ensureNotesState(rawSeed())).state;
const roundTrip = (tables, fallback, tweak = (n, rows) => rows) => rowsToState(ORDER.map((n) => tweak(n, JSON.parse(JSON.stringify(tables[n] || [])))), fallback);
const upgrade = (s) => migrateLibraryRefs(s).state;

test('templates made of library references survive a Sheets round trip unchanged', () => {
  const state = migratedSeed();
  const back = upgrade(roundTrip(stateToRows(state), state));
  assert.deepEqual(back.templates, state.templates);
  assert.deepEqual(back.activityDictionary, state.activityDictionary);
});

test('TemplateItems still carries full rows, so older app versions keep reading complete templates', () => {
  const state = migratedSeed();
  const rows = stateToRows(state).TemplateItems;
  const t = state.templates[0];
  const def = state.activityDictionary.find((d) => d.id === t.items[0].activityId);
  assert.deepEqual(rows[0].slice(0, 5), [t.items[0].id, t.id, def.title, def.icon, def.categoryId]);
});

test('a sheet written before references existed migrates like local data', () => {
  const legacy = ensureNotesState(rawSeed());
  const local = upgrade(structuredClone(legacy));
  const back = upgrade(roundTrip(stateToRows(legacy), local, (n, rows) => (n === 'References' ? [] : rows)));
  assert.deepEqual(back.templates, local.templates, 'same references, same ids on every device');
  assert.deepEqual(back.activityDictionary.map((d) => d.id).sort(), local.activityDictionary.map((d) => d.id).sort());
});

test('an older version that overwrote the library (dropping migrated entries) does not lose template activities', () => {
  const legacy = ensureNotesState(rawSeed());
  const state = upgrade(structuredClone(legacy));
  const tables = stateToRows(state);
  const legacyDict = legacy.activityDictionary;
  const back = upgrade(roundTrip(tables, state, (n, rows) => (n === 'ActivityDictionary'
    ? rows.filter((r) => legacyDict.some((d) => d.id === r[0]))
    : rows)));
  assert.deepEqual(back.templates, state.templates, 'deterministic ids recreate the same definitions');
});

test('a row edited by an older version is not silently bound to the old definition', () => {
  const state = migratedSeed();
  const tables = stateToRows(state);
  const editedId = state.templates[0].items[0].activityId;
  const back = upgrade(roundTrip(tables, state, (n, rows) => (n === 'TemplateItems' ? rows.map((r, i) => (i === 0 ? [r[0], r[1], 'Renamed elsewhere', ...r.slice(3)] : r)) : rows)));
  const item = back.templates[0].items[0];
  assert.notEqual(item.activityId, editedId);
  assert.equal(back.activityDictionary.find((d) => d.id === item.activityId).title, 'Renamed elsewhere');
  assert.ok(back.activityDictionary.some((d) => d.id === editedId), 'the shared definition is not renamed');
});

test('library references on scheduled activities and rule links survive a round trip', () => {
  const state = migratedSeed();
  const day = Object.values(state.days)[0];
  day.activities[0].activityId = state.activityDictionary[0].id;
  state.recurrences = [{ id: 'rec_1', title: 'Gym', icon: '🏋️', categoryId: 'body', priority: 'required', start: 600, duration: 60, fixed: true, freq: 'daily', interval: 1, weekdays: [], monthDay: null, startDate: '2026-01-01', endDate: null, count: null, pausedFrom: null, exceptDates: [], notes: '', createdAt: 1, activityId: 'ad_x', link: { trackerId: 't', itemId: 'i' }, noteId: 'n' }];
  const back = roundTrip(stateToRows(state), state);
  const backDay = back.days[Object.keys(state.days)[0]];
  assert.equal(backDay.activities.find((a) => a.id === day.activities[0].id).activityId, state.activityDictionary[0].id);
  const r = back.recurrences[0];
  assert.deepEqual([r.activityId, r.link, r.noteId], ['ad_x', { trackerId: 't', itemId: 'i' }, 'n']);
});

test('a pull keeps this device\'s migration notice and recent activities', () => {
  const state = { ...migratedSeed(), libraryNotice: { at: 1, created: [], ambiguous: [], unresolved: [] }, recentActivities: [{ key: 'a|', title: 'a' }] };
  const back = roundTrip(stateToRows(state), state);
  assert.deepEqual(back.libraryNotice, state.libraryNotice);
  assert.deepEqual(back.recentActivities, state.recentActivities);
});
