import { getAccessToken } from './auth.js';
import { findOrCreateFolder, findFileInFolder, moveFileToFolder } from './drive-api.js';

const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const SPREADSHEET_ID_KEY = 'daily-planner-spreadsheet-id';
const APP_FOLDER_NAME = 'DailyPlannerAPP';
const SPREADSHEET_NAME = 'Daily Planner Data';
const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet';

// One sheet (tab) per data type. Sync writes the whole sheet each time
// (clear + rewrite) rather than tracking per-row diffs — simple and robust
// for the data volume a personal planner produces, at the cost of a full
// rewrite per sync tick. `cols` is only used to size the clear range.
const SHEETS = {
  Categories: { header: ['Id', 'Name', 'Icon', 'Color'], cols: 'D' },
  Templates: { header: ['Id', 'Name', 'Icon'], cols: 'C' },
  TemplateItems: { header: ['Id', 'TemplateId', 'Title', 'Icon', 'CategoryId', 'Priority', 'Start', 'Duration', 'Fixed'], cols: 'I' },
  ActivityDictionary: { header: ['Id', 'Title', 'Icon', 'CategoryId', 'Priority', 'Start', 'Duration', 'Fixed'], cols: 'H' },
  Recurrences: { header: ['Id', 'Title', 'Icon', 'CategoryId', 'Priority', 'Start', 'Duration', 'Fixed', 'Type', 'Weekdays', 'Freq', 'Interval', 'MonthDay', 'StartDate', 'EndDate', 'Count', 'PausedFrom', 'ExceptDates', 'Notes', 'CreatedAt'], cols: 'T' },
  Activities: { header: ['Date', 'Id', 'Title', 'Icon', 'CategoryId', 'Priority', 'Start', 'Duration', 'PlannedStart', 'PlannedDuration', 'Fixed', 'Status', 'Notes', 'RecurrenceId', 'ActualStart', 'ActualDuration', 'CreatedAt', 'TrackerId', 'ItemId', 'NoteId', 'OccurrenceDate', 'OverridesJson'], cols: 'V' },
  DayMeta: { header: ['Date', 'MaterializedRuleIds', 'Wellbeing', 'Note'], cols: 'D' },
  Settings: { header: ['WakingHoursMinutes'], cols: 'A' },
  // Generic tracker system: the schema (fields/views/widgets/settings) is one
  // JSON cell per tracker and item values are one JSON cell per item, so adding
  // fields or whole new trackers never changes the sheet layout.
  Trackers: { header: ['Id', 'Name', 'Icon', 'Description', 'ConfigJson'], cols: 'E' },
  TrackerItems: { header: ['Id', 'TrackerId', 'ParentId', 'Archived', 'CreatedAt', 'UpdatedAt', 'ValuesJson'], cols: 'G' },
  TrackerTemplates: { header: ['Key', 'Name', 'Json'], cols: 'C' },
  // Knowledge base: one row per note, one row per block (so long notes never hit
  // the 50k-character cell limit). Version history stays on this device.
  Notes: { header: ['Id', 'Title', 'Icon', 'StatusId', 'CollectionIds', 'TagIds', 'ParentId', 'Favorite', 'Archived', 'CreatedAt', 'UpdatedAt', 'OpenedAt', 'RelationsJson', 'TrackerItemIds'], cols: 'N' },
  NoteBlocks: { header: ['Id', 'NoteId', 'Position', 'Type', 'Content', 'ConfigJson'], cols: 'F' },
  NoteCollections: { header: ['Id', 'Name', 'Icon'], cols: 'C' },
  NoteTags: { header: ['Id', 'Name'], cols: 'B' },
  NoteStatuses: { header: ['Id', 'Label', 'Icon', 'Color', 'Review'], cols: 'E' },
  NoteTemplates: { header: ['Id', 'Name', 'Icon', 'BlocksJson'], cols: 'D' },
};

let spreadsheetId = localStorage.getItem(SPREADSHEET_ID_KEY);

