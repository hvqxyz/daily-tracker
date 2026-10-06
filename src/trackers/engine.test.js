import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFormula, checkFormulaSyntax } from './engine/formula.js';
import { makeCtx, getValue, itemLabel, isItemDone } from './engine/data.js';
import { runView, matchesFilter, filterOpsFor } from './engine/query.js';
import { computeWidget } from './engine/widgets.js';
import { createField, createOption, defaultValue } from './engine/fieldTypes.js';
import { quickFields, quickTotal, canConvert, convertField, newItem, newTracker, removeFieldFromTracker, createView, suggestWidgets, wouldCycle, mapValuesToTracker } from './engine/schema.js';
import { TRACKER_TEMPLATES, instantiateTemplate, blueprintFromTracker, buildSampleTrackers } from './templates.js';
import { migrateState } from './migrate.js';

const scopeOf = (vars = {}) => ({ field: (n) => (Object.hasOwn(vars, n) ? vars[n] : undefined), today: () => '2026-09-18', now: () => '2026-09-18T10:00', fns: {} });
const ev = (src, vars) => evaluateFormula(src, scopeOf(vars));

test('formula: arithmetic, precedence, logic', () => {
  assert.equal(ev('1 + 2 * 3').value, 7);
  assert.equal(ev('(1 + 2) * 3').value, 9);
  assert.equal(ev('10 / 4').value, 2.5);
  assert.equal(ev('10 / 0').value, null);
  assert.equal(ev('-3 + 5').value, 2);
  assert.equal(ev('if(1 > 2, "a", "b")').value, 'b');
  assert.equal(ev('1 < 2 && 3 > 2').value, true);
  assert.equal(ev('round(2.567, 1)').value, 2.6);
  assert.equal(ev('percent(1, 4)').value, 25);
  assert.equal(ev('concat("a", 1, "b")').value, 'a1b');
});

test('formula: dates and field references', () => {
  assert.equal(ev('today - {Started}', { Started: '2026-09-08' }).value, 10);
  assert.equal(ev('today - Started', { Started: '2026-09-08' }).value, 10);
  assert.equal(ev('{Due} + 3', { Due: '2026-09-30' }).value, '2026-10-03');
  assert.equal(ev('days("2026-09-01", "2026-09-18")').value, 17);
  assert.equal(ev('{Pages read} / {Pages} * 100', { 'Pages read': 50, Pages: 200 }).value, 25);
});

test('formula: errors are reported, never thrown, and nothing executes', () => {
  assert.ok(ev('{Nope} + 1', {}).error);
  assert.ok(ev('1 +', {}).error);
  assert.ok(ev('foo(1)', {}).error);
  assert.ok(ev('constructor', {}).error);
  assert.ok(ev('process.exit(1)', {}).error);
  assert.ok(ev('(() => 1)()', {}).error);
  assert.equal(checkFormulaSyntax('1 + (2'), 'Expected ")"');
  assert.equal(checkFormulaSyntax('1 + 2'), null);
});

// -- a hand-built tracker that has nothing to do with any template -----------
function buildGadgetTracker() {
  const t = newTracker({ name: 'Gadgets', icon: '🔧' });
  const name = createField('text', 'Gadget');
  const kind = createField('select', 'Kind', { config: { options: [createOption('Phone'), createOption('Laptop')] } });
  const state = createField('select', 'State', { config: { options: [createOption('Wishlist'), createOption('Owned', { done: true })] } });
  const price = createField('decimal', 'Price');
  const bought = createField('date', 'Bought');
  const age = createField('formula', 'Age (days)', { config: { expression: 'today - {Bought}', format: 'number' } });
  const tags = createField('multiselect', 'Tags', { config: { options: [createOption('work'), createOption('fun')] } });
  t.fields.push(name, kind, state, price, bought, age, tags);
  t.settings.titleFieldId = name.id;
  t.views.push(createView(t, 'table', 'All'));
  return { t, f: { name, kind, state, price, bought, age, tags } };
}

