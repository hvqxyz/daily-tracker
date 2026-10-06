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
} from '../common/store.js';
import { todayKey, formatDayHeading, formatDateDMY } from '../common/time.js';
import { dayStateForDate, categoryInfo } from '../common/model.js';
import { DateCarousel } from '../components/nav/DateCarousel.jsx';
import { Timeline } from '../components/timeline/Timeline.jsx';
import { CapacityBanner } from '../components/timeline/CapacityBanner.jsx';
import { DailyReview } from '../components/timeline/DailyReview.jsx';
import { ActivityEditor } from '../components/timeline/ActivityEditor.jsx';
import { ActivityQuickActions } from '../components/timeline/ActivityQuickActions.jsx';
import { SeriesScopeModal } from '../components/timeline/SeriesScopeModal.jsx';
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

  const [editorState, setEditorState] = useState(null); // { activity, defaultStart } | null
  const [quickActivity, setQuickActivity] = useState(null); // activity | null
  const [updateItemId, setUpdateItemId] = useState(null); // linked tracker item to update after completing
  const [scope, setScope] = useState(null); // { kind: 'edit'|'delete', activity, patch }
  const [learned, setLearned] = useState(null); // { activity, notes, item } — capture what was learned
  const liveQuick = quickActivity ? activities.find((a) => a.id === quickActivity.id) || quickActivity : null;

  const plannedMinutes = activities.reduce((sum, a) => sum + a.duration, 0);
  const availableMinutes = state.settings.wakingHoursMinutes;

  function openNew(defaultStart) {
    setEditorState({ activity: null, defaultStart, key: `new-${Date.now()}` });
  }

  function openExisting(activity) {
    setQuickActivity(activity);
  }

  function closeQuickActions() {
    setQuickActivity(null);
  }

  function handleQuickStatusChange(status) {
    setActivityStatus(selectedDate, liveQuick.id, status);
    if (status === 'completed') {
      const item = liveQuick.link ? ctx.itemById(liveQuick.link.itemId) : null;
      // Knowledge this activity points at, directly or through its tracker item.
      const candidates = [];
      const direct = liveQuick.noteId && state.notes.find((n) => n.id === liveQuick.noteId && !n.archived);
      if (direct) candidates.push(direct);
      if (item) for (const n of state.notes) if (!n.archived && n.trackerItemIds.includes(item.id) && !candidates.includes(n)) candidates.push(n);
      if (candidates.length > 0) setLearned({ activity: liveQuick, notes: candidates, item });
      else if (item) setUpdateItemId(item.id);
    }
    closeQuickActions();
  }

  function handleQuickEdit() {
    setEditorState({ activity: liveQuick, defaultStart: null, key: liveQuick.id });
    closeQuickActions();
  }

  function handleQuickDelete() {
    const target = liveQuick;
    closeQuickActions();
    if (ruleOf(target)) setScope({ kind: 'delete', activity: target }); // ask: this one, following, or the series
    else deleteActivity(selectedDate, target.id);
  }

  function closeEditor() {
    setEditorState(null);
  }

  const ruleOf = (activity) => (activity?.recurrenceId ? state.recurrences.find((r) => r.id === activity.recurrenceId) : null);

  function handleSubmit(patch) {
    const { repeat, ...fields } = patch;
    const editing = editorState.activity;
    if (!editing) {
      if (repeat) addRecurringActivity(selectedDate, fields, repeat);
      else addActivity(selectedDate, fields);
    } else if (editorState.series) {
      updateSeries(editorState.series.id, fields, repeat);
    } else if (ruleOf(editing)) {
      setScope({ kind: 'edit', activity: editing, patch: fields });
      return; // the editor stays open until a scope is chosen
    } else {
      updateActivity(selectedDate, editing.id, fields);
    }
    closeEditor();
  }

  function handleDelete() {
    const editing = editorState.activity;
    if (editorState.series) {
      if (window.confirm(`Delete the recurring activity "${editorState.series.title}"? Past days are kept.`)) deleteRecurrence(editorState.series.id);
    } else if (ruleOf(editing)) {
      setScope({ kind: 'delete', activity: editing });
      return;
    } else if (editing) {
      deleteActivity(selectedDate, editing.id);
    }
    closeEditor();
  }

  function chooseScope(choice) {
    const { kind, activity, patch } = scope;
    const ruleId = activity.recurrenceId;
    const from = occDate(activity, selectedDate);
    if (kind === 'edit') {
      if (choice === 'following') splitSeriesFrom(ruleId, from, patch);
      else if (choice === 'series') updateSeries(ruleId, patch);
      // the occurrence you edited always takes exactly what you entered (incl. links/notes)
      updateActivity(selectedDate, activity.id, patch);
    } else if (choice === 'occurrence') deleteActivity(selectedDate, activity.id);
    else if (choice === 'following') deleteSeriesFrom(ruleId, from);
    else deleteRecurrence(ruleId);
    setScope(null);
    closeEditor();
  }

  function editSeries() {
    const rule = ruleOf(liveQuick);
    if (!rule) return;
    setEditorState({ activity: { ...rule, id: null }, series: rule, defaultStart: null, key: `series-${rule.id}` });
    closeQuickActions();
  }

  function togglePause() {
    const rule = ruleOf(liveQuick);
    if (!rule) return;
    if (rule.pausedFrom) resumeSeries(rule.id);
    else pauseSeries(rule.id, occDate(liveQuick, selectedDate));
    closeQuickActions();
  }

  function handleMoveToDay(targetDate) {
    if (editorState.activity) moveActivityToDay(selectedDate, editorState.activity.id, targetDate);
    closeEditor();
  }

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
        onOpenActivity={openExisting}
        onQuickAddAt={openNew}
      />

      {dayState !== 'draft' && <DailyReview dateKey={selectedDate} activities={activities} categories={state.categories} wellbeing={day.wellbeing ?? null} note={day.note || ''} />}

      {quickActivity && (
        <ActivityQuickActions
          activity={liveQuick}
          dateKey={selectedDate}
          series={(() => { const r = ruleOf(liveQuick); return r ? { text: describeRule(r, formatDateDMY), paused: Boolean(r.pausedFrom) } : null; })()}
          onEditSeries={editSeries}
          onTogglePause={togglePause}
          linked={(() => { const item = liveQuick.link ? ctx.itemById(liveQuick.link.itemId) : null; const tr = item && ctx.trackerById(item.trackerId); return item && tr ? { item, tracker: tr } : null; })()}
          trackers={state.trackers}
          trackerItems={state.trackerItems}
          itemLabel={ctx.itemLabel}
          onLink={(trackerId, itemId) => updateActivity(selectedDate, liveQuick.id, { link: { trackerId, itemId }, title: ctx.itemLabel(itemId) })}
          category={categoryInfo(state.categories, liveQuick.categoryId)}
          noteLabel={liveQuick.noteId ? (() => { const n = state.notes.find((x) => x.id === liveQuick.noteId); return n ? `${n.icon || '📝'} ${noteTitle(n)}` : null; })() : null}
          onOpenNote={liveQuick.noteId ? () => { requestNav({ page: 'notes', noteId: liveQuick.noteId }); } : null}
          linkedLabel={liveQuick.link && ctx.itemById(liveQuick.link.itemId) ? `${ctx.trackerById(liveQuick.link.trackerId)?.icon ?? ''} ${ctx.itemLabel(liveQuick.link.itemId)}` : null}
          onClose={closeQuickActions}
          onStatusChange={handleQuickStatusChange}
          onEdit={handleQuickEdit}
          onDelete={handleQuickDelete}
        />
      )}

      {editorState && (
        <ActivityEditor
          key={editorState.key}
          open
          onClose={closeEditor}
          activity={editorState.activity}
          defaultStart={editorState.defaultStart}
          dateKey={selectedDate}
          allowRepeat
          seriesRule={editorState.series || ruleOf(editorState.activity)}
          editingSeries={Boolean(editorState.series)}
          categories={state.categories}
          templates={state.templates}
          dictionary={state.activityDictionary}
          trackers={state.trackers}
          trackerItems={state.trackerItems}
          itemLabel={ctx.itemLabel}
          knowledge={{ state, titleOf: (id) => { const n = state.notes.find((x) => x.id === id); return n ? noteTitle(n) : 'Missing note'; } }}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          onMoveToDay={handleMoveToDay}
          allowStatusActions={false}
          allowMoveToDay={!editorState.series}
          title={editorState.series ? 'Edit recurring activity' : undefined}
        />
      )}
      {scope && <SeriesScopeModal kind={scope.kind} onChoose={chooseScope} onClose={() => setScope(null)} />}
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
