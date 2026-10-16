import { useState } from 'react';
import { useTrackerData } from '../trackers/ui/useTrackerData.js';
import { UpdateLinkedItemModal } from '../trackers/ui/ActivityModals.jsx';
import { LearnedModal } from '../notes/ui/LearnedModal.jsx';
import { noteTitle } from '../notes/knowledge.js';
import { requestNav } from '../common/nav.js';
import { CalendarDays } from 'lucide-react';
import {
  selectDay,
  addActivity,
  addRecurringActivity,
  deleteRecurrence,
  deleteSeriesFrom,
  pauseSeries,
  resumeSeries,
  splitSeriesFrom,
  updateSeries,
  updateActivity,
  deleteActivity,
  setActivityStatus,
  moveActivityToDay,
  recordRecentActivity,
  addDictionaryItem,
} from '../common/store.js';
import { editorRequest } from '../common/activity-draft.js';
import { deleteActions, statusActions, submitActions } from '../common/editor-actions.js';
import { resolveRecent } from '../common/recent-activities.js';
import { todayKey, formatDayHeading, formatDateDMY, nowMinutes } from '../common/time.js';
import { dayStateForDate } from '../common/model.js';
import { DateCarousel } from '../components/nav/DateCarousel.jsx';
import { Timeline } from '../components/timeline/Timeline.jsx';
import { CapacityBanner } from '../components/timeline/CapacityBanner.jsx';
import { DailyReview } from '../components/timeline/DailyReview.jsx';
import { ActivityEditor } from '../components/timeline/ActivityEditor.jsx';
import { describeRule, occDate } from '../common/recurrence.js';
import './TodayPage.css';

const STATE_LABEL = { draft: 'Draft', live: 'Live', actual: 'Completed' };

