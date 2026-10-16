// Activity Library: the single source of truth for reusable activity
// definitions, and the templates that reference them.
//
//   definition (state.activityDictionary[]):
//     { id, title, icon, categoryId, priority, duration, fixed, start }
//     title / icon / categoryId say what the activity is; priority, duration,
//     fixed and start are only defaults for new uses.
//
//   template item (state.templates[].items[]):
//     { id, activityId, start, duration, priority, fixed, snapshot }
//     The scheduling values belong to the template; title / icon / category
//     always come from the referenced definition. `snapshot` is the last known
//     { title, icon, categoryId } and is only ever shown when the definition
//     can't be found (it is never edited on its own).
//
//   scheduled activities and recurrence rules keep their own copy of every
//   field (history must not change when a definition does) plus an optional
//   `activityId` saying which definition they came from.
//
// Everything here is pure (state in, state out) so it can be tested in node.

export const identityKey = (x) => `${String(x?.title || '').trim().toLowerCase()}|${x?.icon || ''}|${x?.categoryId || ''}`;

const snapshotOf = (x) => ({ title: x.title, icon: x.icon, categoryId: x.categoryId });

/** Map of definition id -> definition. */
export function libraryById(dictionary = []) {
  return new Map(dictionary.map((d) => [d.id, d]));
}

/**
 * The values a template item stands for right now: the definition's identity
 * with the template's own scheduling. `missing` is set when the definition is
 * gone and only the snapshot is left to show.
 */
export function resolveTemplateItem(item, byId) {
  const def = item.activityId ? byId.get(item.activityId) : null;
  const ident = def || item.snapshot || (item.title ? item : null); // `item` itself only for legacy (unmigrated) rows
  return {
    id: item.id,
    activityId: def ? def.id : item.activityId || null,
    title: ident?.title || 'Missing activity',
    icon: ident?.icon || '❔',
    categoryId: ident?.categoryId ?? null,
    start: item.start ?? null,
    duration: item.duration ?? def?.duration ?? 30,
    priority: item.priority || def?.priority || 'required',
    fixed: item.fixed ?? def?.fixed ?? true,
    missing: !def,
    unresolvable: !ident, // neither the definition nor any snapshot is left
  };
}

export function resolveTemplateItems(template, dictionary) {
  const byId = libraryById(dictionary);
  return template.items.map((it) => resolveTemplateItem(it, byId));
}

/** A new template item for a definition, scheduled after the template's last timed item. */
export function templateItemFor(def, items = [], id) {
  const lastEnd = items.reduce((end, it) => (it.start != null ? Math.max(end, it.start + (it.duration || 0)) : end), -1);
  return {
    id,
    activityId: def.id,
    start: def.start ?? (lastEnd >= 0 ? Math.min(lastEnd, 24 * 60 - 5) : null),
    duration: def.duration ?? 30,
    priority: def.priority || 'required',
    fixed: def.fixed !== false,
    snapshot: snapshotOf(def),
  };
}

/** Moves the item at `index` by `delta` positions (clamped); a new array. */
export function moveItem(items, index, delta) {
  const to = Math.max(0, Math.min(items.length - 1, index + delta));
  if (to === index) return items;
  const next = [...items];
  const [it] = next.splice(index, 1);
  next.splice(to, 0, it);
  return next;
}

/** Scheduled-activity fields for one resolved template item (null when it can't be resolved). */
export function activityFieldsFromTemplateItem(resolved) {
  if (resolved.unresolvable) return null;
  return {
    title: resolved.title,
    icon: resolved.icon,
    categoryId: resolved.categoryId,
    priority: resolved.priority,
    start: resolved.start,
    duration: resolved.duration,
    fixed: resolved.fixed !== false,
    activityId: resolved.missing ? null : resolved.activityId,
  };
}

/** Everything that points at a definition, for the delete confirmation. */
export function libraryReferences(state, activityId) {
  const templates = (state.templates || [])
    .map((t) => ({ id: t.id, name: t.name, icon: t.icon, count: t.items.filter((it) => it.activityId === activityId).length }))
    .filter((t) => t.count > 0);
  let scheduled = 0;
  for (const day of Object.values(state.days || {})) scheduled += day.activities.filter((a) => a.activityId === activityId).length;
  const recurrences = (state.recurrences || []).filter((r) => r.activityId === activityId).length;
  return { templates, scheduled, recurrences };
}

/**
 * Deletes a definition and removes it from every template. Scheduled
 * activities and rules keep their own copy (and their now historical
 * `activityId`); recent entries fall back to their snapshot.
 */
export function deleteDefinition(state, activityId) {
  return {
    ...state,
    activityDictionary: state.activityDictionary.filter((d) => d.id !== activityId),
    templates: state.templates.map((t) => (t.items.some((it) => it.activityId === activityId)
      ? { ...t, items: t.items.filter((it) => it.activityId !== activityId) }
      : t)),
  };
}

/** Applies a definition edit and refreshes the fallback snapshot of the template items using it. */
export function updateDefinition(state, activityId, patch) {
  let def = null;
  const activityDictionary = state.activityDictionary.map((d) => {
    if (d.id !== activityId) return d;
    def = { ...d, ...patch, id: d.id };
    return def;
  });
  if (!def) return state;
  const snap = snapshotOf(def);
  const templates = state.templates.map((t) => (t.items.some((it) => it.activityId === activityId)
    ? { ...t, items: t.items.map((it) => (it.activityId === activityId ? { ...it, snapshot: snap } : it)) }
    : t));
  return { ...state, activityDictionary, templates };
}