test('a hand-made tracker works with no code specific to it', () => {
  const { t, f } = buildGadgetTracker();
  const pick = (field, label) => field.config.options.find((o) => o.label === label).id;
  const a = newItem(t, { [f.name.id]: 'Pixel', [f.kind.id]: pick(f.kind, 'Phone'), [f.state.id]: pick(f.state, 'Owned'), [f.price.id]: 500.5, [f.bought.id]: '2026-09-08', [f.tags.id]: [pick(f.tags, 'work')] });
  const b = newItem(t, { [f.name.id]: 'ThinkPad', [f.kind.id]: pick(f.kind, 'Laptop'), [f.state.id]: pick(f.state, 'Wishlist'), [f.price.id]: 1500 });
  const c = newItem(t, { [f.name.id]: 'iPhone', [f.kind.id]: pick(f.kind, 'Phone'), [f.state.id]: pick(f.state, 'Wishlist'), [f.price.id]: 999 });
  const ctx = makeCtx([t], [a, b, c], { today: '2026-09-18' });

  assert.equal(itemLabel(t, a, ctx), 'Pixel');
  assert.equal(getValue(a, f.age, ctx), 10);
  assert.equal(getValue(b, f.age, ctx), null); // empty date → no crash
  assert.equal(isItemDone(a, t), true);
  assert.equal(isItemDone(b, t), false);

  const view = createView(t, 'table', 'x');
  view.config.filters = [{ id: '1', fieldId: f.kind.id, op: 'is', value: pick(f.kind, 'Phone') }];
  view.config.sorts = [{ fieldId: f.price.id, dir: 'desc' }];
  const { rows } = runView({ tracker: t, items: [a, b, c], view, ctx });
  assert.deepEqual(rows.map((i) => i.values[f.name.id]), ['iPhone', 'Pixel']);

  view.config.filters = [];
  view.config.groupBy = f.state.id;
  const { groups } = runView({ tracker: t, items: [a, b, c], view, ctx });
  assert.deepEqual(groups.map((g) => [g.label, g.items.length]), [['Wishlist', 2], ['Owned', 1]]);

  view.config.groupBy = f.tags.id;
  const tagGroups = runView({ tracker: t, items: [a, b, c], view, ctx }).groups;
  assert.deepEqual(tagGroups.map((g) => g.label), ['work', 'No value']);

  const search = runView({ tracker: t, items: [a, b, c], view, ctx, search: 'think' });
  assert.equal(search.rows.length, 1);

  assert.ok(filterOpsFor(f.price).some((o) => o.value === 'gt'));
  assert.ok(filterOpsFor(f.bought).some((o) => o.value === 'before'));
  assert.ok(matchesFilter(a, { fieldId: f.age.id, op: 'gt', value: 5 }, t, ctx));
  assert.ok(!matchesFilter(b, { fieldId: f.age.id, op: 'gt', value: 5 }, t, ctx));
});

test('widgets are computed from config only', () => {
  const { t, f } = buildGadgetTracker();
  const owned = f.state.config.options.find((o) => o.label === 'Owned').id;
  const items = [
    newItem(t, { [f.name.id]: 'A', [f.state.id]: owned, [f.price.id]: 10 }),
    newItem(t, { [f.name.id]: 'B', [f.price.id]: 30 }),
  ];
  const ctx = makeCtx([t], items);
  const w = (type, config) => ({ id: 'w', type, title: type, config: { filters: [], ...config } });
  assert.equal(computeWidget(w('count'), t, items, ctx).value, 2);
  assert.equal(computeWidget(w('number', { fieldId: f.price.id, agg: 'sum' }), t, items, ctx).value, 40);
  assert.equal(computeWidget(w('number', { fieldId: f.price.id, agg: 'avg' }), t, items, ctx).value, 20);
  assert.equal(computeWidget(w('completion', { doneFieldId: f.state.id }), t, items, ctx).percent, 50);
  assert.equal(computeWidget(w('distribution', { groupFieldId: f.state.id }), t, items, ctx).bars.length, 2);
  assert.ok(computeWidget(w('number', {}), t, items, ctx).missing);
  assert.ok(suggestWidgets(t).length >= 3);
});

