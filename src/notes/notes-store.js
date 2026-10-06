// Actions for the knowledge base. Notes live in the shared app state
// (state.notes / noteCollections / noteTags / noteConfig / noteTemplates).

import { getState, mutateState, addActivity } from '../common/store.js';
import { newId } from '../trackers/engine/ids.js';
import { cloneBlocks, isBlankNote, newBlock, newNote } from './model.js';
import { parseMarkdown } from './markdown.js';
import { wouldCycle } from './knowledge.js';
import { buildSampleNotes } from './samples.js';

const MAX_VERSIONS = 12;
const VERSION_GAP_MS = 10 * 60 * 1000;

const mapNote = (state, id, fn) => ({ ...state, notes: state.notes.map((n) => (n.id === id ? fn(n) : n)) });
export const noteById = (state, id) => state.notes.find((n) => n.id === id);

// ---------------------------------------------------------------------------
// Notes

/** Creates a note immediately — nothing to configure first. */
export function createNote(fields = {}) {
  const state = getState();
  const note = newNote({ statusId: state.noteConfig?.statuses?.[0]?.id ?? null, ...fields });
  mutateState((s) => ({ ...s, notes: [note, ...s.notes] }));
  return note;
}

export function createNoteFromTemplate(templateId, fields = {}) {
  const tpl = getState().noteTemplates.find((t) => t.id === templateId);
  return createNote({ ...fields, title: fields.title ?? '', icon: fields.icon ?? '', blocks: tpl ? cloneBlocks(tpl.blocks) : [newBlock('p')] });
}

/** Creates a note from plain markdown-ish text (quick capture). */
export function createNoteFromText({ title = '', text = '', ...fields }) {
  const blocks = parseMarkdown(text);
  return createNote({ ...fields, title: title.trim(), blocks: blocks.length ? blocks : [newBlock('p')] });
}

const sameBlocks = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Saves editor content; keeps a periodic snapshot of the previous content as history. */
export function updateNoteContent(id, { title, blocks }) {
  mutateState((s) => mapNote(s, id, (n) => {
    if (n.title === title && sameBlocks(n.blocks, blocks)) return n;
    let versions = n.versions || [];
    const last = versions[versions.length - 1];
    if (!isBlankNote(n) && (!last || Date.now() - last.at > VERSION_GAP_MS)) {
      versions = [...versions, { id: newId('ver'), at: Date.now(), title: n.title, blocks: n.blocks }].slice(-MAX_VERSIONS);
    }
    return { ...n, title, blocks, versions, updatedAt: Date.now() };
  }));
}

/** Metadata changes (status, collections, tags, parent, links…). Content goes through updateNoteContent. */
export function patchNote(id, patch) {
  mutateState((s) => {
    const note = noteById(s, id);
    if (!note) return s;
    const next = { ...patch };
    if ('parentId' in next && next.parentId && wouldCycle(s.notes, id, next.parentId)) delete next.parentId;
    return mapNote(s, id, (n) => ({ ...n, ...next, updatedAt: 'archived' in next || 'favorite' in next || 'openedAt' in next ? n.updatedAt : Date.now() }));
  });
}

export function touchNote(id) {
  const note = noteById(getState(), id);
  if (note && Date.now() - (note.openedAt || 0) > 30_000) patchNote(id, { openedAt: Date.now() });
}

/** Replaces the content from outside the editor (restore/append) — bumps rev so an open editor reloads. */
function replaceContent(s, id, fn) {
  return mapNote(s, id, (n) => {
    const { title, blocks } = fn(n);
    return { ...n, title, blocks, rev: (n.rev || 0) + 1, updatedAt: Date.now() };
  });
}

export function appendBlocks(id, blocks) {
  mutateState((s) => replaceContent(s, id, (n) => {
    const cleaned = n.blocks.length === 1 && !n.blocks[0].content && n.blocks[0].type === 'p' ? [] : n.blocks;
    return { title: n.title, blocks: [...cleaned, ...blocks] };
  }));
}

