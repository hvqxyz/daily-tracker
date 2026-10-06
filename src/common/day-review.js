// The day review is nothing but a summary of the day's timeline activities —
// there is no separate data entry behind it.

import { PRIORITIES } from './model.js';

const plannedOf = (a) => a.plannedDuration ?? a.duration ?? 0;
const actualOf = (a) => (a.status === 'completed' ? a.actualDuration ?? a.duration ?? 0 : 0);
const isUnfinished = (a) => a.status !== 'completed' && a.status !== 'skipped';

export function summarizeDay(activities, categories) {
  const total = activities.length;
  const completed = activities.filter((a) => a.status === 'completed').length;

  const byPriority = PRIORITIES.map((p) => {
    const items = activities.filter((a) => a.priority === p.id);
    return { ...p, total: items.length, done: items.filter((a) => a.status === 'completed').length };
  });

  const byCategory = categories.map((cat) => {
    const items = activities.filter((a) => a.categoryId === cat.id);
    const planned = items.reduce((sum, a) => sum + plannedOf(a), 0);
    const actual = items.reduce((sum, a) => sum + actualOf(a), 0);
    return {
      ...cat,
      planned,
      actual,
      empty: items.length === 0,
      progress: planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : null,
    };
  });

  return {
    total,
    completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
    plannedMinutes: activities.reduce((sum, a) => sum + plannedOf(a), 0),
    unfinished: activities
      .filter(isUnfinished)
      .sort((a, b) => (a.start ?? 1e9) - (b.start ?? 1e9)),
    byPriority,
    byCategory,
  };
}
