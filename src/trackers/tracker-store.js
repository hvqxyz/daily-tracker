// Actions for the generic tracker system. State lives in the shared app store
// (`state.trackers`, `state.trackerItems`, `state.trackerTemplates`) so it is
// persisted and synced like everything else; these are thin, pure-ish updates.

import { getState, mutateState, addActivity } from '../common/store.js';
import { createOption } from './engine/fieldTypes.js';
import { createView, ensureDefaultView, mapValuesToTracker, newItem, wouldCycle } from './engine/schema.js';
import { makeCtx, itemLabel, titleField, getValue } from './engine/data.js';
import { newId } from './engine/ids.js';
import { todayKey } from '../common/time.js';

export const trackerById = (state, id) => state.trackers.find((t) => t.id === id);

const replaceTracker = (state, tracker) => ({ ...state, trackers: state.trackers.map((t) => (t.id === tracker.id ? tracker : t)) });

/** Immutable update of one tracker via fn(tracker) -> tracker. */
export function updateTracker(trackerId, fn) {
  mutateState((s) => {
    const t = trackerById(s, trackerId);
    return t ? replaceTracker(s, fn(t)) : s;
  });
}

// ---------------------------------------------------------------------------
// Trackers

export function addTracker(tracker, items = []) {
  const ready = ensureDefaultView(tracker);
  const withDefault = ready.settings.defaultViewId ? ready : { ...ready, settings: { ...ready.settings, defaultViewId: ready.views[0].id } };
  mutateState((s) => ({ ...s, trackers: [...s.trackers, withDefault], trackerItems: [...s.trackerItems, ...items] }));
  return withDefault;
}

/**
 * Saves an edited tracker schema. `transforms` maps fieldId -> fn(value) for
 * fields whose type was converted; values of removed fields are dropped.
 */
export function saveTracker(next, transforms = {}) {
  mutateState((s) => {
    const fieldIds = new Set(next.fields.map((f) => f.id));
    const validOptions = new Map(next.fields.filter((f) => f.type === 'select' || f.type === 'multiselect').map((f) => [f.id, new Set((f.config.options || []).map((o) => o.id))]));
    const trackerItems = s.trackerItems.map((item) => {
      if (item.trackerId !== next.id) return item;
      const values = {};
      for (const [fid, v] of Object.entries(item.values || {})) {
        if (!fieldIds.has(fid)) continue;
        let value = transforms[fid] ? transforms[fid](v) : v;
        const valid = validOptions.get(fid);
        if (valid) value = Array.isArray(value) ? value.filter((id) => valid.has(id)) : valid.has(value) ? value : null;
        values[fid] = value;
      }
      return { ...item, values };
    });
    const ensured = ensureDefaultView(next);
    return { ...replaceTracker(s, ensured), trackerItems };
  });
}

export function deleteTracker(trackerId) {
  mutateState((s) => {
    const days = {};
    for (const [date, day] of Object.entries(s.days)) {
      days[date] = { ...day, activities: day.activities.map((a) => (a.link?.trackerId === trackerId ? { ...a, link: null } : a)) };
    }
    return {
      ...s,
      days,
      trackers: s.trackers
        .filter((t) => t.id !== trackerId)
        .map((t) => ({
          ...t,
          fields: t.fields.map((f) => (f.type === 'relation' && f.config.targetTrackerId === trackerId ? { ...f, config: { ...f.config, targetTrackerId: null } } : f)),
        })),
      trackerItems: s.trackerItems.filter((i) => i.trackerId !== trackerId),
      notes: (s.notes || []).map((n) => {
        const gone = new Set(s.trackerItems.filter((i) => i.trackerId === trackerId).map((i) => i.id));
        return n.trackerItemIds.some((id) => gone.has(id)) ? { ...n, trackerItemIds: n.trackerItemIds.filter((id) => !gone.has(id)) } : n;
      }),
    };
  });
}

