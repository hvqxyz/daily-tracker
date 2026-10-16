import { useSyncExternalStore } from 'react';
import { todayKey, shiftDateKey, weekdayIndex } from './time.js';
import { DEFAULT_CATEGORIES, STATUSES } from './model.js';
import { buildSeed } from './seed.js';
import { migrateState } from '../trackers/migrate.js';
import { ensureNotesState } from '../notes/migrate.js';
import {
  changedFields, deleteSeriesFrom as deleteSeriesFromState, endSeries as endSeriesState, excludeOccurrence, materializeOccurrence, normalizeRule, occDate,
  pauseSeries as pauseSeriesState, removeSeries, repeatToRule, resolveDay, resumeSeries as resumeSeriesState, ruleFromFields, setActivityStatusState,
  splitSeries as splitSeriesState, updateSeries as updateSeriesState,
} from './recurrence.js';
import { recordRecent } from './recent-activities.js';
import {
  activityFieldsFromTemplateItem, deleteDefinition, migrateLibraryRefs, reportHasNews, resolveTemplateItems, updateDefinition,
} from './library.js';

const STORAGE_KEY = 'daily-planner-state-v1';

function makeId(prefix = 'a') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Older rules ({ type, weekdays }) get the fields the recurrence engine needs. */
function normalizeRecurrences(s) {
  const today = todayKey();
  if (!(s.recurrences || []).some((r) => !r.freq || r.startDate === undefined)) return s;
  return { ...s, recurrences: s.recurrences.map((r) => normalizeRule(r, today)) };
}

function emptyDay() {
  return { activities: [], materializedRuleIds: [] };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to seed
  }
  return buildSeed();
}

/** Older snapshots predate the activity dictionary. */
function ensureActivityDictionary(s) {
  return s.activityDictionary ? s : { ...s, activityDictionary: [] };
}

const LIBRARY_BACKUP_KEY = `${STORAGE_KEY}.pre-library-refs`;

/**
 * Upgrades that must also run on data coming from elsewhere (a Sheets pull,
 * another tab): rule defaults, the dictionary, and template items becoming
 * references to library definitions (common/library.js). Each step is
 * idempotent. If the library migration throws, the unmigrated state is kept —
 * every reader still understands old embedded template items.
 */
function upgradeState(s) {
  const base = ensureActivityDictionary(normalizeRecurrences(s));
  try {
    const { state: next, report, changed } = migrateLibraryRefs(base);
    if (!changed) return { state: base, before: base, changed: false };
    return { state: reportHasNews(report) ? { ...next, libraryNotice: { at: Date.now(), ...report } } : next, before: base, changed: true };
  } catch (err) {
    console.error('Activity library migration failed; keeping the previous template format', err);
    return { state: base, before: base, changed: false };
  }
}

/** One copy of the data as it was before template items became library references. */
function backupBeforeLibraryMigration(before) {
  try {
    if (!localStorage.getItem(LIBRARY_BACKUP_KEY)) localStorage.setItem(LIBRARY_BACKUP_KEY, JSON.stringify(before));
  } catch {
    // no room for a backup — the migration itself never deletes anything
  }
}

// Older snapshots (hard-coded books/movies) are upgraded to generic trackers.
let state = (() => {
  const upgraded = upgradeState(ensureNotesState(migrateState(load())));
  if (upgraded.changed) backupBeforeLibraryMigration(upgraded.before);
  return upgraded.state;
})();
persist(); // write the upgraded shape back so migrated ids stay stable across reloads
const listeners = new Set();

// Another tab saved: adopt its data instead of later overwriting it with ours.
// Data written by a tab still running an older version is upgraded the same
// way (deterministically, so every tab arrives at the same ids).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const upgraded = upgradeState(JSON.parse(e.newValue));
      state = upgraded.state;
      if (upgraded.changed) persist();
      listeners.forEach((l) => l());
    } catch {
      // unreadable data from the other tab — keep ours
    }
  });
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private mode / quota) — keep working in memory
  }
}