// ---------------------------------------------------------------------------
// Migration: embedded template items -> references to library definitions.
//
// Rules (see docs in the PR / final notes):
//  - An item is already migrated when its activityId resolves; it is left alone.
//  - Otherwise its identity (trimmed, case-insensitive title + icon + category,
//    taken from the item itself or its snapshot) is matched against the library:
//      exactly one definition with that identity -> reference it;
//      none -> template-only: one new definition per identity, shared by all
//              such items, id derived from the lowest item id (deterministic,
//              so two devices migrating the same data agree);
//      several -> ambiguous: never pick one; a new definition is created and
//              the case is reported.
//  - Template scheduling (start, duration, priority, fixed) always stays on the
//    item, so no per-template difference is lost; matched definitions' defaults
//    are never changed.
//  - Recent entries pointing at a template item now point at its definition.

const mode = (values) => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = values[0];
  for (const v of values) if (counts.get(v) > counts.get(best)) best = v;
  return best;
};

function legacyIdentity(item) {
  if (item.title) return snapshotOf(item);
  if (item.snapshot?.title) return item.snapshot;
  return null;
}

export function migrateLibraryRefs(state) {
  const dictionary = state.activityDictionary || [];
  const templates = state.templates || [];
  const byId = libraryById(dictionary);
  const report = { created: [], ambiguous: [], unresolved: [] };

  const pending = []; // { t, i, item, ident, key }
  for (const t of templates) {
    t.items.forEach((item, i) => {
      if (item.activityId && byId.has(item.activityId)) return;
      const ident = legacyIdentity(item);
      if (!ident) {
        report.unresolved.push({ templateId: t.id, templateName: t.name, itemId: item.id });
        return;
      }
      pending.push({ t, i, item, ident, key: identityKey(ident) });
    });
  }

  const recentChanges = remapRecents(state.recentActivities, templates);
  if (pending.length === 0) {
    if (!recentChanges) return { state, report, changed: false };
    return { state: { ...state, recentActivities: recentChanges }, report, changed: true };
  }

  const candidatesByKey = new Map();
  for (const d of dictionary) {
    const k = identityKey(d);
    candidatesByKey.set(k, [...(candidatesByKey.get(k) || []), d.id]);
  }

  const assigned = new Map(); // item id -> definition id
  const newDefs = [];
  const groups = new Map(); // key -> pending entries without a single match
  for (const p of pending) {
    const candidates = candidatesByKey.get(p.key) || [];
    if (candidates.length === 1) assigned.set(p.item.id, candidates[0]);
    else groups.set(p.key, [...(groups.get(p.key) || []), p]);
  }

  const taken = new Set(dictionary.map((d) => d.id));
  for (const [key, entries] of groups) {
    const minId = entries.map((e) => String(e.item.id)).sort()[0];
    let id = `ad_t_${minId}`;
    for (let n = 2; taken.has(id); n++) id = `ad_t_${minId}_${n}`;
    taken.add(id);
    const ident = entries[0].ident;
    const def = {
      id,
      title: String(ident.title).trim(),
      icon: ident.icon || '📌',
      categoryId: ident.categoryId,
      priority: mode(entries.map((e) => e.item.priority || 'required')),
      duration: mode(entries.map((e) => Number(e.item.duration) || 30)),
      fixed: mode(entries.map((e) => e.item.fixed !== false)),
      start: null, // a template's time is a slot in that day plan, not a property of the activity
    };
    newDefs.push(def);
    for (const e of entries) assigned.set(e.item.id, id);
    const templateNames = [...new Set(entries.map((e) => e.t.name))];
    report.created.push({ id, title: def.title, icon: def.icon, templates: templateNames });
    const candidates = candidatesByKey.get(key) || [];
    if (candidates.length > 1) report.ambiguous.push({ title: def.title, icon: def.icon, candidates, createdId: id });
  }

  const allDefs = libraryById([...dictionary, ...newDefs]);
  const nextTemplates = templates.map((t) => {
    if (!t.items.some((it) => assigned.has(it.id))) return t;
    return {
      ...t,
      items: t.items.map((item) => {
        const activityId = assigned.get(item.id);
        if (!activityId) return item;
        const def = allDefs.get(activityId);
        return {
          id: item.id,
          activityId,
          start: item.start ?? null,
          duration: Number(item.duration) || def.duration || 30,
          priority: item.priority || def.priority || 'required',
          fixed: item.fixed !== false,
          snapshot: snapshotOf(def),
        };
      }),
    };
  });

  const next = { ...state, activityDictionary: [...dictionary, ...newDefs], templates: nextTemplates };
  next.recentActivities = remapRecents(state.recentActivities, nextTemplates) || state.recentActivities;
  return { state: next, report, changed: true };
}

/** Recent entries whose sourceId is a template item id now point at that item's definition. */
function remapRecents(list, templates) {
  if (!list?.length) return null;
  const itemToDef = new Map();
  for (const t of templates) for (const it of t.items) itemToDef.set(it.id, it.activityId || null);
  let changed = false;
  const out = list.map((e) => {
    if (!e.sourceId || !itemToDef.has(e.sourceId)) return e;
    const activityId = itemToDef.get(e.sourceId);
    if (!activityId) return e; // not migrated yet; resolved on a later pass
    changed = true;
    return { ...e, sourceId: activityId };
  });
  return changed ? out : null;
}

/** True when a report has anything worth telling the user. */
export function reportHasNews(report) {
  return Boolean(report && (report.created.length || report.ambiguous.length || report.unresolved.length));
}
