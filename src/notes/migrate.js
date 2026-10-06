import { DEFAULT_STATUSES, buildDefaultTemplates } from './model.js';

/** Makes sure every knowledge collection exists on a saved snapshot (older ones predate notes). */
export function ensureNotesState(state) {
  let changed = false;
  const next = { ...state };
  if (!Array.isArray(next.notes)) { next.notes = []; changed = true; }
  if (!Array.isArray(next.noteCollections)) { next.noteCollections = []; changed = true; }
  if (!Array.isArray(next.noteTags)) { next.noteTags = []; changed = true; }
  if (!next.noteConfig?.statuses) { next.noteConfig = { ...(next.noteConfig || {}), statuses: DEFAULT_STATUSES.map((s) => ({ ...s })) }; changed = true; }
  if (!Array.isArray(next.noteTemplates)) { next.noteTemplates = buildDefaultTemplates(); changed = true; }
  return changed ? next : state;
}
