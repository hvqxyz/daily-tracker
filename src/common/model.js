// Core domain constants shared across the app: priorities, statuses and the
// default life categories. Kept framework-free so storage.js and components
// can both depend on it without cycles.

export const PRIORITIES = [
  { id: 'required', label: 'Required', icon: '🔴', order: 0 },
  { id: 'should', label: 'Should', icon: '🟡', order: 1 },
  { id: 'optional', label: 'Optional', icon: '🟢', order: 2 },
];

export function priorityInfo(id) {
  return PRIORITIES.find((p) => p.id === id) || PRIORITIES[0];
}

export const STATUSES = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  MOVED: 'moved',
};

// How the day felt, 1-5. Stored per day as `day.wellbeing` (number | null),
// separate from activities so Insights can read it as plain daily data.
export const WELLBEING_LEVELS = [
  { value: 1, emoji: '😞', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

export function wellbeingInfo(value) {
  return WELLBEING_LEVELS.find((l) => l.value === value) || null;
}

export const DEFAULT_CATEGORIES = [
  { id: 'career', name: 'Career', icon: '💼', color: '#3682e0' },
  { id: 'body', name: 'Body', icon: '🏋️', color: '#d0733b' },
  { id: 'mind', name: 'Mind', icon: '🧠', color: '#8a5fd6' },
  { id: 'relationships', name: 'Relationships', icon: '❤️', color: '#d5487a' },
  { id: 'pleasure', name: 'Pleasure', icon: '🎮', color: '#199e70' },
  { id: 'life', name: 'Life', icon: '🏠', color: '#a08a3f' },
  { id: 'recovery', name: 'Recovery', icon: '😴', color: '#5f7ad6' },
  { id: 'finance', name: 'Finance', icon: '💰', color: '#3f9e9e' },
];

export function categoryInfo(categories, id) {
  return categories.find((c) => c.id === id) || categories[0];
}

// Day state is *derived* from its date relative to today — there's no
// separate "finalize" action. Future days are still being shaped (Draft),
// today is being lived (Live), anything earlier is history (Actual).
export function dayStateForDate(dateKey, todayKey) {
  if (dateKey > todayKey) return 'draft';
  if (dateKey === todayKey) return 'live';
  return 'actual';
}
