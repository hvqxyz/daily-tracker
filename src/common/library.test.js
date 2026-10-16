import test from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateLibraryRefs, resolveTemplateItems, resolveTemplateItem, libraryById, templateItemFor, moveItem,
  activityFieldsFromTemplateItem, libraryReferences, deleteDefinition, updateDefinition, identityKey,
} from './library.js';

const def = (id, title, icon, categoryId, extra = {}) => ({ id, title, icon, categoryId, priority: 'should', duration: 30, fixed: true, start: null, ...extra });
const legacy = (id, title, icon, categoryId, extra = {}) => ({ id, title, icon, categoryId, priority: 'required', start: 540, duration: 60, fixed: true, ...extra });
const state = (dictionary, templates, extra = {}) => ({ activityDictionary: dictionary, templates, days: {}, recurrences: [], recentActivities: [], ...extra });

test('a template item with the same title, icon and category references the existing definition', () => {
  const s = state(
    [def('ad_gym', 'Gym', '🏋️', 'body', { duration: 75 })],
    [{ id: 't1', name: 'Work day', icon: '💼', items: [legacy('ti_1', ' gym ', '🏋️', 'body', { duration: 90, start: 1020 })] }],
  );
  const { state: m, report } = migrateLibraryRefs(s);
  assert.equal(m.activityDictionary.length, 1, 'no duplicate definition');
  assert.deepEqual(m.activityDictionary[0], s.activityDictionary[0], 'library defaults are not touched');
  const item = m.templates[0].items[0];
  assert.equal(item.activityId, 'ad_gym');
  assert.deepEqual([item.id, item.start, item.duration, item.priority, item.fixed], ['ti_1', 1020, 90, 'required', true], 'template scheduling is kept');
  assert.equal(item.title, undefined, 'no independent copy of the definition');
  assert.deepEqual(report.created, []);
});

test('the same title with a different icon or category is not treated as the same activity', () => {
  const s = state(
    [def('ad_read', 'Reading', '📚', 'mind')],
    [{ id: 't1', name: 'A', icon: '', items: [legacy('ti_1', 'Reading', '📖', 'mind'), legacy('ti_2', 'Reading', '📚', 'life')] }],
  );
  const { state: m, report } = migrateLibraryRefs(s);
  const [a, b] = m.templates[0].items;
  assert.notEqual(a.activityId, 'ad_read');
  assert.notEqual(b.activityId, 'ad_read');
  assert.notEqual(a.activityId, b.activityId);
  assert.equal(report.created.length, 2);
});

test('template-only activities become one library definition shared by every template, keeping each schedule', () => {
  const s = state([], [
    { id: 't1', name: 'Work day', icon: '', items: [legacy('ti_b', 'Lunch', '🍝', 'life', { start: 750, duration: 45 })] },
    { id: 't2', name: 'Weekend', icon: '', items: [legacy('ti_a', 'Lunch', '🍝', 'life', { start: 780, duration: 60, priority: 'should' })] },
  ]);
  const { state: m, report } = migrateLibraryRefs(s);
  assert.equal(m.activityDictionary.length, 1);
  const d = m.activityDictionary[0];
  assert.equal(d.id, 'ad_t_ti_a', 'id derives from the lowest item id, not from template order');
  assert.deepEqual([d.title, d.icon, d.categoryId, d.start], ['Lunch', '🍝', 'life', null]);
  const [w, e] = [m.templates[0].items[0], m.templates[1].items[0]];
  assert.deepEqual([w.activityId, w.start, w.duration, w.priority], [d.id, 750, 45, 'required']);
  assert.deepEqual([e.activityId, e.start, e.duration, e.priority], [d.id, 780, 60, 'should']);
  assert.deepEqual(report.created[0].templates, ['Work day', 'Weekend']);
});

