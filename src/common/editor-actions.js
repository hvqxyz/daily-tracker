// What saving / deleting / marking in the activity editor does to the data,
// as a list of plain actions. TodayPage carries them out with the store;
// keeping the decisions here makes them testable without React or storage.
//
// session: {
//   editing:  the scheduled activity being edited, or null when adding
//   series:   the recurrence rule when the whole series is being edited
//   rule:     the rule the edited activity belongs to (null for one-offs)
//   dateKey:  the day shown
// }

import { definitionFromFields } from './activity-draft.js';
import { occDate } from './recurrence.js';

/**
 * Adding: optionally save the definition first (only when asked), then the
 * activity or recurring rule, then remember it under Recent. Editing: the
 * occurrence, the series, or "this and following" as chosen.
 */
export function submitActions(session, patch, { saveToLibrary = false, scope = null } = {}) {
  const { repeat, ...fields } = patch;
  const { editing, series, rule, dateKey } = session;
  if (!editing) {
    return [
      ...(saveToLibrary ? [{ type: 'saveDefinition', definition: definitionFromFields(fields) }] : []),
      repeat ? { type: 'addRecurring', dateKey, fields, repeat } : { type: 'addActivity', dateKey, fields },
      { type: 'recordRecent', fields },
    ];
  }
  // turning an edited activity into a library entry, when asked
  const save = saveToLibrary ? [{ type: 'saveDefinition', definition: definitionFromFields(fields) }] : [];
  if (series) return [...save, { type: 'updateSeries', ruleId: series.id, fields, repeat: repeat ?? null }];
  if (rule) {
    if (!scope) throw new Error('A recurring occurrence needs a scope: occurrence, following or series.');
    const from = occDate(editing, dateKey);
    return [
      ...save,
      ...(scope === 'following' ? [{ type: 'splitSeries', ruleId: rule.id, from, fields }] : []),
      ...(scope === 'series' ? [{ type: 'updateSeries', ruleId: rule.id, fields, repeat: null }] : []),
      // the occurrence you edited always takes exactly what you entered (incl. links / notes)
      { type: 'updateActivity', dateKey, id: editing.id, fields },
    ];
  }
  return [...save, { type: 'updateActivity', dateKey, id: editing.id, fields }];
}

export function deleteActions(session, { scope = null } = {}) {
  const { editing, series, rule, dateKey } = session;
  if (series) return [{ type: 'deleteRecurrence', ruleId: series.id, confirm: true }];
  if (!editing) return [];
  if (rule) {
    if (!scope) throw new Error('A recurring occurrence needs a scope: occurrence, following or series.');
    if (scope === 'occurrence') return [{ type: 'deleteActivity', dateKey, id: editing.id }];
    if (scope === 'following') return [{ type: 'deleteSeriesFrom', ruleId: rule.id, from: occDate(editing, dateKey) }];
    return [{ type: 'deleteRecurrence', ruleId: rule.id }];
  }
  return [{ type: 'deleteActivity', dateKey, id: editing.id }];
}

/** Done / Skip / Reset; edits made in the form first land on this occurrence. */
export function statusActions(session, status, unsavedFields = null) {
  const { editing, dateKey } = session;
  return [
    ...(unsavedFields ? [{ type: 'updateActivity', dateKey, id: editing.id, fields: unsavedFields }] : []),
    { type: 'setStatus', dateKey, id: editing.id, status },
  ];
}
