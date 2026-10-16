// Form state of the Add / Edit activity editor, kept pure so its transitions
// can be tested without a DOM.
//
// One modal, one state machine (draft.step):
//   STEPS.PICK_ACTIVITY   'pick'    search / browse recent and library activities;
//                                   nothing can be submitted from here
//   STEPS.EDIT_ACTIVITY   'library' configure an activity picked from the library;
//                                   title / icon / category come from the definition
//   STEPS.CREATE_ACTIVITY 'new'     a one-off activity typed in by hand
//                                   (saved to the library only when asked)
//   STEPS.EDIT_EXISTING   'edit'    an existing scheduled activity (its own
//                                   snapshot; never the library definition)
//
// What carries over between steps:
//   - picking a definition takes identity + defaults from it and starts with
//     empty notes / links: nothing from a previously picked activity leaks in.
//     A start time the user set themselves (or the clicked timeline slot) is
//     theirs and stays;
//   - whatever was typed on the 'new' step is stashed when leaving it and
//     restored when coming back, so switching to the picker loses nothing;
//   - the picker's search and filters survive a trip to the form and back.

import { minutesToClock, clockToMinutes, snapMinutes } from './time.js';

export const STEPS = {
  PICK_ACTIVITY: 'pick',
  EDIT_ACTIVITY: 'library',
  CREATE_ACTIVITY: 'new',
  EDIT_EXISTING: 'edit',
};

const emptyPicker = { query: '', categoryId: '', templateId: '' };

/** The start the Add Activity button offers: now, to the nearest quarter hour, today; 09:00 on other days. */
export function addButtonStart(isToday, nowMinutes) {
  return isToday ? Math.min(snapMinutes(nowMinutes, 15), 24 * 60 - 15) : 9 * 60;
}

/** What opens the editor, as the props it needs. */
export const editorRequest = {
  /** An empty timeline slot: that time is what the user asked for. */
  slot: (minutes) => ({ activity: null, preset: null, defaultStart: minutes, explicitSlot: true }),
  /** The Add Activity button. */
  button: ({ isToday, nowMinutes }) => ({ activity: null, preset: null, defaultStart: addButtonStart(isToday, nowMinutes), explicitSlot: false }),
  /** An existing scheduled activity. */
  activity: (activity) => ({ activity, preset: null, defaultStart: null, explicitSlot: false }),
};

export const MIN_DURATION = 5;
export const MAX_DURATION = 24 * 60;

const blankExtras = { notes: '', linkTrackerId: '', linkItemId: '', noteId: '' };

/**
 * The time an activity opens with. A slot the user clicked on the timeline is
 * what they asked for, so it wins; otherwise the activity's own default time,
 * then the editor's default (e.g. "now" from the + button).
 */
export function initialStart({ itemStart = null, defaultStart = null, explicitSlot = false }) {
  if (explicitSlot && defaultStart != null) return defaultStart;
  return itemStart ?? defaultStart ?? null;
}

function timeFields(start) {
  return { hasTime: start != null, time: minutesToClock(start ?? 9 * 60) };
}

function newFields(ctx, title = '') {
  return {
    title,
    icon: '📌',
    categoryId: ctx.categories?.[0]?.id,
    priority: 'required',
    duration: 30,
    fixed: true,
    ...timeFields(initialStart({ defaultStart: ctx.defaultStart, explicitSlot: ctx.explicitSlot })),
    ...blankExtras,
    saveToLibrary: false,
    timeTouched: false,
  };
}

/** The draft an editor opens with. */
export function createDraft({ activity = null, preset = null, dictionary = [], ...ctx }) {
  if (activity) {
    const own = {
      step: 'edit',
      activityId: activity.activityId || null,
      title: activity.title || '',
      icon: activity.icon || '📌',
      categoryId: activity.categoryId || ctx.categories?.[0]?.id,
      priority: activity.priority || 'required',
      duration: activity.duration ?? 30,
      fixed: activity.fixed ?? true,
      ...timeFields(activity.start ?? null),
      notes: activity.notes || '',
      linkTrackerId: activity.link?.trackerId || '',
      linkItemId: activity.link?.itemId || '',
      noteId: activity.noteId || '',
      saveToLibrary: false,
      timeTouched: true, // its time is already chosen: swapping the activity keeps it
      stash: null,
      picker: emptyPicker,
    };
    // "Create new activity" from the picker reopens this activity's own details (rename / customize it)
    return { ...own, stash: { ...own, step: 'new', activityId: null } };
  }
  const base = { step: 'pick', activityId: null, ...newFields(ctx), stash: null, picker: emptyPicker };
  if (preset) {
    const def = preset.sourceId && dictionary.find((d) => d.id === preset.sourceId);
    if (def) return selectDefinition(base, def, ctx);
    // a one-off recent entry: start a new activity from its snapshot
    return {
      ...base,
      step: 'new',
      title: preset.title || '',
      icon: preset.icon || '📌',
      categoryId: preset.categoryId || base.categoryId,
      priority: preset.priority || 'required',
      duration: preset.duration || 30,
      fixed: preset.fixed !== false,
    };
  }
  return base;
}