test('ambiguous matches never pick one of the candidates', () => {
  const s = state(
    [def('ad_1', 'Run', '🏃', 'body'), def('ad_2', 'run', '🏃', 'body')],
    [{ id: 't1', name: 'A', icon: '', items: [legacy('ti_1', 'Run', '🏃', 'body')] }],
  );
  const { state: m, report } = migrateLibraryRefs(s);
  const ref = m.templates[0].items[0].activityId;
  assert.ok(!['ad_1', 'ad_2'].includes(ref));
  assert.equal(report.ambiguous.length, 1);
  assert.deepEqual(report.ambiguous[0].candidates, ['ad_1', 'ad_2']);
  assert.equal(m.activityDictionary.length, 3);
});

test('migration is idempotent and order independent', () => {
  const items = [legacy('ti_2', 'Sleep', '😴', 'recovery'), legacy('ti_1', 'Gym', '🏋️', 'body')];
  const s = state([def('ad_gym', 'Gym', '🏋️', 'body')], [{ id: 't1', name: 'A', icon: '', items }]);
  const once = migrateLibraryRefs(s).state;
  const twice = migrateLibraryRefs(once);
  assert.equal(twice.changed, false);
  assert.deepEqual(twice.state, once);
  const reversed = migrateLibraryRefs(state([def('ad_gym', 'Gym', '🏋️', 'body')], [{ id: 't1', name: 'A', icon: '', items: [...items].reverse() }])).state;
  assert.deepEqual(reversed.activityDictionary, once.activityDictionary);
});

test('partially migrated data and references to a missing definition are repaired from the snapshot', () => {
  const s = state([def('ad_gym', 'Gym', '🏋️', 'body')], [{ id: 't1', name: 'A', icon: '', items: [
    { id: 'ti_1', activityId: 'ad_gym', start: 600, duration: 60, priority: 'required', fixed: true, snapshot: { title: 'Gym', icon: '🏋️', categoryId: 'body' } },
    { id: 'ti_2', activityId: 'ad_gone', start: 700, duration: 30, priority: 'should', fixed: false, snapshot: { title: 'Walk', icon: '🚶', categoryId: 'body' } },
    legacy('ti_3', 'Gym', '🏋️', 'body'),
  ] }]);
  const { state: m } = migrateLibraryRefs(s);
  const [a, b, c] = m.templates[0].items;
  assert.equal(a, s.templates[0].items[0], 'an already migrated item is untouched');
  assert.equal(c.activityId, 'ad_gym');
  assert.equal(m.activityDictionary.find((d) => d.id === b.activityId).title, 'Walk');
  assert.deepEqual([b.start, b.duration, b.priority, b.fixed], [700, 30, 'should', false]);
});

test('an item with nothing to identify it is kept and reported, never dropped', () => {
  const s = state([], [{ id: 't1', name: 'A', icon: '', items: [{ id: 'ti_x', activityId: 'ad_gone', start: 1, duration: 30 }] }]);
  const { state: m, report } = migrateLibraryRefs(s);
  assert.equal(m.templates[0].items.length, 1);
  assert.equal(report.unresolved.length, 1);
  const r = resolveTemplateItem(m.templates[0].items[0], libraryById(m.activityDictionary));
  assert.equal(r.missing, true);
  assert.equal(activityFieldsFromTemplateItem(r), null, 'it is skipped when applied');
});

test('recent entries that pointed at a template item point at its definition afterwards', () => {
  const s = state([], [{ id: 't1', name: 'A', icon: '', items: [legacy('ti_1', 'Lunch', '🍝', 'life')] }], {
    recentActivities: [{ key: 'lunch|🍝', sourceId: 'ti_1', title: 'Lunch', icon: '🍝' }, { key: 'x|', sourceId: null, title: 'x' }],
  });
  const { state: m } = migrateLibraryRefs(s);
  assert.equal(m.recentActivities[0].sourceId, m.templates[0].items[0].activityId);
  assert.equal(m.recentActivities[1].sourceId, null);
});

test('historical scheduled activities and rules are left exactly as they were', () => {
  const days = { '2026-01-01': { activities: [{ id: 'act_1', title: 'Lunch', icon: '🍝', categoryId: 'life', duration: 45 }] } };
  const recurrences = [{ id: 'rec_1', title: 'Lunch', icon: '🍝' }];
  const s = state([], [{ id: 't1', name: 'A', icon: '', items: [legacy('ti_1', 'Lunch', '🍝', 'life')] }], { days, recurrences });
  const { state: m } = migrateLibraryRefs(s);
  assert.equal(m.days, days);
  assert.equal(m.recurrences, recurrences);
});