/** "What did I learn?" — appends a small dated section to a note. */
export function appendLearning(id, text) {
  const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const body = parseMarkdown(text);
  if (body.length === 0) return;
  appendBlocks(id, [newBlock('h3', `Learned · ${date}`), ...body]);
}

export function restoreVersion(id, versionId) {
  mutateState((s) => {
    const note = noteById(s, id);
    const v = note?.versions?.find((x) => x.id === versionId);
    if (!note || !v) return s;
    const snapshot = { id: newId('ver'), at: Date.now(), title: note.title, blocks: note.blocks };
    const withSnapshot = mapNote(s, id, (n) => ({ ...n, versions: [...(n.versions || []), snapshot].slice(-MAX_VERSIONS) }));
    return replaceContent(withSnapshot, id, () => ({ title: v.title, blocks: cloneBlocks(v.blocks) }));
  });
}

export function deleteNote(id) {
  mutateState((s) => {
    const note = noteById(s, id);
    if (!note) return s;
    const days = {};
    for (const [date, day] of Object.entries(s.days)) {
      days[date] = { ...day, activities: day.activities.map((a) => (a.noteId === id ? { ...a, noteId: null } : a)) };
    }
    return {
      ...s,
      days,
      notes: s.notes
        .filter((n) => n.id !== id)
        .map((n) => ({
          ...n,
          parentId: n.parentId === id ? note.parentId || null : n.parentId,
          relations: (n.relations || []).filter((r) => r.targetId !== id),
        })),
    };
  });
}

/** Deletes an untouched note (used when a just-created note is left empty). */
export function discardIfBlank(id) {
  const note = noteById(getState(), id);
  if (note && isBlankNote(note) && !note.tagIds.length && !note.collectionIds.length && !note.trackerItemIds.length && !note.relations.length) deleteNote(id);
}

export function toggleFavorite(id) {
  const n = noteById(getState(), id);
  if (n) patchNote(id, { favorite: !n.favorite });
}

export function setArchived(id, archived) {
  patchNote(id, { archived });
}

export function addRelation(id, targetId) {
  const n = noteById(getState(), id);
  if (!n || id === targetId || (n.relations || []).some((r) => r.targetId === targetId)) return;
  patchNote(id, { relations: [...(n.relations || []), { targetId, type: 'related' }] });
}

export function removeRelation(id, targetId) {
  const n = noteById(getState(), id);
  if (n) patchNote(id, { relations: (n.relations || []).filter((r) => r.targetId !== targetId) });
}

export function linkTrackerItem(id, itemId) {
  const n = noteById(getState(), id);
  if (n && !n.trackerItemIds.includes(itemId)) patchNote(id, { trackerItemIds: [...n.trackerItemIds, itemId] });
}

export function unlinkTrackerItem(id, itemId) {
  const n = noteById(getState(), id);
  if (n) patchNote(id, { trackerItemIds: n.trackerItemIds.filter((x) => x !== itemId) });
}

// ---------------------------------------------------------------------------
// Collections

export function addCollection({ name, icon = '📁' }) {
  const collection = { id: newId('nc'), name: name.trim(), icon };
  mutateState((s) => ({ ...s, noteCollections: [...s.noteCollections, collection] }));
  return collection;
}