export function addFieldOption(trackerId, fieldId, label) {
  const option = createOption(label);
  updateTracker(trackerId, (t) => ({
    ...t,
    fields: t.fields.map((f) => (f.id === fieldId ? { ...f, config: { ...f.config, options: [...(f.config.options || []), option] } } : f)),
  }));
  return option;
}

// ---------------------------------------------------------------------------
// Views and widgets

export function addView(trackerId, type, name) {
  let created;
  updateTracker(trackerId, (t) => {
    created = createView(t, type, name);
    return { ...t, views: [...t.views, created] };
  });
  return created;
}

export function updateView(trackerId, viewId, patch) {
  updateTracker(trackerId, (t) => ({
    ...t,
    views: t.views.map((v) => {
      if (v.id !== viewId) return v;
      const { config, ...rest } = typeof patch === 'function' ? patch(v) : patch;
      return { ...v, ...rest, config: config ? { ...v.config, ...config } : v.config };
    }),
  }));
}

export function duplicateView(trackerId, viewId) {
  let copy;
  updateTracker(trackerId, (t) => {
    const src = t.views.find((v) => v.id === viewId);
    if (!src) return t;
    copy = { ...JSON.parse(JSON.stringify(src)), id: newId('view'), name: `${src.name} copy` };
    return { ...t, views: [...t.views, copy] };
  });
  return copy;
}

export function deleteView(trackerId, viewId) {
  updateTracker(trackerId, (t) => {
    if (t.views.length <= 1) return t;
    const views = t.views.filter((v) => v.id !== viewId);
    return { ...t, views, settings: { ...t.settings, defaultViewId: t.settings.defaultViewId === viewId ? views[0].id : t.settings.defaultViewId } };
  });
}

export function addWidget(trackerId, widget) {
  updateTracker(trackerId, (t) => ({ ...t, widgets: [...(t.widgets || []), widget] }));
}

export function updateWidget(trackerId, widget) {
  updateTracker(trackerId, (t) => ({ ...t, widgets: t.widgets.map((w) => (w.id === widget.id ? widget : w)) }));
}

export function deleteWidget(trackerId, widgetId) {
  updateTracker(trackerId, (t) => ({ ...t, widgets: t.widgets.filter((w) => w.id !== widgetId) }));
}

export function setWidgets(trackerId, widgets) {
  updateTracker(trackerId, (t) => ({ ...t, widgets }));
}

// ---------------------------------------------------------------------------
// Templates

export function addTrackerTemplate(blueprint) {
  mutateState((s) => ({ ...s, trackerTemplates: [...(s.trackerTemplates || []), blueprint] }));
}

export function deleteTrackerTemplate(key) {
  mutateState((s) => ({ ...s, trackerTemplates: (s.trackerTemplates || []).filter((t) => t.key !== key) }));
}

// ---------------------------------------------------------------------------
// Items

export function addItem(trackerId, values = {}, parentId = null) {
  const tracker = trackerById(getState(), trackerId);
  if (!tracker) return null;
  const item = newItem(tracker, values, parentId);
  mutateState((s) => ({ ...s, trackerItems: [...s.trackerItems, item] }));
  return item;
}

/** Merges `values` into an item; `extra` may carry parentId / archived. */
export function updateItem(itemId, values = {}, extra = {}) {
  mutateState((s) => ({
    ...s,
    trackerItems: s.trackerItems.map((i) => {
      if (i.id !== itemId) return i;
      if (extra.parentId !== undefined && wouldCycle(s.trackerItems, itemId, extra.parentId)) return i;
      return { ...i, ...extra, values: { ...i.values, ...values }, updatedAt: Date.now() };
    }),
  }));
}

export function setItemArchived(itemId, archived) {
  updateItem(itemId, {}, { archived });
}

