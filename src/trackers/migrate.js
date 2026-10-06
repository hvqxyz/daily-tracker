// One-time upgrade of saved state from the old hard-coded books/movies lists
// to generic trackers. New installs never hit this path; it only runs when a
// saved snapshot still contains `books` / `movies` arrays.

import { TRACKER_TEMPLATES, instantiateTemplate } from './templates.js';
import { options } from './engine/fieldTypes.js';


function buildFromLegacy(templateKey, legacyItems, categories, mapping) {
  const bp = TRACKER_TEMPLATES.find((t) => t.key === templateKey);
  const { tracker } = instantiateTemplate(bp);
  const field = (name) => tracker.fields.find((f) => f.name === name);

  // The category field mirrors the user's existing life categories so old values keep meaning.
  const categoryField = field('Category');
  const optionByCategoryId = new Map();
  if (categoryField) {
    categoryField.config.options = categories.map((c, i) => ({
      id: `opt_legacy_${c.id}_${i}`,
      label: c.name,
      icon: c.icon || '',
      color: c.color || '#898781',
      done: false,
    }));
    for (const [i, c] of categories.entries()) optionByCategoryId.set(c.id, `opt_legacy_${c.id}_${i}`);
  }
  const statusField = field('Status');
  const statusId = (legacy) => options(statusField).find((o) => o.label.toLowerCase() === String(legacy).toLowerCase())?.id ?? null;

  const items = legacyItems.map((legacy) => {
    const values = {};
    for (const [name, get] of Object.entries(mapping)) {
      const f = field(name);
      if (!f) continue;
      let v = get(legacy);
      if (name === 'Status') v = statusId(v);
      if (name === 'Category') v = optionByCategoryId.get(v) ?? null;
      if (v !== null && v !== undefined && v !== '') values[f.id] = v;
    }
    return {
      id: legacy.id,
      trackerId: tracker.id,
      parentId: null,
      archived: false,
      createdAt: legacy.createdAt || Date.now(),
      updatedAt: legacy.createdAt || Date.now(),
      values,
    };
  });
  return { tracker, items };
}

export function migrateState(state) {
  let next = { ...state };
  if (!Array.isArray(next.trackers)) next.trackers = [];
  if (!Array.isArray(next.trackerItems)) next.trackerItems = [];
  if (!Array.isArray(next.trackerTemplates)) next.trackerTemplates = [];

  const hasLegacy = Array.isArray(next.books) || Array.isArray(next.movies);
  if (!hasLegacy) return next;

  const links = new Map(); // legacy id -> tracker id
  const categories = next.categories || [];

  if (next.books?.length) {
    const built = buildFromLegacy('books', next.books, categories, {
      Title: (b) => b.title,
      Author: (b) => b.author,
      Status: (b) => b.status,
      Category: (b) => b.categoryId,
      Rating: (b) => b.rating,
      Started: (b) => b.started,
      Finished: (b) => b.finished,
      Pages: (b) => b.pages,
      'Pages read': (b) => b.pagesRead,
      Notes: (b) => b.notes,
    });
    next.trackers = [...next.trackers, built.tracker];
    next.trackerItems = [...next.trackerItems, ...built.items];
    next.books.forEach((b) => links.set(b.id, built.tracker.id));
  }

  if (next.movies?.length) {
    const built = buildFromLegacy('movies', next.movies, categories, {
      Title: (m) => m.title,
      Director: (m) => m.director,
      Status: (m) => m.status,
      Category: (m) => m.categoryId,
      Year: (m) => m.year,
      Runtime: (m) => m.runtime,
      Watched: (m) => m.watched,
      Rating: (m) => m.rating,
      Notes: (m) => m.notes,
    });
    next.trackers = [...next.trackers, built.tracker];
    next.trackerItems = [...next.trackerItems, ...built.items];
    next.movies.forEach((m) => links.set(m.id, built.tracker.id));
  }

  if (links.size > 0 && next.days) {
    const days = {};
    for (const [date, day] of Object.entries(next.days)) {
      days[date] = {
        ...day,
        activities: day.activities.map((a) => {
          const legacyId = a.bookId || a.movieId;
          if (!legacyId || !links.has(legacyId)) return a;
          const { bookId, movieId, ...rest } = a;
          return { ...rest, link: { trackerId: links.get(legacyId), itemId: legacyId } };
        }),
      };
    }
    next.days = days;
  }

  delete next.books;
  delete next.movies;
  delete next.bookCategories;
  return next;
}

