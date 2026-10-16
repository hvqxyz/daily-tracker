// Recently scheduled activities, most recent first. Stored as small
// references: an entry points at the Activity Library definition it was
// picked from (`sourceId` = definition id) and only keeps a snapshot of its
// defaults as a fallback for one-off activities or definitions deleted since.

export const RECENT_LIMIT = 5;

const nameKey = (title, icon) => `${String(title || '').trim().toLowerCase()}|${icon || ''}`;

/** Pure: `list` with `fields` moved / added to the front, deduplicated and capped. */
export function recordRecent(list, fields, sourceId = null, usedAt = Date.now()) {
  const key = nameKey(fields.title, fields.icon);
  const entry = {
    key,
    sourceId: sourceId || null,
    title: fields.title,
    icon: fields.icon,
    categoryId: fields.categoryId,
    priority: fields.priority,
    duration: fields.duration,
    fixed: fields.fixed !== false,
    usedAt,
  };
  const rest = (list || []).filter((e) => e.key !== key && !(entry.sourceId && e.sourceId === entry.sourceId));
  return [entry, ...rest].slice(0, RECENT_LIMIT);
}

/**
 * Pure: entries resolved against the current Activity Library, so an edited
 * definition shows its current defaults. An entry whose definition is gone
 * (or that was never one) keeps its own snapshot and is never mapped to a
 * different activity. `source` is 'library' | null.
 */
export function resolveRecent(list, dictionary = []) {
  const defs = new Map(dictionary.map((it) => [it.id, it]));
  const seen = new Set();
  const out = [];
  for (const e of list || []) {
    const def = e.sourceId && defs.get(e.sourceId);
    const resolved = def
      ? { ...def, source: 'library', sourceId: def.id, key: e.key }
      : { ...e, start: null, source: null, sourceId: null };
    const dedupe = resolved.sourceId || nameKey(resolved.title, resolved.icon);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(resolved);
    if (out.length === RECENT_LIMIT) break;
  }
  return out;
}