const stashOf = (d) => (d.step === 'new' ? { ...d, stash: null } : d.stash);

/** Pick a library definition: identity and defaults from it, a clean slate for everything else. */
export function selectDefinition(draft, def, ctx = {}) {
  const time = draft.timeTouched
    ? { hasTime: draft.hasTime, time: draft.time }
    : timeFields(initialStart({ itemStart: def.start ?? null, defaultStart: ctx.defaultStart, explicitSlot: ctx.explicitSlot }));
  return {
    ...draft,
    step: 'library',
    activityId: def.id,
    title: def.title,
    icon: def.icon || '📌',
    categoryId: def.categoryId,
    priority: def.priority || 'required',
    duration: def.duration ?? 30,
    fixed: def.fixed !== false,
    ...time,
    ...blankExtras,
    saveToLibrary: false,
    timeTouched: Boolean(draft.timeTouched),
    stash: stashOf(draft),
  };
}

/** Back to the picker. The current selection is dropped (it can't be submitted from there). */
export function backToPicker(draft) {
  return { ...draft, step: 'pick', activityId: null, stash: stashOf(draft) };
}

/** Start (or return to) a one-off activity; `title` prefills from a search that found nothing. */
export function startNew(draft, ctx = {}, title = '') {
  const restored = draft.stash ? { ...draft.stash } : { ...draft, ...newFields(ctx) };
  return {
    ...restored,
    step: 'new',
    activityId: null,
    title: title.trim() ? title.trim() : restored.title,
    stash: null,
  };
}

/** A plain field change. Identity fields can't change while a library activity is selected. */
export function setField(draft, name, value) {
  if (draft.step === 'library' && (name === 'title' || name === 'icon' || name === 'categoryId')) return draft;
  if (draft.step === 'pick') return draft;
  const next = { ...draft, [name]: value };
  if (name === 'time' || name === 'hasTime') next.timeTouched = true; // the user's own choice from now on
  return next;
}

/** Search / filter changes on the picker (kept across steps). */
export function setPicker(draft, patch) {
  return { ...draft, picker: { ...(draft.picker || emptyPicker), ...patch } };
}

/** True when the form would save something different from what it opened with. */
export function draftChanged(initial, current, opts) {
  return JSON.stringify(draftToSubmission(initial, opts).fields) !== JSON.stringify(draftToSubmission(current, opts).fields);
}

/** Problems that block submitting, keyed by field ('form' for the step itself). */
export function validateDraft(draft, { dictionary = [] } = {}) {
  const errors = {};
  if (draft.step === 'pick') errors.form = 'Choose an activity from the library or create a new one.';
  if (draft.step === 'library' && !dictionary.some((d) => d.id === draft.activityId)) {
    errors.form = 'That activity is no longer in the library — choose another one.';
  }
  if (!String(draft.title || '').trim()) errors.title = 'Give the activity a title.';
  const duration = Number(draft.duration);
  if (!Number.isFinite(duration) || duration < MIN_DURATION || duration > MAX_DURATION) {
    errors.duration = `Duration must be between ${MIN_DURATION} minutes and 24 hours.`;
  }
  if (draft.hasTime && !/^\d{1,2}:\d{2}$/.test(draft.time || '')) errors.time = 'Enter a start time.';
  return errors;
}

/**
 * What the editor hands to its owner. `fields` is a scheduled activity patch
 * (with `activityId` = the definition it came from, or null for a one-off);
 * `saveToLibrary` is only ever true when the user ticked it on the 'new' step.
 */
export function draftToSubmission(draft, { canLink = false, knowledge = false } = {}) {
  const fields = {
    title: String(draft.title).trim(),
    icon: draft.icon,
    categoryId: draft.categoryId,
    priority: draft.priority,
    duration: Math.round(Number(draft.duration)),
    fixed: draft.fixed !== false,
    start: draft.hasTime ? clockToMinutes(draft.time) : null,
    notes: draft.notes || '',
    activityId: draft.step === 'new' ? null : draft.activityId || null,
  };
  if (canLink) fields.link = draft.linkTrackerId && draft.linkItemId ? { trackerId: draft.linkTrackerId, itemId: draft.linkItemId } : null;
  if (knowledge) fields.noteId = draft.noteId || null;
  return { fields, saveToLibrary: draft.step === 'new' && Boolean(draft.saveToLibrary) };
}

/**
 * Quick add: picking an activity in the add flow schedules it right away with
 * its defaults (at the clicked slot / default time). Takes the draft the pick
 * produced; returns the fields to add, or null when it can't be added as is
 * (then the form is shown instead).
 */
export function quickAddFields(picked, { dictionary = [], canLink = false, knowledge = false } = {}) {
  if (Object.keys(validateDraft(picked, { dictionary })).length) return null;
  return draftToSubmission(picked, { canLink, knowledge }).fields;
}

/** Definition fields for "Save to Activity Library" (what the activity is, not when). */
export function definitionFromFields(fields) {
  return {
    title: fields.title,
    icon: fields.icon,
    categoryId: fields.categoryId,
    priority: fields.priority,
    duration: fields.duration,
    fixed: fields.fixed !== false,
    start: null,
  };
}