function commit(nextState) {
  state = nextState;
  persist();
  listeners.forEach((l) => l());
  scheduleSync();
}

function getSnapshot() {
  return state;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// ---------------------------------------------------------------------------
// Google Sheets sync (opt-in, local-first)
//
// localStorage stays the instant source of truth for every interaction —
// drags, resizes, status changes all commit locally with no network round
// trip. When sync is connected, edits are pushed to Sheets in the
// background on a short debounce, so the UI never waits on a network call.
// Sync status is a separate, unpersisted store: it's never written into
// `state`, so it never ends up in the localStorage snapshot or gets pushed
// as planner data.

const SYNC_CONNECTED_KEY = 'daily-planner-sync-connected';
const SYNC_LAST_KEY = 'daily-planner-sync-last';
const PUSH_DEBOUNCE_MS = 2500;

let syncStatus = {
  connected: localStorage.getItem(SYNC_CONNECTED_KEY) === '1',
  connecting: false,
  syncing: false,
  lastSyncedAt: Number(localStorage.getItem(SYNC_LAST_KEY)) || null,
  error: null,
  email: null,
};
const syncListeners = new Set();
let pushTimer = null;

function setSyncStatus(patch) {
  syncStatus = { ...syncStatus, ...patch };
  syncListeners.forEach((l) => l());
}

function subscribeSync(listener) {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSync, () => syncStatus);
}

function scheduleSync() {
  if (!syncStatus.connected) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(runPush, PUSH_DEBOUNCE_MS);
}

async function runPush() {
  setSyncStatus({ syncing: true, error: null });
  try {
    const { pushSnapshot } = await import('./sheets-sync.js');
    await pushSnapshot(state);
    const now = Date.now();
    localStorage.setItem(SYNC_LAST_KEY, String(now));
    setSyncStatus({ syncing: false, lastSyncedAt: now });
  } catch (err) {
    setSyncStatus({ syncing: false, error: err.message });
  }
}

/** Must be called from a click handler — the first Google auth prompt needs a user gesture. */
export async function connectSync() {
  setSyncStatus({ connecting: true, error: null });
  try {
    const [{ getAccessToken, getUserProfile }, { remoteHasData, pullSnapshot, pushSnapshot }] = await Promise.all([
      import('./auth.js'),
      import('./sheets-sync.js'),
    ]);
    await getAccessToken();
    const profile = await getUserProfile().catch(() => null);

    if (await remoteHasData()) {
      const pulled = await pullSnapshot(state);
      state = upgradeState(pulled).state;
      persist();
      listeners.forEach((l) => l());
    } else {
      await pushSnapshot(state);
    }

    localStorage.setItem(SYNC_CONNECTED_KEY, '1');
    const now = Date.now();
    localStorage.setItem(SYNC_LAST_KEY, String(now));
    setSyncStatus({ connected: true, connecting: false, lastSyncedAt: now, email: profile?.email || null });
  } catch (err) {
    setSyncStatus({ connecting: false, error: err.message });
  }
}

export async function disconnectSync() {
  clearTimeout(pushTimer);
  const { signOut } = await import('./auth.js');
  signOut();
  localStorage.removeItem(SYNC_CONNECTED_KEY);
  setSyncStatus({ connected: false, email: null, error: null });
}

/** Force-pulls the remote snapshot now, overwriting local state. */
export async function pullFromSheets() {
  setSyncStatus({ syncing: true, error: null });
  try {
    const { pullSnapshot } = await import('./sheets-sync.js');
    const pulled = await pullSnapshot(state);
    state = upgradeState(pulled).state;
    persist();
    listeners.forEach((l) => l());
    const now = Date.now();
    localStorage.setItem(SYNC_LAST_KEY, String(now));
    setSyncStatus({ syncing: false, lastSyncedAt: now });
  } catch (err) {
    setSyncStatus({ syncing: false, error: err.message });
  }
}