test('templates instantiate into ordinary trackers', () => {
  for (const bp of TRACKER_TEMPLATES) {
    const { tracker, items } = instantiateTemplate(bp, { withSamples: true });
    assert.ok(tracker.fields.length > 0, bp.key);
    assert.ok(tracker.views.length > 0, bp.key);
    const ctx = makeCtx([tracker], items);
    for (const v of tracker.views) {
      // every saved view must run without throwing
      runView({ tracker, items, view: v, ctx });
    }
    for (const w of tracker.widgets) computeWidget(w, tracker, items, ctx);
    for (const item of items) assert.notEqual(itemLabel(tracker, item, ctx), 'Untitled', `${bp.key} sample has a label`);
  }
  const books = instantiateTemplate(TRACKER_TEMPLATES.find((t) => t.key === 'books'), { withSamples: true });
  const ctx = makeCtx([books.tracker], books.items);
  const progress = books.tracker.fields.find((f) => f.name === 'Progress');
  const reading = books.items.find((i) => Object.values(i.values).includes('A Short History of Nearly Everything'));
  assert.equal(getValue(reading, progress, ctx), 32);
});

test('hierarchy sample and cycle detection', () => {
  const { tracker, items } = instantiateTemplate(TRACKER_TEMPLATES.find((t) => t.key === 'learning'), { withSamples: true });
  assert.equal(tracker.settings.allowHierarchy, true);
  const root = items.find((i) => !i.parentId);
  const child = items.find((i) => i.parentId === root.id);
  assert.equal(wouldCycle(items, root.id, child.id), true);
  assert.equal(wouldCycle(items, child.id, root.id), false);
});

test('a user-saved template round-trips', () => {
  const src = instantiateTemplate(TRACKER_TEMPLATES.find((t) => t.key === 'projects')).tracker;
  const bp = blueprintFromTracker(src);
  const again = instantiateTemplate(bp).tracker;
  assert.deepEqual(again.fields.map((f) => [f.name, f.type]), src.fields.map((f) => [f.name, f.type]));
  assert.equal(again.views.length, src.views.length);
  assert.notEqual(again.fields[0].id, src.fields[0].id);
});

test('deleting a field cleans every reference to it', () => {
  const { tracker } = instantiateTemplate(TRACKER_TEMPLATES.find((t) => t.key === 'books'));
  const status = tracker.fields.find((f) => f.name === 'Status');
  const next = removeFieldFromTracker(tracker, status.id);
  const json = JSON.stringify(next);
  assert.ok(!json.includes(status.id));
});

test('type conversion is limited to safe families', () => {
  assert.equal(canConvert('text', 'longtext'), true);
  assert.equal(canConvert('number', 'percentage'), true);
  assert.equal(canConvert('text', 'number'), false);
  assert.equal(convertField(createField('text', 'x'), 'number'), null);
  const sel = createField('select', 'S', { config: { options: [createOption('a')] } });
  const { field, convertValue } = convertField(sel, 'multiselect');
  assert.equal(field.type, 'multiselect');
  assert.deepEqual(convertValue('opt1'), ['opt1']);
  assert.equal(field.config.options.length, 1);
  const d = convertField(createField('date', 'd'), 'datetime');
  assert.equal(d.convertValue('2026-01-02'), '2026-01-02T00:00');
});

test('defaults', () => {
  assert.equal(typeof defaultValue(createField('date', 'd', { config: { defaultToday: true } })), 'string');
  const s = createField('select', 's', { config: { options: [createOption('a')] } });
  s.default = s.config.options[0].id;
  assert.equal(defaultValue(s), s.config.options[0].id);
  assert.deepEqual(defaultValue(createField('multiselect', 'm')), []);
});

test('moving an item between trackers maps fields by name and type', () => {
  const a = instantiateTemplate(TRACKER_TEMPLATES.find((t) => t.key === 'books'), { withSamples: true });
  const b = instantiateTemplate(TRACKER_TEMPLATES.find((t) => t.key === 'movies'));
  const item = a.items.find((i) => i.values[a.tracker.fields.find((f) => f.name === 'Status').id]);
  const values = mapValuesToTracker(item, a.tracker, b.tracker);
  const title = b.tracker.fields.find((f) => f.name === 'Title');
  assert.ok(values[title.id]);
});