async function apiFetch(pathAndQuery, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/${pathAndQuery}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets error (${res.status}): ${body}`);
  }
  return res.status === 204 ? null : res.json();
}

export function getSpreadsheetUrl() {
  return spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : null;
}

let tabsChecked = false;

/** Spreadsheets created before a sheet type existed lack its tab — add any that are missing. */
async function ensureTabs() {
  if (tabsChecked) return;
  const meta = await apiFetch(`${spreadsheetId}?fields=sheets.properties.title`);
  const existing = new Set((meta.sheets || []).map((s) => s.properties.title));
  const missing = Object.keys(SHEETS).filter((title) => !existing.has(title));
  if (missing.length > 0) {
    await apiFetch(`${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }),
    });
  }
  tabsChecked = true;
}

export async function ensureSpreadsheet() {
  await findOrCreateSpreadsheet();
  await ensureTabs();
  return spreadsheetId;
}

async function findOrCreateSpreadsheet() {
  if (spreadsheetId) return spreadsheetId;

  const folderId = await findOrCreateFolder(APP_FOLDER_NAME);
  const existingId = await findFileInFolder(folderId, SPREADSHEET_NAME, SPREADSHEET_MIME);
  if (existingId) {
    spreadsheetId = existingId;
    localStorage.setItem(SPREADSHEET_ID_KEY, spreadsheetId);
    return spreadsheetId;
  }

  const created = await apiFetch('', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: SPREADSHEET_NAME },
      sheets: Object.keys(SHEETS).map((title) => ({ properties: { title } })),
    }),
  });
  await moveFileToFolder(created.spreadsheetId, folderId);

  spreadsheetId = created.spreadsheetId;
  localStorage.setItem(SPREADSHEET_ID_KEY, spreadsheetId);
  return spreadsheetId;
}