/** Pushes immediately instead of waiting for the debounce. */
export async function syncNow() {
  clearTimeout(pushTimer);
  await runPush();
}

/** Opens the linked Google Sheet in a new tab, if one exists yet. */
export async function openInSheets() {
  const { getSpreadsheetUrl } = await import('./sheets-sync.js');
  const url = getSpreadsheetUrl();
  if (url) window.open(url, '_blank', 'noopener');
}

// ---------------------------------------------------------------------------
// Settings

export function updateSettings(patch) {
  commit({ ...state, settings: { ...state.settings, ...patch } });
}

// ---------------------------------------------------------------------------
// Categories

export function addCategory(cat) {
  const category = { id: makeId('cat'), color: '#3682e0', ...cat };
  commit({ ...state, categories: [...state.categories, category] });
  return category;
}

export function updateCategory(id, patch) {
  commit({
    ...state,
    categories: state.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  });
}

export function deleteCategory(id) {
  if (state.categories.length <= 1) return;
  commit({ ...state, categories: state.categories.filter((c) => c.id !== id) });
}

// ---------------------------------------------------------------------------
// Templates

export function addTemplate(template) {
  const t = { id: makeId('tpl'), items: [], ...template };
  commit({ ...state, templates: [...state.templates, t] });
  return t;
}

/** Name / icon / items (library references with their scheduling, in order). */
export function updateTemplate(id, patch) {
  commit({
    ...state,
    templates: state.templates.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t)),
  });
}

/** Copies a template (fresh ids for it and its items) and inserts it right after the original. */
export function duplicateTemplate(id) {
  const index = state.templates.findIndex((t) => t.id === id);
  if (index === -1) return null;
  const source = state.templates[index];
  const copy = {
    ...source,
    id: makeId('tpl'),
    name: `${source.name} (copy)`,
    items: source.items.map((it) => ({ ...it, id: makeId('ti') })),
  };
  const templates = [...state.templates];
  templates.splice(index + 1, 0, copy);
  commit({ ...state, templates });
  return copy;
}

export function deleteTemplate(id) {
  commit({ ...state, templates: state.templates.filter((t) => t.id !== id) });
}

/**
 * Adds a template's activities to a day: identity from the library
 * definitions, scheduling from the template. Items whose definition and
 * snapshot are both gone are skipped (and counted).
 */
export function applyTemplateToDay(dateKey, templateId) {
  const template = state.templates.find((t) => t.id === templateId);
  if (!template) return { added: 0, skipped: 0 };
  const day = ensureDay(state, dateKey);
  const fields = resolveTemplateItems(template, state.activityDictionary).map(activityFieldsFromTemplateItem);
  const newActivities = fields.filter(Boolean).map((f) => scheduledActivity(f));
  const days = {
    ...state.days,
    [dateKey]: { ...day, activities: [...day.activities, ...newActivities] },
  };
  commit({ ...state, days });
  return { added: newActivities.length, skipped: fields.length - newActivities.length };
}

export const newTemplateItemId = () => makeId('ti');

// ---------------------------------------------------------------------------
// Activity Library (stored as `activityDictionary`) — reusable definitions:
// what an activity is (title, icon, category) and its defaults. Templates
// reference them by id; scheduled activities keep their own copy.

export function addDictionaryItem(item) {
  const withId = { id: makeId('ad'), start: null, fixed: true, priority: 'required', duration: 30, ...item };
  commit({ ...state, activityDictionary: [...state.activityDictionary, withId] });
  return withId;
}

/** Changes a definition; templates resolve it live, history keeps its own copy. */
export function updateDictionaryItem(id, patch) {
  commit(updateDefinition(state, id, patch));
}

/** Deletes a definition and removes it from the templates using it (see libraryReferences). */
export function deleteDictionaryItem(id) {
  commit(deleteDefinition(state, id));
}

