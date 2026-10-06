// Tracker templates are *data*: a blueprint of fields, options, views, widgets
// and (optionally) sample items. Instantiating one produces an ordinary tracker
// that is fully editable — the engine never treats a template-made tracker any
// differently from one built by hand in the UI.

import { createField, createOption, isMultiValued, options } from './engine/fieldTypes.js';
import { createView, newTracker, newWidget } from './engine/schema.js';
import { newId } from './engine/ids.js';
import { shiftDateKey, todayKey } from '../common/time.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

const LIFE = [
  { label: 'Career', icon: '💼', color: '#3682e0' },
  { label: 'Body', icon: '🏋️', color: '#d0733b' },
  { label: 'Mind', icon: '🧠', color: '#8a5fd6' },
  { label: 'Relationships', icon: '❤️', color: '#d5487a' },
  { label: 'Pleasure', icon: '🎮', color: '#199e70' },
  { label: 'Life', icon: '🏠', color: '#a08a3f' },
  { label: 'Recovery', icon: '😴', color: '#5f7ad6' },
  { label: 'Finance', icon: '💰', color: '#3f9e9e' },
];

const GREY = '#898781';
const BLUE = '#3682e0';
const GREEN = '#199e70';
const RED = '#d03b3b';

const ago = (n) => ({ daysAgo: n });
const ahead = (n) => ({ daysAhead: n });

const year = new Date().getFullYear();

