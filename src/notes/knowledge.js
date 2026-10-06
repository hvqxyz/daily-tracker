// Derived views over the notes: hierarchy, backlinks, search, home sections.
// All pure functions of state so they are easy to test.

import { blocksToText } from './markdown.js';
import { inlineNoteIds, inlineToText } from './inline.js';

export function makeNoteIndex(notes) {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const children = new Map();
  const backlinks = new Map();
  const outlinks = new Map();

  const link = (from, to) => {
    if (!to || to === from || !byId.has(to)) return;
    if (!outlinks.has(from)) outlinks.set(from, new Set());
    outlinks.get(from).add(to);
    if (!backlinks.has(to)) backlinks.set(to, new Set());
    backlinks.get(to).add(from);
  };

  for (const note of notes) {
    if (note.parentId && byId.has(note.parentId)) {
      if (!children.has(note.parentId)) children.set(note.parentId, []);
      children.get(note.parentId).push(note);
    }
    for (const r of note.relations || []) link(note.id, r.targetId);
    for (const b of note.blocks) for (const id of inlineNoteIds(b.content)) link(note.id, id);
  }
  return {
    byId,
    childrenOf: (id) => (children.get(id) || []).filter((n) => !n.archived),
    backlinksOf: (id) => [...(backlinks.get(id) || [])].map((x) => byId.get(x)).filter((n) => n && !n.archived),
    outlinksOf: (id) => [...(outlinks.get(id) || [])].map((x) => byId.get(x)).filter((n) => n && !n.archived),
    ancestors(note) {
      const chain = [];
      let cur = note.parentId ? byId.get(note.parentId) : null;
      let guard = 0;
      while (cur && guard < 50) { chain.unshift(cur); cur = cur.parentId ? byId.get(cur.parentId) : null; guard += 1; }
      return chain;
    },
  };
}

export function wouldCycle(notes, noteId, parentId) {
  const byId = new Map(notes.map((n) => [n.id, n]));
  let cur = parentId;
  let guard = 0;
  while (cur && guard < 1000) {
    if (cur === noteId) return true;
    cur = byId.get(cur)?.parentId;
    guard += 1;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Search

const textCache = new WeakMap();

function noteTexts(note) {
  let t = textCache.get(note);
  if (!t) {
    const body = blocksToText(note.blocks);
    t = { title: note.title || '', body, titleLower: (note.title || '').toLowerCase(), bodyLower: body.toLowerCase() };
    textCache.set(note, t);
  }
  return t;
}

export const tokenize = (query) => query.toLowerCase().split(/\s+/).map((s) => s.trim()).filter(Boolean);

/** Splits text into [{ text, hit }] so the UI can highlight matches. */
export function highlightSegments(text, terms) {
  if (!text || terms.length === 0) return [{ text: text || '', hit: false }];
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(re).filter((s) => s !== '').map((s) => ({ text: s, hit: terms.includes(s.toLowerCase()) }));
}

export function snippetFor(body, terms, radius = 60) {
  if (!body) return '';
  const lower = body.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return body.slice(0, radius * 2).replace(/\s+/g, ' ');
  const start = Math.max(0, at - radius);
  const end = Math.min(body.length, at + radius * 1.5);
  return `${start > 0 ? '…' : ''}${body.slice(start, end).replace(/\s+/g, ' ')}${end < body.length ? '…' : ''}`;
}

/**
 * Filters and ranks notes. Every term must match somewhere (title, body, tag,
 * collection or a related tracker item's label).
 */
export function searchNotes(state, { query = '', collectionId = null, statusId = null, tagId = null, archived = false, itemLabel = () => '' } = {}) {
  const terms = tokenize(query);
  const tagName = new Map((state.noteTags || []).map((t) => [t.id, t.name.toLowerCase()]));
  const collName = new Map((state.noteCollections || []).map((c) => [c.id, c.name.toLowerCase()]));
  const results = [];

  for (const note of state.notes) {
    if (Boolean(note.archived) !== archived) continue;
    if (collectionId && !note.collectionIds.includes(collectionId)) continue;
    if (statusId && note.statusId !== statusId) continue;
    if (tagId && !note.tagIds.includes(tagId)) continue;

    if (terms.length === 0) { results.push({ note, score: 0, terms }); continue; }

    const t = noteTexts(note);
    const tags = note.tagIds.map((id) => tagName.get(id) || '').join(' ');
    const colls = note.collectionIds.map((id) => collName.get(id) || '').join(' ');
    const items = (note.trackerItemIds || []).map((id) => (itemLabel(id) || '').toLowerCase()).join(' ');
    let score = 0;
    let ok = true;
    for (const term of terms) {
      let s = 0;
      if (t.titleLower.includes(term)) s += t.titleLower.startsWith(term) ? 60 : 40;
      if (tags.includes(term)) s += 25;
      if (colls.includes(term)) s += 15;
      if (items.includes(term)) s += 12;
      if (t.bodyLower.includes(term)) s += 6;
      if (s === 0) { ok = false; break; }
      score += s;
    }
    if (!ok) continue;
    if (terms.length > 1 && t.titleLower.includes(terms.join(' '))) score += 50;
    results.push({ note, score, terms });
  }

  results.sort((a, b) => b.score - a.score || (b.note.updatedAt || 0) - (a.note.updatedAt || 0));
  return results.map((r) => ({ ...r, snippet: r.terms.length ? snippetFor(noteTexts(r.note).body, r.terms) : '' }));
}

// ---------------------------------------------------------------------------
// Home / lists

export const activeNotes = (notes) => notes.filter((n) => !n.archived);

export function recentNotes(notes, limit = 8) {
  return activeNotes(notes)
    .filter((n) => n.title.trim() || noteTexts(n).body.trim())
    .sort((a, b) => Math.max(b.openedAt || 0, b.updatedAt || 0) - Math.max(a.openedAt || 0, a.updatedAt || 0))
    .slice(0, limit);
}

export function notesNeedingReview(state) {
  const reviewIds = new Set((state.noteConfig?.statuses || []).filter((s) => s.review).map((s) => s.id));
  return activeNotes(state.notes).filter((n) => reviewIds.has(n.statusId)).sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
}

export function collectionCounts(state) {
  const counts = new Map();
  for (const n of activeNotes(state.notes)) for (const id of n.collectionIds) counts.set(id, (counts.get(id) || 0) + 1);
  return counts;
}

export function tagCounts(state) {
  const counts = new Map();
  for (const n of activeNotes(state.notes)) for (const id of n.tagIds) counts.set(id, (counts.get(id) || 0) + 1);
  return counts;
}

export function noteTitle(note) {
  return note.title.trim() || firstLine(note) || 'Untitled note';
}

function firstLine(note) {
  const b = note.blocks.find((x) => x.content && x.type !== 'code');
  return b ? inlineToText(b.content).slice(0, 60) : '';
}

/** Indented tree order for a list of notes (children under their parents). */
export function treeOrder(notes) {
  const ids = new Set(notes.map((n) => n.id));
  const kids = new Map();
  const roots = [];
  for (const n of notes) {
    if (n.parentId && ids.has(n.parentId)) {
      if (!kids.has(n.parentId)) kids.set(n.parentId, []);
      kids.get(n.parentId).push(n);
    } else roots.push(n);
  }
  const byTitle = (a, b) => noteTitle(a).localeCompare(noteTitle(b), undefined, { numeric: true });
  const out = [];
  const walk = (list, depth) => {
    for (const n of [...list].sort(byTitle)) {
      out.push({ note: n, depth });
      walk(kids.get(n.id) || [], depth + 1);
    }
  };
  walk(roots, 0);
  return out;
}