test('legacy books/movies state migrates to trackers and activity links', () => {
  const legacy = {
    categories: [{ id: 'mind', name: 'Mind', icon: '🧠', color: '#8a5fd6' }],
    books: [{ id: 'book1', title: 'Atomic Habits', author: 'James Clear', status: 'finished', categoryId: 'mind', rating: 9, started: '2026-01-01', finished: '2026-01-10', pages: 320, pagesRead: 320, notes: 'n', createdAt: 5 }],
    movies: [{ id: 'mov1', title: 'Inception', director: 'Nolan', status: 'watched', categoryId: 'mind', year: 2010, runtime: 148, watched: '2026-02-02', rating: 9, notes: '', createdAt: 6 }],
    days: { '2026-09-18': { activities: [{ id: 'a1', title: 'Atomic Habits', bookId: 'book1' }, { id: 'a2', title: 'Run' }], materializedRuleIds: [] } },
  };
  const out = migrateState(legacy);
  assert.equal(out.books, undefined);
  assert.equal(out.movies, undefined);
  assert.equal(out.trackers.length, 2);
  const bookT = out.trackers.find((t) => t.name.startsWith('Book'));
  const item = out.trackerItems.find((i) => i.id === 'book1');
  const ctx = makeCtx(out.trackers, out.trackerItems);
  assert.equal(itemLabel(bookT, item, ctx), 'Atomic Habits');
  const cat = bookT.fields.find((f) => f.name === 'Category');
  assert.equal(cat.config.options[0].label, 'Mind');
  assert.equal(item.values[cat.id], cat.config.options[0].id);
  assert.equal(isItemDone(item, bookT), true);
  assert.deepEqual(out.days['2026-09-18'].activities[0].link, { trackerId: bookT.id, itemId: 'book1' });
  assert.equal(out.days['2026-09-18'].activities[0].bookId, undefined);
  // idempotent
  assert.equal(migrateState(out).trackers.length, 2);
  // state with no legacy data gets empty tracker collections
  assert.deepEqual(migrateState({ categories: [] }).trackers, []);
});

test('sample trackers for a fresh install', () => {
  const { trackers, trackerItems } = buildSampleTrackers();
  assert.equal(trackers.length, 4);
  assert.ok(trackerItems.length > 20);
});

test('quick fields: explicit choice, direct progress, or the input behind a calculated percent', () => {
  const books = instantiateTemplate(TRACKER_TEMPLATES.find((t) => t.key === 'books')).tracker;
  assert.deepEqual(quickFields(books).map((f) => f.name), ['Pages read']);            // progress is a formula
  const learning = instantiateTemplate(TRACKER_TEMPLATES.find((t) => t.key === 'learning')).tracker;
  assert.deepEqual(quickFields(learning).map((f) => f.name), ['Progress']);            // real progress field
  const cars = instantiateTemplate(TRACKER_TEMPLATES.find((t) => t.key === 'cars')).tracker;
  assert.deepEqual(quickFields(cars), []);
  cars.settings.quickFieldIds = [cars.fields.find((f) => f.name === 'Mileage').id];
  assert.deepEqual(quickFields(cars).map((f) => f.name), ['Mileage']);
});

test('quick total: the field a calculated percent is measured against', () => {
  const { tracker, items } = instantiateTemplate(TRACKER_TEMPLATES.find((t) => t.key === 'books'), { withSamples: true });
  const pagesRead = tracker.fields.find((f) => f.name === 'Pages read');
  const item = items.find((i) => i.values[pagesRead.id] === 174);
  const r = quickTotal(tracker, pagesRead, item);
  assert.equal(r.field.name, 'Pages');
  assert.equal(r.total, 544);
  assert.equal(quickTotal(tracker, pagesRead, { values: {} }), null);          // unknown total -> no bar
  const learning = instantiateTemplate(TRACKER_TEMPLATES.find((t) => t.key === 'learning')).tracker;
  assert.equal(quickTotal(learning, learning.fields.find((f) => f.name === 'Progress'), { values: {} }), null);
});
