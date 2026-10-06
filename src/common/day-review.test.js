import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDay } from './day-review.js';

const cats = [
  { id: 'body', name: 'Body', icon: '💪', color: '#d0733b' },
  { id: 'mind', name: 'Mind', icon: '🧠', color: '#8a5fd6' },
  { id: 'career', name: 'Career', icon: '💼', color: '#3682e0' },
];
const act = (o) => ({ duration: 30, plannedDuration: 30, priority: 'should', status: 'planned', ...o });

test('the review is derived purely from the day\'s activities', () => {
  const s = summarizeDay([
    act({ id: 'gym', categoryId: 'body', duration: 60, plannedDuration: 60, status: 'completed', start: 1080 }),
    act({ id: 'read', categoryId: 'mind', status: 'planned', start: 1200 }),
  ], cats);
  const body = s.byCategory.find((c) => c.id === 'body');
  const mind = s.byCategory.find((c) => c.id === 'mind');
  const career = s.byCategory.find((c) => c.id === 'career');
  assert.deepEqual([body.planned, body.actual, body.progress], [60, 60, 100]);
  assert.deepEqual([mind.planned, mind.actual, mind.progress], [30, 0, 0]);
  assert.deepEqual([career.empty, career.progress], [true, null]);
  assert.equal(s.percent, 50);
  assert.equal(s.plannedMinutes, 90);
  assert.deepEqual(s.unfinished.map((a) => a.id), ['read']);
  assert.deepEqual(s.byPriority.find((p) => p.id === 'should').done, 1);
});

test('completion counts, skipped is not unfinished, actual uses what really happened', () => {
  const s = summarizeDay([
    act({ id: 'a', categoryId: 'body', status: 'completed', duration: 45, actualDuration: 40, plannedDuration: 30 }),
    act({ id: 'b', categoryId: 'body', status: 'skipped' }),
    act({ id: 'c', categoryId: 'body', status: 'moved', start: 100 }),
    act({ id: 'd', categoryId: 'body', status: 'in_progress', start: 50 }),
    act({ id: 'e', categoryId: 'body', status: 'planned' }),
  ], cats);
  assert.equal(s.total, 5);
  assert.equal(s.completed, 1);
  assert.equal(s.percent, 20);
  assert.deepEqual(s.unfinished.map((a) => a.id), ['d', 'c', 'e']);   // by time, flexible last; skipped excluded
  const body = s.byCategory.find((c) => c.id === 'body');
  assert.equal(body.actual, 40);                                      // actualDuration wins
  assert.equal(body.progress, Math.min(100, Math.round((40 / 150) * 100)));
  assert.equal(summarizeDay([], cats).percent, 0);
});