/** Clears a sheet's body and writes header + rows starting at A1. */
async function writeSheet(name, rows) {
  const { header, cols } = SHEETS[name];
  await apiFetch(`${spreadsheetId}/values/${name}!A1:${cols}100000:clear`, { method: 'POST', body: '{}' });
  await apiFetch(`${spreadsheetId}/values/${name}!A1?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [header, ...rows] }),
  });
}

async function readSheet(name) {
  const { cols } = SHEETS[name];
  const result = await apiFetch(`${spreadsheetId}/values/${name}!A2:${cols}100000?valueRenderOption=UNFORMATTED_VALUE`);
  return result.values || [];
}

const orEmpty = (v) => (v == null ? '' : v);

// A Sheets cell holds at most 50,000 characters.
const MAX_CELL = 49000;

function cellJson(value) {
  const json = JSON.stringify(value);
  if (json.length > MAX_CELL) throw new Error('A tracker or item is too large to sync to Google Sheets (over 49,000 characters). Remove some options or long text.');
  return json;
}

function cell(text) {
  if (text.length > MAX_CELL) throw new Error('A note block is too large to sync to Google Sheets (over 49,000 characters). Split it into smaller blocks.');
  return text;
}

/** Embedded files / images stay on this device; only their metadata is synced. */
function stripBlockData(config) {
  const { data, ...rest } = config;
  if (typeof rest.url === 'string' && rest.url.startsWith('data:')) delete rest.url;
  return rest;
}

/** Attachments stay on this device: only their name/size are synced, never the file data. */
function stripFileData(values) {
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    out[k] = Array.isArray(v) && v.some((x) => x && typeof x === 'object' && 'data' in x) ? v.map(({ data, ...meta }) => meta) : v;
  }
  return out;
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
const toMinutesOrNull = (v) => (v === '' || v == null ? null : Number(v));

export function stateToRows(state) {
  const categories = state.categories.map((c) => [c.id, c.name, c.icon, c.color]);

  const templates = state.templates.map((t) => [t.id, t.name, t.icon]);
  const templateItems = state.templates.flatMap((t) =>
    t.items.map((it) => [it.id, t.id, it.title, it.icon, it.categoryId, it.priority, orEmpty(it.start), it.duration, it.fixed])
  );
  const activityDictionary = (state.activityDictionary || []).map((it) => [
    it.id, it.title, it.icon, it.categoryId, it.priority, orEmpty(it.start), it.duration, it.fixed,
  ]);

  const recurrences = state.recurrences.map((r) => [
    r.id, r.title, r.icon, r.categoryId, r.priority, orEmpty(r.start), r.duration, r.fixed, r.freq, (r.weekdays || []).join(','),
    r.freq, r.interval || 1, orEmpty(r.monthDay), orEmpty(r.startDate), orEmpty(r.endDate), orEmpty(r.count), orEmpty(r.pausedFrom),
    (r.exceptDates || []).join(','), r.notes || '', r.createdAt || '',
  ]);

  const activities = Object.entries(state.days).flatMap(([date, day]) =>
    day.activities.map((a) => [
      date, a.id, a.title, a.icon, a.categoryId, a.priority, orEmpty(a.start), a.duration,
      orEmpty(a.plannedStart), a.plannedDuration, a.fixed, a.status, a.notes || '', a.recurrenceId || '',
      orEmpty(a.actualStart), orEmpty(a.actualDuration), a.createdAt || '', a.link?.trackerId || '', a.link?.itemId || '', a.noteId || '',
      a.occurrenceDate || '', a.overrides && Object.keys(a.overrides).length ? JSON.stringify(a.overrides) : '',
    ])
  );

  const dayMeta = Object.entries(state.days).map(([date, day]) => [date, (day.materializedRuleIds || []).join(','), orEmpty(day.wellbeing), day.note || '']);

  const settings = [[state.settings.wakingHoursMinutes]];

  const trackers = (state.trackers || []).map((t) => [
    t.id, t.name, t.icon || '', t.description || '',
    cellJson({ fields: t.fields, views: t.views, widgets: t.widgets, settings: t.settings, createdAt: t.createdAt }),
  ]);
  const trackerItems = (state.trackerItems || []).map((i) => [
    i.id, i.trackerId, i.parentId || '', i.archived ? 'TRUE' : '', i.createdAt || '', i.updatedAt || '', cellJson(stripFileData(i.values || {})),
  ]);
  const trackerTemplates = (state.trackerTemplates || []).map((t) => [t.key, t.name, cellJson(t)]);

  const notes = (state.notes || []).map((n) => [
    n.id, n.title || '', n.icon || '', n.statusId || '', (n.collectionIds || []).join(','), (n.tagIds || []).join(','), n.parentId || '',
    n.favorite ? 'TRUE' : '', n.archived ? 'TRUE' : '', n.createdAt || '', n.updatedAt || '', n.openedAt || '',
    cellJson(n.relations || []), (n.trackerItemIds || []).join(','),
  ]);
  const noteBlocks = (state.notes || []).flatMap((n) =>
    n.blocks.map((b, i) => [b.id, n.id, i, b.type, cell(b.content || ''), cellJson(stripBlockData(b.config || {}))])
  );
  const noteCollections = (state.noteCollections || []).map((c) => [c.id, c.name, c.icon || '']);
  const noteTags = (state.noteTags || []).map((t) => [t.id, t.name]);
  const noteStatuses = (state.noteConfig?.statuses || []).map((x) => [x.id, x.label, x.icon || '', x.color || '', x.review ? 'TRUE' : '']);
  const noteTemplates = (state.noteTemplates || []).map((t) => [t.id, t.name, t.icon || '', cellJson(t.blocks.map((b) => ({ ...b, config: stripBlockData(b.config || {}) })))]);

  return { Categories: categories, Templates: templates, TemplateItems: templateItems, ActivityDictionary: activityDictionary, Recurrences: recurrences, Activities: activities, DayMeta: dayMeta, Settings: settings, Trackers: trackers, TrackerItems: trackerItems, TrackerTemplates: trackerTemplates, Notes: notes, NoteBlocks: noteBlocks, NoteCollections: noteCollections, NoteTags: noteTags, NoteStatuses: noteStatuses, NoteTemplates: noteTemplates };
}

/** Pushes the full local state to Sheets, overwriting each sheet's contents. */
export async function pushSnapshot(state) {
  await ensureSpreadsheet();
  const rows = stateToRows(state);
  for (const name of Object.keys(SHEETS)) {
    await writeSheet(name, rows[name]);
  }
}

/** True once at least one row of real data exists remotely. */
export async function remoteHasData() {
  await ensureSpreadsheet();
  const [categories, activities] = await Promise.all([readSheet('Categories'), readSheet('Activities')]);
  return categories.length > 0 || activities.length > 0;
}

/** Pulls the full snapshot from Sheets and reconstructs local state shape. */
export async function pullSnapshot(fallback) {
  await ensureSpreadsheet();
  const rows = await Promise.all(['Categories', 'Templates', 'TemplateItems', 'ActivityDictionary', 'Recurrences', 'Activities', 'DayMeta', 'Settings', 'Trackers', 'TrackerItems', 'TrackerTemplates', 'Notes', 'NoteBlocks', 'NoteCollections', 'NoteTags', 'NoteStatuses', 'NoteTemplates'].map(readSheet));
  return rowsToState(rows, fallback);
}

/** Pure inverse of stateToRows: rebuilds local state from the rows read off each sheet. */
export function rowsToState(rows, fallback) {
  const [categoriesRows, templatesRows, itemsRows, dictionaryRows = [], recurrenceRows, activityRows, dayMetaRows, settingsRows, trackerRows, trackerItemRows, templateRows, noteRows = [], noteBlockRows = [], noteCollectionRows = [], noteTagRows = [], noteStatusRows = [], noteTemplateRows = []] = rows;

  const categories = categoriesRows.filter((r) => r[0]).map(([id, name, icon, color]) => ({ id, name, icon, color }));

  const templatesMap = new Map();
  templatesRows.filter((r) => r[0]).forEach(([id, name, icon]) => templatesMap.set(id, { id, name, icon, items: [] }));
  itemsRows.filter((r) => r[0]).forEach(([id, templateId, title, icon, categoryId, priority, start, duration, fixed]) => {
    const t = templatesMap.get(templateId);
    if (!t) return;
    t.items.push({ id, title, icon, categoryId, priority, start: toMinutesOrNull(start), duration: Number(duration), fixed: fixed === true });
  });

  const activityDictionary = dictionaryRows.filter((r) => r[0]).map(([id, title, icon, categoryId, priority, start, duration, fixed]) => ({
    id, title, icon, categoryId, priority, start: toMinutesOrNull(start), duration: Number(duration), fixed: fixed === true,
  }));

  const recurrences = recurrenceRows.filter((r) => r[0]).map(([id, title, icon, categoryId, priority, start, duration, fixed, type, weekdays, freq, interval, monthDay, startDate, endDate, count, pausedFrom, exceptDates, notes, createdAt]) => ({
    id, title, icon, categoryId, priority,
    start: toMinutesOrNull(start),
    duration: Number(duration),
    fixed: fixed === true,
    // rows written by an older version only have Type/Weekdays; the store fills the rest in
    ...(freq || type ? { freq: freq || type } : {}),
    interval: Number(interval) || 1,
    weekdays: weekdays === '' || weekdays == null ? [] : String(weekdays).split(',').filter(Boolean).map(Number),
    monthDay: monthDay === '' || monthDay == null ? null : monthDay === 'last' ? 'last' : Number(monthDay),
    ...(startDate ? { startDate: String(startDate) } : {}),
    endDate: endDate ? String(endDate) : null,
    count: count === '' || count == null ? null : Number(count),
    pausedFrom: pausedFrom ? String(pausedFrom) : null,
    exceptDates: exceptDates ? String(exceptDates).split(',').filter(Boolean) : [],
    notes: String(notes ?? ''),
    createdAt: createdAt || Date.now(),
  }));

  const days = {};
  activityRows.filter((r) => r[0] && r[1]).forEach(([date, id, title, icon, categoryId, priority, start, duration, plannedStart, plannedDuration, fixed, status, notes, recurrenceId, actualStart, actualDuration, createdAt, linkTrackerId, linkItemId, noteId, occurrenceDate, overridesJson]) => {
    if (!days[date]) days[date] = { activities: [], materializedRuleIds: [] };
    days[date].activities.push({
      id, title, icon, categoryId, priority,
      start: toMinutesOrNull(start),
      duration: Number(duration),
      plannedStart: toMinutesOrNull(plannedStart),
      plannedDuration: plannedDuration === '' || plannedDuration == null ? Number(duration) : Number(plannedDuration),
      fixed: fixed === true,
      status: status || 'planned',
      notes: notes || '',
      recurrenceId: recurrenceId || null,
      ...(actualStart !== '' && actualStart != null ? { actualStart: Number(actualStart) } : {}),
      ...(actualDuration !== '' && actualDuration != null ? { actualDuration: Number(actualDuration) } : {}),
      ...(linkTrackerId && linkItemId ? { link: { trackerId: linkTrackerId, itemId: linkItemId } } : {}),
      ...(noteId ? { noteId } : {}),
      ...(occurrenceDate ? { occurrenceDate: String(occurrenceDate) } : {}),
      ...(overridesJson ? { overrides: parseJson(overridesJson, {}) } : {}),
      createdAt: createdAt || Date.now(),
    });
  });
  dayMetaRows.filter((r) => r[0]).forEach(([date, ruleIds, wellbeing, note]) => {
    if (!days[date]) days[date] = { activities: [], materializedRuleIds: [] };
    days[date].materializedRuleIds = ruleIds ? String(ruleIds).split(',').filter(Boolean) : [];
    if (wellbeing !== '' && wellbeing != null && Number(wellbeing) >= 1) days[date].wellbeing = Number(wellbeing);
    if (note) days[date].note = String(note);
  });

  const settingsRow = settingsRows[0] || [];

  // Local attachment data is not synced; keep it for items that still exist locally.
  const localItems = new Map((fallback.trackerItems || []).map((i) => [i.id, i]));
  const trackers = trackerRows.filter((r) => r[0]).map(([id, name, icon, description, configJson]) => {
    const cfg = parseJson(configJson, {});
    return {
      id, name: String(name ?? ''), icon: icon || '📋', description: String(description ?? ''),
      fields: cfg.fields || [], views: cfg.views || [], widgets: cfg.widgets || [],
      settings: cfg.settings || {}, createdAt: cfg.createdAt || Date.now(),
    };
  });
  const trackerItems = trackerItemRows.filter((r) => r[0] && r[1]).map(([id, trackerId, parentId, archived, createdAt, updatedAt, valuesJson]) => {
    const values = parseJson(valuesJson, {});
    const local = localItems.get(id);
    if (local) {
      for (const [fid, v] of Object.entries(values)) {
        if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object' && !('data' in x))) {
          const localFiles = local.values?.[fid];
          if (Array.isArray(localFiles)) values[fid] = v.map((meta) => localFiles.find((f) => f.name === meta.name && f.data) || meta);
        }
      }
    }
    return { id, trackerId, parentId: parentId || null, archived: archived === true || archived === 'TRUE', createdAt: createdAt || Date.now(), updatedAt: updatedAt || Date.now(), values };
  });
  const trackerTemplates = templateRows.filter((r) => r[0]).map(([, , json]) => parseJson(json, null)).filter(Boolean);

  // -- knowledge base --
  const localNotes = new Map((fallback.notes || []).map((n) => [n.id, n]));
  const blocksByNote = new Map();
  noteBlockRows.filter((r) => r[0] && r[1]).forEach(([id, noteId, position, type, content, configJson]) => {
    if (!blocksByNote.has(noteId)) blocksByNote.set(noteId, []);
    blocksByNote.get(noteId).push({ pos: Number(position) || 0, block: { id, type, content: String(content ?? ''), config: parseJson(configJson, {}) } });
  });
  const splitIds = (v) => (v ? String(v).split(',').filter(Boolean) : []);
  const isTrue = (v) => v === true || v === 'TRUE';
  const notes = noteRows.filter((r) => r[0]).map(([id, title, icon, statusId, collectionIds, tagIds, parentId, favorite, archived, createdAt, updatedAt, openedAt, relationsJson, trackerItemIds]) => {
    const local = localNotes.get(id);
    const localBlocks = new Map((local?.blocks || []).map((b) => [b.id, b]));
    const blocks = (blocksByNote.get(id) || []).sort((a, b) => a.pos - b.pos).map(({ block }) => {
      const lb = localBlocks.get(block.id);
      // put locally stored file / image data back on blocks whose data was not synced
      if (lb && lb.config?.data && !block.config.data) block.config = { ...block.config, data: lb.config.data };
      if (lb && String(lb.config?.url || '').startsWith('data:') && !block.config.url) block.config = { ...block.config, url: lb.config.url };
      return block;
    });
    return {
      id, title: String(title ?? ''), icon: String(icon ?? ''), statusId: statusId || null,
      collectionIds: splitIds(collectionIds), tagIds: splitIds(tagIds), parentId: parentId || null,
      favorite: isTrue(favorite), archived: isTrue(archived),
      createdAt: createdAt || Date.now(), updatedAt: updatedAt || Date.now(), openedAt: openedAt || updatedAt || Date.now(),
      rev: (local?.rev || 0) + 1, relations: parseJson(relationsJson, []), trackerItemIds: splitIds(trackerItemIds),
      blocks: blocks.length ? blocks : [{ id: `blk_${id}`, type: 'p', content: '', config: {} }],
      versions: local?.versions || [],
    };
  });
  const remoteStatuses = noteStatusRows.filter((r) => r[0]).map(([id, label, icon, color, review]) => ({ id, label: String(label ?? ''), icon: String(icon ?? ''), color: color || '#898781', review: isTrue(review) }));
  const remoteTemplates = noteTemplateRows.filter((r) => r[0]).map(([id, name, icon, blocksJson]) => ({ id, name: String(name ?? ''), icon: String(icon ?? ''), blocks: parseJson(blocksJson, []) }));

  return {
    version: fallback.version,
    categories: categories.length ? categories : fallback.categories,
    templates: [...templatesMap.values()],
    // An empty remote dictionary never wipes local entries (e.g. first sync from an older sheet).
    activityDictionary: activityDictionary.length ? activityDictionary : fallback.activityDictionary || [],
    recurrences,
    days,
    settings: { wakingHoursMinutes: settingsRow[0] ? Number(settingsRow[0]) : fallback.settings.wakingHoursMinutes },
    // An empty remote tracker set never wipes local trackers (e.g. first sync from an older sheet).
    trackers: trackers.length ? trackers : fallback.trackers || [],
    trackerItems: trackers.length ? trackerItems : fallback.trackerItems || [],
    trackerTemplates: trackerTemplates.length ? trackerTemplates : fallback.trackerTemplates || [],
    // An empty remote notes sheet never wipes local notes.
    notes: notes.length ? notes : fallback.notes || [],
    noteCollections: notes.length ? noteCollectionRows.filter((r) => r[0]).map(([id, name, icon]) => ({ id, name: String(name ?? ''), icon: String(icon ?? '') })) : fallback.noteCollections || [],
    noteTags: notes.length ? noteTagRows.filter((r) => r[0]).map(([id, name]) => ({ id, name: String(name ?? '') })) : fallback.noteTags || [],
    noteConfig: { ...(fallback.noteConfig || {}), statuses: notes.length && remoteStatuses.length ? remoteStatuses : fallback.noteConfig?.statuses },
    noteTemplates: notes.length && remoteTemplates.length ? remoteTemplates : fallback.noteTemplates || [],
  };
}