/** Permanent removal; children move up a level and relation links to it are cleared. */
export function deleteItem(itemId) {
  mutateState((s) => {
    const item = s.trackerItems.find((i) => i.id === itemId);
    if (!item) return s;
    const relationFieldIds = new Set(s.trackers.flatMap((t) => t.fields.filter((f) => f.type === 'relation').map((f) => f.id)));
    const trackerItems = s.trackerItems
      .filter((i) => i.id !== itemId)
      .map((i) => {
        let next = i;
        if (i.parentId === itemId) next = { ...next, parentId: item.parentId || null };
        let values = null;
        for (const fid of relationFieldIds) {
          const v = i.values?.[fid];
          if (v === itemId) (values ||= { ...i.values })[fid] = null;
          else if (Array.isArray(v) && v.includes(itemId)) (values ||= { ...i.values })[fid] = v.filter((x) => x !== itemId);
        }
        return values ? { ...next, values } : next;
      });
    const days = {};
    for (const [date, day] of Object.entries(s.days)) {
      days[date] = { ...day, activities: day.activities.map((a) => (a.link?.itemId === itemId ? { ...a, link: null } : a)) };
    }
    const notes = (s.notes || []).map((n) => (n.trackerItemIds.includes(itemId) ? { ...n, trackerItemIds: n.trackerItemIds.filter((id) => id !== itemId) } : n));
    return { ...s, trackerItems, days, notes };
  });
}

export function duplicateItem(itemId) {
  const s = getState();
  const src = s.trackerItems.find((i) => i.id === itemId);
  const tracker = src && trackerById(s, src.trackerId);
  if (!src || !tracker) return null;
  const tf = titleField(tracker);
  const values = { ...src.values };
  if (tf && tf.type !== 'formula' && typeof values[tf.id] === 'string') values[tf.id] = `${values[tf.id]} (copy)`;
  const copy = { ...newItem(tracker, {}, src.parentId), values };
  mutateState((st) => ({ ...st, trackerItems: [...st.trackerItems, copy] }));
  return copy;
}

/** Moves an item to another tracker, keeping values whose field name and type match. */
export function moveItemToTracker(itemId, toTrackerId) {
  mutateState((s) => {
    const item = s.trackerItems.find((i) => i.id === itemId);
    const from = item && trackerById(s, item.trackerId);
    const to = trackerById(s, toTrackerId);
    if (!item || !from || !to || from.id === to.id) return s;
    const moved = { ...item, trackerId: to.id, parentId: null, values: mapValuesToTracker(item, from, to), updatedAt: Date.now() };
    return {
      ...s,
      trackerItems: s.trackerItems.map((i) => (i.id === itemId ? moved : i.parentId === itemId ? { ...i, parentId: null } : i)),
      days: Object.fromEntries(Object.entries(s.days).map(([d, day]) => [d, { ...day, activities: day.activities.map((a) => (a.link?.itemId === itemId ? { ...a, link: { trackerId: to.id, itemId } } : a)) }])),
    };
  });
}

// ---------------------------------------------------------------------------
// Item -> daily-planner activity

/** Defaults for turning an item into an activity, driven by the tracker's own settings. */
export function activityDraftFromItem(state, item) {
  const tracker = trackerById(state, item.trackerId);
  const ctx = makeCtx(state.trackers, state.trackerItems);
  const cfg = tracker.settings?.activity || {};
  const durationField = tracker.fields.find((f) => f.id === cfg.durationFieldId);
  const startField = tracker.fields.find((f) => f.id === cfg.startFieldId);
  const duration = durationField ? Number(getValue(item, durationField, ctx)) : NaN;
  const startClock = startField ? getValue(item, startField, ctx) : null;
  return {
    title: itemLabel(tracker, item, ctx),
    icon: tracker.icon || '📌',
    duration: Number.isFinite(duration) && duration > 0 ? duration : 30,
    startClock: typeof startClock === 'string' && /^\d{2}:\d{2}/.test(startClock) ? startClock.slice(0, 5) : null,
    link: { trackerId: tracker.id, itemId: item.id },
    trackerName: tracker.name,
  };
}

export function createActivityFromItem(dateKey, data) {
  return addActivity(dateKey || todayKey(), data);
}