export function dismissLibraryNotice() {
  const { libraryNotice: _n, ...rest } = state;
  commit(rest);
}

/** Remember a successfully scheduled activity for the + button's "Recent activities" list. */
export function recordRecentActivity(fields, sourceId = null) {
  commit({ ...state, recentActivities: recordRecent(state.recentActivities, fields, sourceId) });
}

// ---------------------------------------------------------------------------
// Recurrences

/** Deletes the rule and the not-yet-done occurrences from today on; history stays. */
export function deleteRecurrence(id) {
  commit(removeSeries(state, id, todayKey()));
}

/** A new recurring activity: one rule; occurrences are resolved from it. */
export function addRecurringActivity(dateKey, fields, repeat) {
  const schedule = repeatToRule(repeat, dateKey);
  if (!schedule) return null;
  const rule = ruleFromFields(fields, schedule, dateKey, { id: makeId('rec'), defaultCategoryId: state.categories[0]?.id });
  commit({ ...state, recurrences: [...state.recurrences, rule] });
  return rule;
}

export function updateSeries(ruleId, fields, repeat = null, anchorDate = null) {
  const rule = state.recurrences.find((r) => r.id === ruleId);
  if (!rule) return;
  const schedule = repeat ? repeatToRule(repeat, rule.startDate || anchorDate || todayKey()) : null;
  commit(updateSeriesState(state, ruleId, { fields, schedule }));
}

/** "This and following occurrences" — split the series at `dateKey`. */
export function splitSeriesFrom(ruleId, dateKey, fields, repeat = null) {
  const schedule = repeat ? repeatToRule(repeat, dateKey) : null;
  commit(splitSeriesState(state, ruleId, dateKey, { fields, schedule }, makeId('rec')));
}

export function deleteSeriesFrom(ruleId, dateKey) {
  commit(deleteSeriesFromState(state, ruleId, dateKey));
}

/** Stop a series after `lastDate` (default today), keeping it and its history. */
export function endSeries(ruleId, lastDate = todayKey()) {
  commit(endSeriesState(state, ruleId, lastDate));
}

export function pauseSeries(ruleId, dateKey) {
  commit(pauseSeriesState(state, ruleId, dateKey));
}

export function resumeSeries(ruleId) {
  commit(resumeSeriesState(state, ruleId));
}

// ---------------------------------------------------------------------------
// Days

function ensureDay(s, dateKey) {
  return s.days[dateKey] || emptyDay();
}

/** Pure read — safe to call during render. Includes occurrences implied by recurrence rules. */
export function selectDay(s, dateKey) {
  return resolveDay(s, dateKey);
}

/**
 * Per-day reflection, independent from activities: `wellbeing` (1-5 or null)
 * and a free-text `note`. Only the fields present in `patch` change.
 */
export function setDayReflection(dateKey, patch) {
  const day = ensureDay(state, dateKey);
  const next = { ...day };
  if ('wellbeing' in patch) next.wellbeing = patch.wellbeing == null ? null : Math.min(5, Math.max(1, Math.round(Number(patch.wellbeing))));
  if ('note' in patch) next.note = String(patch.note ?? '');
  commit({ ...state, days: { ...state.days, [dateKey]: next } });
}

/** A new scheduled activity with defaults filled and its planned snapshot taken. */
function scheduledActivity(activity) {
  const newActivity = {
    id: makeId('act'),
    icon: '📌',
    categoryId: state.categories[0]?.id,
    priority: 'required',
    start: null,
    duration: 30,
    fixed: true,
    status: STATUSES.PLANNED,
    notes: '',
    recurrenceId: null,
    createdAt: Date.now(),
    ...activity,
  };
  newActivity.plannedStart = newActivity.start;
  newActivity.plannedDuration = newActivity.duration;
  return newActivity;
}

