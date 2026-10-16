import test from 'node:test';
import assert from 'node:assert/strict';
import { recordRecent, resolveRecent, RECENT_LIMIT } from './recent-activities.js';

const act = (title, icon = '📌', extra = {}) => ({ title, icon, categoryId: 'mind', priority: 'should', duration: 30, fixed: true, ...extra });

test('most recent use goes first and a reuse moves it back to the top', () => {
  let list = [];
  list = recordRecent(list, act('Deep work'), null, 1);
  list = recordRecent(list, act('Running'), null, 2);
  list = recordRecent(list, act('Read a book'), null, 3);
  assert.deepEqual(list.map((e) => e.title), ['Read a book', 'Running', 'Deep work']);
  list = recordRecent(list, act('Deep work'), null, 4);
  assert.deepEqual(list.map((e) => e.title), ['Deep work', 'Read a book', 'Running']);
});

test('entries are deduplicated by source id, even after a rename', () => {
  let list = recordRecent([], act('Run'), 'ad_1', 1);
  list = recordRecent(list, act('Running'), 'ad_1', 2);
  assert.equal(list.length, 1);
  assert.equal(list[0].title, 'Running');
});

test('a dictionary pick replaces the same free-form activity', () => {
  let list = recordRecent([], act('Running', '🏃'), null, 1);
  list = recordRecent(list, act(' running ', '🏃'), 'ad_1', 2);
  assert.equal(list.length, 1);
  assert.equal(list[0].sourceId, 'ad_1');
});

test('the list is capped at the limit of distinct activities', () => {
  let list = [];
  for (let i = 0; i < RECENT_LIMIT + 3; i++) list = recordRecent(list, act(`A${i}`), null, i);
  assert.equal(list.length, RECENT_LIMIT);
  assert.equal(list[0].title, `A${RECENT_LIMIT + 2}`);
});

test('resolving uses the current library definition and falls back to the snapshot', () => {
  let list = recordRecent([], act('Deep work', '💻', { duration: 60 }), 'ad_1', 1);
  list = recordRecent(list, act('Gone', '👻'), 'ad_deleted', 2);
  list = recordRecent(list, act('Walk', '🚶'), null, 3);
  const dictionary = [{ id: 'ad_1', ...act('Focus', '💻', { duration: 120, start: 540 }) }];
  const r = resolveRecent(list, dictionary);
  assert.deepEqual(r.map((e) => [e.title, e.source, e.sourceId, e.duration]), [
    ['Walk', null, null, 30], ['Gone', null, null, 30], ['Focus', 'library', 'ad_1', 120],
  ]);
  assert.equal(r[1].start, null, 'a deleted definition is never swapped for another activity');
  assert.equal(r[2].start, 540);
});

test('empty or missing history resolves to an empty list', () => {
  assert.deepEqual(resolveRecent(undefined), []);
  assert.deepEqual(resolveRecent([], []), []);
});