export const TRACKER_TEMPLATES = [
  {
    key: 'books',
    name: 'Book tracker',
    icon: '📚',
    description: 'Books I want to read, am reading and have finished.',
    titleKey: 'title',
    fields: [
      { key: 'title', name: 'Title', type: 'text', required: true },
      { key: 'author', name: 'Author', type: 'text' },
      {
        key: 'status', name: 'Status', type: 'select', required: true, default: 'Planned',
        config: { options: [
          { label: 'Planned', icon: '📋', color: GREY },
          { label: 'Reading', icon: '📖', color: BLUE },
          { label: 'Finished', icon: '✅', color: GREEN, done: true },
          { label: 'Abandoned', icon: '⏸️', color: RED },
        ] },
      },
      { key: 'category', name: 'Category', type: 'select', config: { options: LIFE } },
      { key: 'rating', name: 'Rating', type: 'rating', config: { max: 10 } },
      { key: 'started', name: 'Started', type: 'date' },
      { key: 'finished', name: 'Finished', type: 'date' },
      { key: 'pages', name: 'Pages', type: 'number', config: { min: 0, unit: 'pages' } },
      { key: 'pagesRead', name: 'Pages read', type: 'number', config: { min: 0 } },
      { key: 'progress', name: 'Progress', type: 'formula', config: { expression: 'round(percent({Pages read}, {Pages}))', format: 'percent', precision: 0 } },
      { key: 'notes', name: 'Notes', type: 'longtext' },
    ],
    views: [
      { name: 'Library', type: 'table', columns: ['title', 'author', 'status', 'category', 'progress', 'rating'], sorts: [{ key: 'status', dir: 'asc' }] },
      { name: 'Reading now', type: 'list', columns: ['title', 'author', 'progress'], filters: [{ key: 'status', op: 'is', valueLabel: 'Reading' }] },
      { name: 'Finished', type: 'table', columns: ['title', 'author', 'rating', 'finished'], filters: [{ key: 'status', op: 'is', valueLabel: 'Finished' }], sorts: [{ key: 'finished', dir: 'desc' }] },
      { name: 'Board', type: 'board', boardBy: 'status', columns: ['author', 'category'] },
    ],
    widgets: [
      { type: 'count', title: 'Reading now', config: { filters: [{ key: 'status', op: 'is', valueLabel: 'Reading' }] } },
      { type: 'count', title: `Finished in ${year}`, config: { filters: [{ key: 'finished', op: 'onorafter', value: `${year}-01-01` }] } },
      { type: 'number', title: `Pages read`, config: { fieldKey: 'pagesRead', agg: 'sum' } },
      { type: 'completion', title: 'Completion', config: { doneKey: 'status' } },
      { type: 'distribution', title: 'By category', config: { groupKey: 'category' } },
      { type: 'recent', title: 'Recently added', config: {} },
    ],
    settings: { defaultSort: null },
    samples: [
      { values: { title: 'A Short History of Nearly Everything', author: 'Bill Bryson', status: 'Reading', category: 'Mind', started: ago(8), pages: 544, pagesRead: 174 } },
      { values: { title: 'Pułapka szczęścia', author: 'Russ Harris', status: 'Reading', category: 'Mind', started: ago(17), pages: 256, pagesRead: 166, notes: 'Working through the exercises slowly, one chapter a week.' } },
      { values: { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', status: 'Planned', category: 'Mind', pages: 443 } },
      { values: { title: 'Clean Code', author: 'Robert C. Martin', status: 'Planned', category: 'Career', pages: 464 } },
      { values: { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', status: 'Planned', category: 'Mind', pages: 499 } },
      { values: { title: 'Atomic Habits', author: 'James Clear', status: 'Finished', category: 'Mind', started: ago(265), finished: ago(250), pages: 320, pagesRead: 320, rating: 9, notes: 'Great practical framework — revisit the summary before applying it again.' } },
      { values: { title: 'The Psychology of Money', author: 'Morgan Housel', status: 'Finished', category: 'Finance', started: ago(222), finished: ago(210), pages: 256, pagesRead: 256, rating: 8 } },
      { values: { title: 'Deep Work', author: 'Cal Newport', status: 'Finished', category: 'Career', started: ago(185), finished: ago(170), pages: 304, pagesRead: 304, rating: 9 } },
      { values: { title: 'A Brief History of Time', author: 'Stephen Hawking', status: 'Finished', category: 'Mind', started: ago(150), finished: ago(120), pages: 256, pagesRead: 256, rating: 7 } },
      { values: { title: 'The Hobbit', author: 'J.R.R. Tolkien', status: 'Finished', category: 'Pleasure', started: ago(85), finished: ago(70), pages: 310, pagesRead: 310, rating: 10, notes: 'Reread for comfort — still holds up.' } },
      { values: { title: "Man's Search for Meaning", author: 'Viktor E. Frankl', status: 'Finished', category: 'Mind', started: ago(39), finished: ago(24), pages: 200, pagesRead: 200, rating: 9 } },
      { values: { title: 'The Lean Startup', author: 'Eric Ries', status: 'Finished', category: 'Career', started: ago(60), finished: ago(45), pages: 336, pagesRead: 336, rating: 8 } },
      { values: { title: 'Ulysses', author: 'James Joyce', status: 'Abandoned', category: 'Pleasure', started: ago(160), pages: 730, pagesRead: 90, notes: 'Too dense for casual reading — might retry with a reading guide.' } },
    ],
  },

  {
    key: 'movies',
    name: 'Movie / media tracker',
    icon: '🎬',
    description: 'Movies, series and documentaries to watch and rate.',
    titleKey: 'title',
    fields: [
      { key: 'title', name: 'Title', type: 'text', required: true },
      { key: 'director', name: 'Director', type: 'text' },
      {
        key: 'status', name: 'Status', type: 'select', required: true, default: 'Planned',
        config: { options: [
          { label: 'Planned', icon: '📋', color: GREY },
          { label: 'Watched', icon: '✅', color: GREEN, done: true },
          { label: 'Abandoned', icon: '⏸️', color: RED },
        ] },
      },
      { key: 'category', name: 'Category', type: 'select', config: { options: LIFE } },
      { key: 'year', name: 'Year', type: 'number', config: { min: 1888 } },
      { key: 'runtime', name: 'Runtime', type: 'duration' },
      { key: 'watched', name: 'Watched', type: 'date' },
      { key: 'rating', name: 'Rating', type: 'rating', config: { max: 10 } },
      { key: 'notes', name: 'Notes', type: 'longtext' },
    ],
    views: [
      { name: 'Library', type: 'table', columns: ['title', 'director', 'status', 'category', 'rating'], sorts: [{ key: 'status', dir: 'asc' }] },
      { name: 'Watchlist', type: 'list', columns: ['title', 'director', 'runtime'], filters: [{ key: 'status', op: 'is', valueLabel: 'Planned' }] },
      { name: 'Board', type: 'board', boardBy: 'status', columns: ['director', 'runtime'] },
      { name: 'Watched calendar', type: 'calendar', dateBy: 'watched' },
    ],
    widgets: [
      { type: 'count', title: 'Watched', config: { filters: [{ key: 'status', op: 'is', valueLabel: 'Watched' }] } },
      { type: 'count', title: 'To watch', config: { filters: [{ key: 'status', op: 'is', valueLabel: 'Planned' }] } },
      { type: 'number', title: 'Minutes watched', config: { fieldKey: 'runtime', agg: 'sum', filters: [{ key: 'status', op: 'is', valueLabel: 'Watched' }] } },
      { type: 'number', title: 'Average rating', config: { fieldKey: 'rating', agg: 'avg' } },
      { type: 'distribution', title: 'By category', config: { groupKey: 'category' } },
    ],
    samples: [
      { values: { title: 'Dune: Part Two', director: 'Denis Villeneuve', status: 'Planned', category: 'Pleasure', year: 2024, runtime: 166 } },
      { values: { title: 'Oppenheimer', director: 'Christopher Nolan', status: 'Planned', category: 'Mind', year: 2023, runtime: 180 } },
      { values: { title: 'Inception', director: 'Christopher Nolan', status: 'Watched', category: 'Pleasure', year: 2010, runtime: 148, watched: ago(12), rating: 9 } },
      { values: { title: 'The Social Network', director: 'David Fincher', status: 'Watched', category: 'Career', year: 2010, runtime: 120, watched: ago(45), rating: 8 } },
      { values: { title: 'Interstellar', director: 'Christopher Nolan', status: 'Watched', category: 'Mind', year: 2014, runtime: 169, watched: ago(90), rating: 10, notes: 'Rewatched — the docking scene still hits.' } },
      { values: { title: 'The Godfather', director: 'Francis Ford Coppola', status: 'Abandoned', category: 'Pleasure', year: 1972, runtime: 175, notes: 'Fell asleep halfway; retry on a weekend.' } },
    ],
  },

  {
    key: 'learning',
    name: 'Learning tracker (hierarchical)',
    icon: '☁️',
    description: 'Topics I want to learn, organised as a tree.',
    titleKey: 'topic',
    fields: [
      { key: 'topic', name: 'Topic', type: 'text', required: true },
      {
        key: 'status', name: 'Status', type: 'select', required: true, default: 'Planned',
        config: { options: [
          { label: 'Planned', icon: '⚪', color: GREY },
          { label: 'In Progress', icon: '🔵', color: BLUE },
          { label: 'Done', icon: '🟢', color: GREEN, done: true },
          { label: 'Abandoned', icon: '🔴', color: RED },
        ] },
      },
      {
        key: 'category', name: 'Category', type: 'select',
        config: { allowCustom: true, options: ['Cloud Run', 'Cloud SQL', 'Networking', 'Security', 'IAM', 'Observability'].map((label) => ({ label })) },
      },
      { key: 'priority', name: 'Priority', type: 'select', config: { options: [{ label: 'High', color: RED }, { label: 'Medium', color: '#c99a2e' }, { label: 'Low', color: GREEN }] } },
      { key: 'progress', name: 'Progress', type: 'progress', default: 0 },
      { key: 'resources', name: 'Resources', type: 'url' },
      { key: 'notes', name: 'Notes', type: 'longtext' },
    ],
    views: [
      { name: 'All topics', type: 'table', columns: ['topic', 'status', 'category', 'progress', 'priority'] },
      { name: 'Current learning', type: 'table', columns: ['topic', 'category', 'progress', 'priority'], filters: [{ key: 'status', op: 'is', valueLabel: 'In Progress' }], sorts: [{ key: 'priority', dir: 'asc' }] },
      { name: 'Completed', type: 'table', columns: ['topic', 'progress'], filters: [{ key: 'status', op: 'is', valueLabel: 'Done' }], groupBy: 'category' },
      { name: 'Knowledge tree', type: 'hierarchy', columns: ['status', 'progress'] },
      { name: 'Board', type: 'board', boardBy: 'status', columns: ['category', 'priority'] },
    ],
    widgets: [
      { type: 'count', title: 'Topics', config: {} },
      { type: 'completion', title: 'Completion', config: { doneKey: 'status' } },
      { type: 'progress', title: 'Average progress', config: { fieldKey: 'progress', agg: 'avg' } },
      { type: 'distribution', title: 'By status', config: { groupKey: 'status' } },
      { type: 'distribution', title: 'By category', config: { groupKey: 'category' } },
    ],
    settings: { allowHierarchy: true },
    samples: [
      { ref: 'cloud', values: { topic: 'Cloud', status: 'In Progress', progress: 30 } },
      { ref: 'run', parent: 'cloud', values: { topic: 'Cloud Run', status: 'In Progress', category: 'Cloud Run', priority: 'High', progress: 40 } },
      { parent: 'run', values: { topic: 'Revisions', status: 'Done', category: 'Cloud Run', priority: 'Medium', progress: 100 } },
      { parent: 'run', values: { topic: 'Traffic splitting', status: 'In Progress', category: 'Cloud Run', priority: 'High', progress: 55 } },
      { parent: 'run', values: { topic: 'Rollback', status: 'Planned', category: 'Cloud Run', priority: 'Medium', progress: 0 } },
      { ref: 'sql', parent: 'cloud', values: { topic: 'Cloud SQL', status: 'Planned', category: 'Cloud SQL', priority: 'Medium', progress: 0 } },
      { parent: 'sql', values: { topic: 'Connector', status: 'Planned', category: 'Cloud SQL', priority: 'Medium', progress: 0 } },
      { parent: 'sql', values: { topic: 'Hikari', status: 'Planned', category: 'Cloud SQL', priority: 'Low', progress: 0 } },
      { parent: 'cloud', values: { topic: 'Networking', status: 'Planned', category: 'Networking', priority: 'Medium', progress: 0 } },
      { parent: 'cloud', values: { topic: 'IAM', status: 'Planned', category: 'IAM', priority: 'High', progress: 0 } },
      { parent: 'cloud', values: { topic: 'Observability', status: 'Planned', category: 'Observability', priority: 'Low', progress: 0 } },
    ],
  },

  {
    key: 'projects',
    name: 'Project tracker',
    icon: '🚀',
    description: 'Projects and ideas from concept to release.',
    titleKey: 'name',
    fields: [
      { key: 'name', name: 'Name', type: 'text', required: true },
      {
        key: 'status', name: 'Status', type: 'select', required: true, default: 'Idea',
        config: { options: [
          { label: 'Idea', icon: '💡', color: GREY },
          { label: 'Building', icon: '🔨', color: BLUE },
          { label: 'Testing', icon: '🧪', color: '#c99a2e' },
          { label: 'Released', icon: '🚀', color: GREEN, done: true },
        ] },
      },
      { key: 'priority', name: 'Priority', type: 'select', config: { options: [{ label: 'High', color: RED }, { label: 'Medium', color: '#c99a2e' }, { label: 'Low', color: GREEN }] } },
      { key: 'start', name: 'Start', type: 'date' },
      { key: 'due', name: 'Due', type: 'date' },
      { key: 'progress', name: 'Progress', type: 'progress', default: 0 },
      { key: 'left', name: 'Days left', type: 'formula', config: { expression: 'if(empty({Due}), "", {Due} - today)', format: 'number' } },
      { key: 'notes', name: 'Notes', type: 'longtext' },
    ],
    views: [
      { name: 'All projects', type: 'table', columns: ['name', 'status', 'priority', 'due', 'progress'] },
      { name: 'Board', type: 'board', boardBy: 'status', columns: ['priority', 'due'] },
      { name: 'Calendar', type: 'calendar', dateBy: 'due' },
      { name: 'Timeline', type: 'timeline', startBy: 'start', endBy: 'due' },
    ],
    widgets: [
      { type: 'count', title: 'Projects', config: {} },
      { type: 'completion', title: 'Released', config: { doneKey: 'status' } },
      { type: 'upcoming', title: 'Upcoming due dates', config: { dateKey: 'due' } },
      { type: 'distribution', title: 'By status', config: { groupKey: 'status' } },
    ],
    samples: [],
  },

  {
    key: 'goals',
    name: 'Goal tracker',
    icon: '🎯',
    description: 'Goals with a target date and progress.',
    titleKey: 'goal',
    fields: [
      { key: 'goal', name: 'Goal', type: 'text', required: true },
      {
        key: 'status', name: 'Status', type: 'select', required: true, default: 'Not started',
        config: { options: [
          { label: 'Not started', icon: '⚪', color: GREY },
          { label: 'In progress', icon: '🔵', color: BLUE },
          { label: 'Achieved', icon: '🏆', color: GREEN, done: true },
          { label: 'Dropped', icon: '🔴', color: RED },
        ] },
      },
      { key: 'area', name: 'Area', type: 'select', config: { options: LIFE } },
      { key: 'target', name: 'Target date', type: 'date' },
      { key: 'progress', name: 'Progress', type: 'progress', default: 0 },
      { key: 'why', name: 'Why', type: 'longtext' },
    ],
    views: [
      { name: 'All goals', type: 'table', columns: ['goal', 'status', 'area', 'target', 'progress'] },
      { name: 'Board', type: 'board', boardBy: 'status', columns: ['area', 'target'] },
    ],
    widgets: [
      { type: 'completion', title: 'Achieved', config: { doneKey: 'status' } },
      { type: 'progress', title: 'Average progress', config: { fieldKey: 'progress', agg: 'avg' } },
      { type: 'distribution', title: 'By area', config: { groupKey: 'area' } },
    ],
    samples: [],
  },

  {
    key: 'cars',
    name: 'Car collection',
    icon: '🚗',
    description: 'A completely different schema, built with the same engine.',
    titleKey: 'model',
    fields: [
      { key: 'model', name: 'Model', type: 'text', required: true },
      { key: 'manufacturer', name: 'Manufacturer', type: 'text' },
      { key: 'year', name: 'Year', type: 'number', config: { min: 1900 } },
      { key: 'mileage', name: 'Mileage', type: 'number', config: { min: 0, unit: 'km' } },
      {
        key: 'status', name: 'Status', type: 'select', default: 'Considering',
        config: { options: [{ label: 'Considering', color: GREY }, { label: 'Owned', color: GREEN, done: true }, { label: 'Sold', color: RED }] },
      },
      { key: 'purchased', name: 'Purchase Date', type: 'date' },
      { key: 'price', name: 'Price', type: 'number', config: { min: 0 } },
      { key: 'favorite', name: 'Favorite', type: 'boolean' },
      { key: 'notes', name: 'Notes', type: 'longtext' },
    ],
    views: [
      { name: 'All cars', type: 'table', columns: ['model', 'manufacturer', 'year', 'mileage', 'status', 'price', 'favorite'] },
      { name: 'Favorites', type: 'list', columns: ['manufacturer', 'year'], filters: [{ key: 'favorite', op: 'true' }] },
      { name: 'Board', type: 'board', boardBy: 'status', columns: ['manufacturer', 'year'] },
    ],
    widgets: [
      { type: 'count', title: 'Cars', config: {} },
      { type: 'number', title: 'Total value', config: { fieldKey: 'price', agg: 'sum' } },
      { type: 'number', title: 'Average mileage', config: { fieldKey: 'mileage', agg: 'avg' } },
      { type: 'distribution', title: 'By status', config: { groupKey: 'status' } },
    ],
    samples: [
      { values: { model: 'MX-5 (NB)', manufacturer: 'Mazda', year: 2002, mileage: 168000, status: 'Owned', purchased: ago(900), price: 24000, favorite: true, notes: 'Weekend driver.' } },
      { values: { model: 'Golf GTI', manufacturer: 'Volkswagen', year: 2016, mileage: 120000, status: 'Considering', price: 42000 } },
      { values: { model: 'Civic Type R', manufacturer: 'Honda', year: 2009, mileage: 143000, status: 'Sold', purchased: ago(1800), price: 31000 } },
    ],
  },
];

// ---------------------------------------------------------------------------
// Instantiation

function resolveSampleValue(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('daysAgo' in v) return shiftDateKey(todayKey(), -v.daysAgo);
    if ('daysAhead' in v) return shiftDateKey(todayKey(), v.daysAhead);
  }
  return v;
}

function labelsToIds(field, value) {
  if (value === null || value === undefined) return value;
  const byLabel = (label) => options(field).find((o) => o.label === label)?.id;
  return Array.isArray(value) ? value.map(byLabel).filter(Boolean) : byLabel(value) ?? null;
}

/** Turns a blueprint into a fresh tracker (+ optional sample items). */
export function instantiateTemplate(bp, { withSamples = false } = {}) {
  const tracker = newTracker({ name: bp.name, icon: bp.icon, description: bp.description || '' });
  const byKey = new Map();

  for (const f of bp.fields) {
    const config = clone(f.config || {});
    if (config.options) config.options = config.options.map((o) => createOption(o.label, { icon: o.icon || '', color: o.color || GREY, done: Boolean(o.done) }));
    const field = createField(f.type, f.name, { required: Boolean(f.required), config });
    if (f.default !== undefined && f.default !== null) {
      field.default = ['select', 'multiselect'].includes(f.type) ? labelsToIds(field, f.default) : f.default;
    }
    byKey.set(f.key, field);
    tracker.fields.push(field);
  }
  const id = (key) => byKey.get(key)?.id ?? null;

  tracker.settings = {
    ...tracker.settings,
    ...(bp.settings || {}),
    titleFieldId: id(bp.titleKey) || tracker.fields[0]?.id || null,
    defaultSort: bp.settings?.defaultSort ? { fieldId: id(bp.settings.defaultSort.key), dir: bp.settings.defaultSort.dir } : null,
  };

  const filterOf = (f) => {
    const field = byKey.get(f.key);
    if (!field) return null;
    const value = f.valueLabel !== undefined ? labelsToIds(field, f.valueLabel) : f.value ?? '';
    return { id: newId('flt'), fieldId: field.id, op: f.op, value };
  };

  for (const v of bp.views || []) {
    const view = createView(tracker, v.type, v.name);
    const c = view.config;
    if (v.columns) c.columns = v.columns.map((k) => ({ fieldId: id(k), width: null })).filter((col) => col.fieldId);
    if (v.filters) c.filters = v.filters.map(filterOf).filter(Boolean);
    if (v.sorts) c.sorts = v.sorts.map((s) => ({ fieldId: id(s.key), dir: s.dir })).filter((s) => s.fieldId);
    if (v.groupBy) c.groupBy = id(v.groupBy);
    if (v.boardBy) c.boardFieldId = id(v.boardBy);
    if (v.dateBy) c.dateFieldId = id(v.dateBy);
    if (v.startBy) c.startFieldId = id(v.startBy);
    if (v.endBy) c.endFieldId = id(v.endBy);
    tracker.views.push(view);
  }
  if (tracker.views.length === 0) tracker.views.push(createView(tracker, 'table', 'All items'));
  tracker.settings.defaultViewId = tracker.views[0].id;

  for (const w of bp.widgets || []) {
    const cfg = w.config || {};
    tracker.widgets.push(newWidget(w.type, w.title, {
      filters: (cfg.filters || []).map(filterOf).filter(Boolean),
      fieldId: id(cfg.fieldKey),
      groupFieldId: id(cfg.groupKey),
      doneFieldId: id(cfg.doneKey),
      dateFieldId: id(cfg.dateKey),
      agg: cfg.agg || 'count',
      limit: cfg.limit || 5,
    }));
  }

  const items = [];
  if (withSamples) {
    const refs = new Map();
    const start = Date.now();
    (bp.samples || []).forEach((s, index) => {
      const values = {};
      for (const [key, raw] of Object.entries(s.values)) {
        const field = byKey.get(key);
        if (!field) continue;
        const v = resolveSampleValue(raw);
        values[field.id] = ['select', 'multiselect'].includes(field.type) ? labelsToIds(field, v) : v;
      }
      const item = {
        id: newId('itm'),
        trackerId: tracker.id,
        parentId: s.parent ? refs.get(s.parent) ?? null : null,
        archived: false,
        createdAt: start + index,
        updatedAt: start + index,
        values,
      };
      if (s.ref) refs.set(s.ref, item.id);
      items.push(item);
    });
    if (items.some((i) => i.parentId)) tracker.settings.allowHierarchy = true;
  }
  return { tracker, items };
}

/** Converts a live tracker (schema only) into a reusable blueprint. */
export function blueprintFromTracker(tracker) {
  const keyOf = new Map(tracker.fields.map((f) => [f.id, f.id]));
  const labelOf = (fieldId, optionId) => options(tracker.fields.find((f) => f.id === fieldId) || { config: {} }).find((o) => o.id === optionId)?.label;
  const filterOut = (f) => {
    const field = tracker.fields.find((x) => x.id === f.fieldId);
    if (!field) return null;
    if (['select', 'multiselect'].includes(field.type)) return { key: f.fieldId, op: f.op, valueLabel: labelOf(f.fieldId, f.value) };
    return { key: f.fieldId, op: f.op, value: f.value };
  };
  return {
    key: newId('tpl'),
    name: tracker.name,
    icon: tracker.icon,
    description: tracker.description,
    titleKey: tracker.settings?.titleFieldId,
    fields: tracker.fields.map((f) => ({
      key: f.id,
      name: f.name,
      type: f.type,
      required: f.required,
      config: clone(f.config || {}),
      default: ['select', 'multiselect'].includes(f.type) ? (isMultiValued(f) ? (f.default || []).map((id) => labelOf(f.id, id)) : labelOf(f.id, f.default)) : f.default,
    })).map((f) => (f.config.targetTrackerId ? { ...f, config: { ...f.config, targetTrackerId: null } } : f)),
    views: tracker.views.map((v) => ({
      name: v.name,
      type: v.type,
      columns: (v.config.columns || []).map((c) => c.fieldId).filter((id) => keyOf.has(id)),
      filters: (v.config.filters || []).map(filterOut).filter(Boolean),
      sorts: (v.config.sorts || []).map((s) => ({ key: s.fieldId, dir: s.dir })),
      groupBy: v.config.groupBy || null,
      boardBy: v.config.boardFieldId || null,
      dateBy: v.config.dateFieldId || null,
      startBy: v.config.startFieldId || null,
      endBy: v.config.endFieldId || null,
    })),
    widgets: (tracker.widgets || []).map((w) => ({
      type: w.type,
      title: w.title,
      config: {
        filters: (w.config.filters || []).map(filterOut).filter(Boolean),
        fieldKey: w.config.fieldId || null,
        groupKey: w.config.groupFieldId || null,
        doneKey: w.config.doneFieldId || null,
        dateKey: w.config.dateFieldId || null,
        agg: w.config.agg,
        limit: w.config.limit,
      },
    })),
    settings: { allowHierarchy: tracker.settings?.allowHierarchy, allowAttachments: tracker.settings?.allowAttachments },
    samples: [],
    userTemplate: true,
  };
}

/** Sample trackers for a fresh install — built purely from templates. */
export function buildSampleTrackers() {
  const trackers = [];
  const items = [];
  for (const key of ['books', 'movies', 'learning', 'cars']) {
    const bp = TRACKER_TEMPLATES.find((t) => t.key === key);
    const built = instantiateTemplate(bp, { withSamples: true });
    trackers.push(built.tracker);
    items.push(...built.items);
  }
  return { trackers, trackerItems: items };
}