export function TodayPage({ selectedDate, onSelectedDateChange }) {
  const { state, ctx } = useTrackerData();
  const day = selectDay(state, selectedDate);
  const activities = day.activities;
  const today = todayKey();
  const isToday = selectedDate === today;
  const dayState = dayStateForDate(selectedDate, today);

  // The activity editor: one dialog for adding and editing. `session` restarts
  // its content (e.g. occurrence -> whole series) while the dialog stays open.
  const [editorState, setEditorState] = useState(null); // { activity, preset, defaultStart, explicitSlot, series?, session } | null
  const [updateItemId, setUpdateItemId] = useState(null); // linked tracker item to update after completing
  const [learned, setLearned] = useState(null); // { activity, notes, item } — capture what was learned

  const plannedMinutes = activities.reduce((sum, a) => sum + a.duration, 0);
  const recent = resolveRecent(state.recentActivities, state.activityDictionary);
  const availableMinutes = state.settings.wakingHoursMinutes;
  const ruleOf = (activity) => (activity?.recurrenceId ? state.recurrences.find((r) => r.id === activity.recurrenceId) : null);
  const editing = editorState?.activity || null;
  // the live version of the activity being edited (it may change underneath, e.g. a drag)
  const liveEditing = editing?.id ? activities.find((a) => a.id === editing.id) || editing : editing;

  function openEditor(request, extra = {}) {
    setEditorState({ ...request, ...extra, session: `${Date.now()}` });
  }

  function closeEditor() {
    setEditorState(null);
  }

  const session = () => ({
    editing,
    series: editorState.series || null,
    rule: editorState.series ? null : ruleOf(editing),
    dateKey: selectedDate,
  });

  /** Carries out the editor's actions (common/editor-actions.js) with the store. */
  function run(actions) {
    let savedDefinitionId = null;
    let added = null;
    for (const a of actions) {
      switch (a.type) {
        case 'saveDefinition': savedDefinitionId = addDictionaryItem(a.definition).id; break;
        case 'addActivity': added = addActivity(a.dateKey, withSaved(a.fields, savedDefinitionId)); break;
        case 'addRecurring': added = addRecurringActivity(a.dateKey, withSaved(a.fields, savedDefinitionId), a.repeat); break;
        case 'recordRecent': {
          const fields = withSaved(a.fields, savedDefinitionId);
          if (added) recordRecentActivity(fields, fields.activityId);
          break;
        }
        case 'updateActivity': updateActivity(a.dateKey, a.id, withSaved(a.fields, savedDefinitionId)); break;
        case 'updateSeries': updateSeries(a.ruleId, withSaved(a.fields, savedDefinitionId), a.repeat); break;
        case 'splitSeries': splitSeriesFrom(a.ruleId, a.from, withSaved(a.fields, savedDefinitionId)); break;
        case 'deleteActivity': deleteActivity(a.dateKey, a.id); break;
        case 'deleteSeriesFrom': deleteSeriesFrom(a.ruleId, a.from); break;
        case 'deleteRecurrence': {
          const rule = state.recurrences.find((r) => r.id === a.ruleId);
          if (a.confirm && !window.confirm(`Delete the recurring activity "${rule?.title}"? Past days are kept.`)) return false;
          deleteRecurrence(a.ruleId);
          break;
        }
        case 'setStatus': setActivityStatus(a.dateKey, a.id, a.status); break;
        default: throw new Error(`Unknown editor action ${a.type}`);
      }
    }
    return true;
  }

  function handleSubmit(patch, opts) {
    if (run(submitActions(session(), patch, opts))) closeEditor();
  }

  function handleDelete(opts) {
    if (run(deleteActions(session(), opts))) closeEditor();
  }

  function handleStatusChange(status, unsavedFields) {
    const target = liveEditing;
    run(statusActions(session(), status, unsavedFields));
    closeEditor();
    if (status === 'completed') {
      const linkTo = unsavedFields?.link !== undefined ? unsavedFields.link : target.link;
      const noteId = unsavedFields?.noteId !== undefined ? unsavedFields.noteId : target.noteId;
      const item = linkTo ? ctx.itemById(linkTo.itemId) : null;
      // Knowledge this activity points at, directly or through its tracker item.
      const candidates = [];
      const direct = noteId && state.notes.find((n) => n.id === noteId && !n.archived);
      if (direct) candidates.push(direct);
      if (item) for (const n of state.notes) if (!n.archived && n.trackerItemIds.includes(item.id) && !candidates.includes(n)) candidates.push(n);
      if (candidates.length > 0) setLearned({ activity: target, notes: candidates, item });
      else if (item) setUpdateItemId(item.id);
    }
  }

  function editSeries() {
    const rule = ruleOf(editing);
    if (!rule) return;
    // same dialog, new content: the whole series instead of this occurrence
    openEditor(editorRequest.activity({ ...rule, id: null }), { series: rule });
  }

  function togglePause() {
    const rule = ruleOf(editing);
    if (!rule) return;
    if (rule.pausedFrom) resumeSeries(rule.id);
    else pauseSeries(rule.id, occDate(editing, selectedDate));
    closeEditor();
  }

  function handleMoveToDay(targetDate) {
    if (editing) moveActivityToDay(selectedDate, editing.id, targetDate);
    closeEditor();
  }

  const editingRule = editorState && !editorState.series ? ruleOf(editing) : null;
  const linkedItem = liveEditing?.link ? ctx.itemById(liveEditing.link.itemId) : null;
  const linkedTracker = linkedItem ? ctx.trackerById(linkedItem.trackerId) : null;

  return (
    <div className="today-page">
      <DateCarousel selectedDate={selectedDate} onChange={onSelectedDateChange} />

      <div className="today-heading-row">
        <div>
          <h2 className="today-heading">{formatDayHeading(selectedDate)}</h2>
          <span className={`day-state-pill ${dayState}`}>{STATE_LABEL[dayState]}</span>
        </div>
        {!isToday && (
          <button type="button" className="jump-today-btn" onClick={() => onSelectedDateChange(today)}>
            <CalendarDays size={14} /> Today
          </button>
        )}
      </div>

      <CapacityBanner availableMinutes={availableMinutes} plannedMinutes={plannedMinutes} />

      {activities.length === 0 && (
        <div className="empty-state">No activities yet — tap + to plan this day.</div>
      )}

      <Timeline
        dateKey={selectedDate}
        isToday={isToday}
        activities={activities}
        categories={state.categories}
        onSetStart={(id, minutes) => updateActivity(selectedDate, id, { start: minutes })}
        onSetDuration={(id, minutes) => updateActivity(selectedDate, id, { duration: minutes })}
        onOpenActivity={(activity) => openEditor(editorRequest.activity(activity))}
        onAddAtSlot={(minutes) => openEditor(editorRequest.slot(minutes))}
        onAdd={() => openEditor(editorRequest.button({ isToday, nowMinutes: nowMinutes() }))}
      />

      {dayState !== 'draft' && <DailyReview dateKey={selectedDate} activities={activities} categories={state.categories} wellbeing={day.wellbeing ?? null} note={day.note || ''} />}

      <ActivityEditor
        open={Boolean(editorState)}
        sessionKey={editorState?.session}
        onClose={closeEditor}
        activity={editorState?.activity}
        preset={editorState?.preset}
        defaultStart={editorState?.defaultStart}
        explicitSlot={editorState?.explicitSlot}
        recent={recent}
        dateKey={selectedDate}
        allowRepeat
        seriesRule={editorState?.series || editingRule}
        editingSeries={Boolean(editorState?.series)}
        series={editingRule ? { text: describeRule(editingRule, formatDateDMY), paused: Boolean(editingRule.pausedFrom) } : null}
        onEditSeries={editSeries}
        onTogglePause={togglePause}
        linked={linkedItem && linkedTracker ? { item: linkedItem, tracker: linkedTracker } : null}
        onOpenNote={(noteId) => { closeEditor(); requestNav({ page: 'notes', noteId }); }}
        categories={state.categories}
        templates={state.templates}
        dictionary={state.activityDictionary}
        trackers={state.trackers}
        trackerItems={state.trackerItems}
        itemLabel={ctx.itemLabel}
        knowledge={{ state, titleOf: (id) => { const n = state.notes.find((x) => x.id === id); return n ? noteTitle(n) : 'Missing note'; } }}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        onMoveToDay={handleMoveToDay}
        allowStatusActions={!editorState?.series}
        allowMoveToDay={!editorState?.series}
        title={editorState?.series ? 'Edit recurring activity' : undefined}
      />
      {learned && (
        <LearnedModal
          state={state}
          ctx={ctx}
          activity={learned.activity}
          notes={learned.notes}
          item={learned.item}
          onClose={() => { const item = learned.item; setLearned(null); if (item) setUpdateItemId(item.id); }}
        />
      )}
      {updateItemId && !learned && ctx.itemById(updateItemId) && (
        <UpdateLinkedItemModal key={updateItemId} state={state} ctx={ctx} item={ctx.itemById(updateItemId)} onClose={() => setUpdateItemId(null)} />
      )}
    </div>
  );
}

const withSaved = (fields, savedDefinitionId) => (savedDefinitionId ? { ...fields, activityId: savedDefinitionId } : fields);
