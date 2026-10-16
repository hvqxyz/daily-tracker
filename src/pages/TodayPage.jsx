import { useTrackerData } from '../trackers/ui/useTrackerData.js';
import { CalendarDays } from 'lucide-react';
import { selectDay, updateActivity } from '../common/store.js';
import { todayKey, formatDayHeading } from '../common/time.js';
import { dayStateForDate } from '../common/model.js';
import { DateCarousel } from '../components/nav/DateCarousel.jsx';
import { Timeline } from '../components/timeline/Timeline.jsx';
import { CapacityBanner } from '../components/timeline/CapacityBanner.jsx';
import { DailyReview } from '../components/timeline/DailyReview.jsx';
import { useActivityEditor } from '../components/timeline/useActivityEditor.jsx';
import './TodayPage.css';

const STATE_LABEL = { draft: 'Draft', live: 'Live', actual: 'Completed' };

export function TodayPage({ selectedDate, onSelectedDateChange }) {
  const { state, ctx } = useTrackerData();
  const day = selectDay(state, selectedDate);
  const activities = day.activities;
  const today = todayKey();
  const isToday = selectedDate === today;
  const dayState = dayStateForDate(selectedDate, today);
  // the one activity editor dialog (shared with Activity → Recurring to-dos)
  const editor = useActivityEditor({ state, ctx, dateKey: selectedDate });

  const plannedMinutes = activities.reduce((sum, a) => sum + a.duration, 0);
  const availableMinutes = state.settings.wakingHoursMinutes;

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
        onOpenActivity={editor.openActivity}
        onAddAtSlot={editor.openSlot}
        onAdd={() => editor.openButton(isToday)}
      />

      {dayState !== 'draft' && <DailyReview dateKey={selectedDate} activities={activities} categories={state.categories} wellbeing={day.wellbeing ?? null} note={day.note || ''} />}

      {editor.element}
    </div>
  );
}