test('a template resolves title, icon and category live from the library', () => {
  let s = migrateLibraryRefs(state([def('ad_dw', 'Deep Work', '💻', 'career', { duration: 120 })], [
    { id: 't1', name: 'A', icon: '', items: [legacy('ti_1', 'Deep Work', '💻', 'career', { duration: 180 })] },
  ])).state;
  s = updateDefinition(s, 'ad_dw', { title: 'Focus', icon: '🎯', duration: 90 });
  const [r] = resolveTemplateItems(s.templates[0], s.activityDictionary);
  assert.deepEqual([r.title, r.icon, r.duration], ['Focus', '🎯', 180], 'identity follows the definition, scheduling stays the template\'s');
  assert.equal(s.templates[0].items[0].snapshot.title, 'Focus', 'the fallback snapshot follows too');
});

test('adding, reordering and applying template items keeps references and overrides', () => {
  const gym = def('ad_gym', 'Gym', '🏋️', 'body', { duration: 75 });
  const read = def('ad_read', 'Reading', '📚', 'mind', { duration: 30, start: 1200 });
  const a = templateItemFor(gym, [{ start: 480, duration: 60 }], 'ti_a');
  assert.deepEqual([a.activityId, a.start, a.duration], ['ad_gym', 540, 75], 'scheduled after the last timed item');
  const b = templateItemFor(read, [], 'ti_b');
  assert.equal(b.start, 1200, 'a definition\'s default time is used when it has one');
  const items = moveItem([a, { ...b, duration: 45 }], 1, -1);
  assert.deepEqual(items.map((it) => [it.id, it.activityId]), [['ti_b', 'ad_read'], ['ti_a', 'ad_gym']]);
  assert.equal(moveItem(items, 0, -1), items);
  const fields = resolveTemplateItems({ items }, [gym, read]).map(activityFieldsFromTemplateItem);
  assert.deepEqual(fields[0], { title: 'Reading', icon: '📚', categoryId: 'mind', priority: 'should', start: 1200, duration: 45, fixed: true, activityId: 'ad_read' });
});

test('references are found and deleting a definition removes it only from templates', () => {
  const s = {
    ...state([def('ad_dw', 'Deep Work', '💻', 'career'), def('ad_x', 'X', '❌', 'life')], [
      { id: 't1', name: 'Work day', icon: '💼', items: [{ id: 'ti_1', activityId: 'ad_dw' }, { id: 'ti_2', activityId: 'ad_x' }] },
      { id: 't2', name: 'Weekend', icon: '🌴', items: [{ id: 'ti_3', activityId: 'ad_dw' }, { id: 'ti_4', activityId: 'ad_dw' }] },
    ]),
    days: { d: { activities: [{ id: 'a1', activityId: 'ad_dw', title: 'Deep Work' }] } },
    recurrences: [{ id: 'r1', activityId: 'ad_dw' }],
  };
  const refs = libraryReferences(s, 'ad_dw');
  assert.deepEqual(refs.templates.map((t) => [t.name, t.count]), [['Work day', 1], ['Weekend', 2]]);
  assert.deepEqual([refs.scheduled, refs.recurrences], [1, 1]);
  const next = deleteDefinition(s, 'ad_dw');
  assert.deepEqual(next.activityDictionary.map((d) => d.id), ['ad_x']);
  assert.deepEqual(next.templates.map((t) => t.items.map((it) => it.id)), [['ti_2'], []]);
  assert.equal(next.days, s.days, 'history is never cascade-deleted');
  assert.equal(next.recurrences, s.recurrences);
});

test('identity ignores surrounding spaces and case of the title only', () => {
  assert.equal(identityKey({ title: ' Gym ', icon: '🏋️', categoryId: 'body' }), identityKey({ title: 'gym', icon: '🏋️', categoryId: 'body' }));
  assert.notEqual(identityKey({ title: 'Gym', icon: '🏋️', categoryId: 'body' }), identityKey({ title: 'Gym', icon: '💪', categoryId: 'body' }));
});