export function updateCollection(id, patch) {
  mutateState((s) => ({ ...s, noteCollections: s.noteCollections.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
}

export function deleteCollection(id) {
  mutateState((s) => ({
    ...s,
    noteCollections: s.noteCollections.filter((c) => c.id !== id),
    notes: s.notes.map((n) => (n.collectionIds.includes(id) ? { ...n, collectionIds: n.collectionIds.filter((c) => c !== id) } : n)),
  }));
}

export function moveCollection(id, delta) {
  mutateState((s) => {
    const list = [...s.noteCollections];
    const i = list.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= list.length) return s;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...s, noteCollections: list };
  });
}

/** Moves a note into exactly one collection (or none). */
export function moveNoteToCollection(noteId, collectionId) {
  patchNote(noteId, { collectionIds: collectionId ? [collectionId] : [] });
}

// ---------------------------------------------------------------------------
// Tags

const cleanTag = (name) => name.trim().replace(/^#+/, '').trim();

export function getOrCreateTag(name) {
  const clean = cleanTag(name);
  if (!clean) return null;
  const existing = getState().noteTags.find((t) => t.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  const tag = { id: newId('nt'), name: clean };
  mutateState((s) => ({ ...s, noteTags: [...s.noteTags, tag] }));
  return tag;
}

/** Renames a tag; renaming onto an existing tag merges the two. */
export function renameTag(id, name) {
  const clean = cleanTag(name);
  if (!clean) return;
  mutateState((s) => {
    const clash = s.noteTags.find((t) => t.id !== id && t.name.toLowerCase() === clean.toLowerCase());
    if (!clash) return { ...s, noteTags: s.noteTags.map((t) => (t.id === id ? { ...t, name: clean } : t)) };
    return {
      ...s,
      noteTags: s.noteTags.filter((t) => t.id !== id),
      notes: s.notes.map((n) => (n.tagIds.includes(id) ? { ...n, tagIds: [...new Set(n.tagIds.map((t) => (t === id ? clash.id : t)))] } : n)),
    };
  });
}

export function deleteTag(id) {
  mutateState((s) => ({
    ...s,
    noteTags: s.noteTags.filter((t) => t.id !== id),
    notes: s.notes.map((n) => (n.tagIds.includes(id) ? { ...n, tagIds: n.tagIds.filter((t) => t !== id) } : n)),
  }));
}

// ---------------------------------------------------------------------------
// Statuses and templates

export function setStatuses(statuses) {
  mutateState((s) => {
    const ids = new Set(statuses.map((x) => x.id));
    return {
      ...s,
      noteConfig: { ...s.noteConfig, statuses },
      notes: s.notes.map((n) => (n.statusId && !ids.has(n.statusId) ? { ...n, statusId: null } : n)),
    };
  });
}

export function addNoteTemplate(template) {
  const t = { id: newId('ntpl'), name: 'New template', icon: '🧩', blocks: [newBlock('h1', 'Heading'), newBlock('p')], ...template };
  mutateState((s) => ({ ...s, noteTemplates: [...s.noteTemplates, t] }));
  return t;
}

export function updateNoteTemplate(id, patch) {
  mutateState((s) => ({ ...s, noteTemplates: s.noteTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
}

export function deleteNoteTemplate(id) {
  mutateState((s) => ({ ...s, noteTemplates: s.noteTemplates.filter((t) => t.id !== id) }));
}

export function saveNoteAsTemplate(noteId) {
  const n = noteById(getState(), noteId);
  if (!n) return null;
  return addNoteTemplate({ name: n.title.trim() || 'Untitled template', icon: n.icon || '🧩', blocks: cloneBlocks(n.blocks) });
}

// ---------------------------------------------------------------------------
// Examples + planner

export function addSampleNotes() {
  mutateState((s) => {
    const built = buildSampleNotes({ trackers: s.trackers, trackerItems: s.trackerItems, existing: { collections: s.noteCollections, tags: s.noteTags } });
    return { ...s, notes: [...built.notes, ...s.notes], noteCollections: built.collections, noteTags: built.tags };
  });
}

/** Plans a study/work activity for a note; the activity keeps a reference to it. */
export function createActivityForNote(dateKey, note, extra = {}) {
  return addActivity(dateKey, { title: note.title.trim() || 'Untitled note', icon: note.icon || '📝', noteId: note.id, ...extra });
}

/** One-tap "study this note today": a flexible, unscheduled activity linked to the note. */
export function planNoteToday(note, todayKey) {
  const cats = getState().categories;
  const categoryId = (cats.find((c) => c.id === 'mind') || cats[0])?.id;
  return createActivityForNote(todayKey, note, { categoryId, priority: 'should', duration: 30, start: null, fixed: false });
}