export function addActivity(dateKey, activity) {
  const day = ensureDay(state, dateKey);
  const newActivity = scheduledActivity(activity);
  const days = { ...state.days, [dateKey]: { ...day, activities: [...day.activities, newActivity] } };
  commit({ ...state, days });
  return newActivity;
}

/**
 * Updates an activity. If the patch touches start/duration on a day that is
 * already today-or-earlier (i.e. being lived, not just drafted), the planned
 * snapshot is left untouched and the status flips to "moved" so plan vs.
 * actual stays comparable. Future days are still pure draft, so the snapshot
 * moves with the edit.
 */
export function updateActivity(dateKey, activityId, patch) {
  // an implied occurrence becomes a stored one the moment it is changed
  const base = materializeOccurrence(state, dateKey, activityId);
  const day = ensureDay(base, dateKey);
  const isFuture = dateKey > todayKey();
  const touchesTime = 'start' in patch || 'duration' in patch;

  const activities = day.activities.map((act) => {
    if (act.id !== activityId) return act;
    let next = { ...act, ...patch };
    if (act.recurrenceId) next.overrides = { ...(act.overrides || {}), ...changedFields(act, patch) };
    if (touchesTime) {
      if (isFuture) {
        next.plannedStart = next.start;
        next.plannedDuration = next.duration;
      } else if (act.status === STATUSES.PLANNED) {
        next.status = STATUSES.MOVED;
      }
    }
    return next;
  });

  commit({ ...base, days: { ...base.days, [dateKey]: { ...day, activities } } });
}

/** Deleting one occurrence of a series only removes that occurrence. */
export function deleteActivity(dateKey, activityId) {
  const target = resolveDay(state, dateKey).activities.find((a) => a.id === activityId);
  let base = state;
  if (target?.recurrenceId && base.recurrences.some((r) => r.id === target.recurrenceId)) {
    base = excludeOccurrence(base, target.recurrenceId, occDate(target, dateKey));
  }
  const day = ensureDay(base, dateKey);
  const activities = day.activities.filter((a) => a.id !== activityId);
  commit({ ...base, days: { ...base.days, [dateKey]: { ...day, activities } } });
}

export function setActivityStatus(dateKey, activityId, status) {
  commit(setActivityStatusState(state, dateKey, activityId, status));
}

export function moveActivityToDay(fromDateKey, activityId, toDateKey) {
  if (fromDateKey === toDateKey) return;
  let base = materializeOccurrence(state, fromDateKey, activityId);
  const fromDay = ensureDay(base, fromDateKey);
  const activity = fromDay.activities.find((a) => a.id === activityId);
  if (!activity) return;
  const toDay = ensureDay(base, toDateKey);

  const moved = {
    ...activity,
    status: STATUSES.PLANNED,
    start: activity.fixed ? activity.start : null,
    plannedStart: activity.fixed ? activity.start : null,
  };
  if (activity.recurrenceId) {
    // it stays part of its series (keeping its original date), but the old date must not regenerate it
    moved.occurrenceDate = occDate(activity, fromDateKey);
    base = excludeOccurrence(base, activity.recurrenceId, moved.occurrenceDate);
  }

  commit({
    ...base,
    days: {
      ...base.days,
      [fromDateKey]: { ...fromDay, activities: fromDay.activities.filter((a) => a.id !== activityId) },
      [toDateKey]: { ...toDay, activities: [...toDay.activities, moved] },
    },
  });
}

export function addCategoryIfMissing() {
  if (state.categories.length === 0) {
    commit({ ...state, categories: DEFAULT_CATEGORIES });
  }
}

// ---------------------------------------------------------------------------
// Low-level access for feature stores (e.g. trackers) that live in their own module.

export function getState() {
  return state;
}

/** Applies a pure state -> state function and persists/notifies as usual. */
export function mutateState(fn) {
  commit(fn(state));
}

export { STATUSES };
export const idFactory = makeId;
