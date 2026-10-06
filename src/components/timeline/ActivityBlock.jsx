import { Check, Repeat, X } from 'lucide-react';
import { minutesToClock, formatDuration } from '../../common/time.js';
import './Timeline.css';

const PRIORITY_CLASS = { required: 'required', should: 'should', optional: 'optional' };

export function ActivityBlock({ activity, category, top, height, dragging, onPointerDownMove, onPointerDownResize }) {
  const isSmall = height < 46;
  const movedBy = activity.status === 'moved' && activity.plannedStart != null
    ? activity.start - activity.plannedStart
    : 0;

  return (
    <div
      className={`activity-block status-${activity.status} priority-border-${PRIORITY_CLASS[activity.priority]}${dragging ? ' dragging' : ''}${isSmall ? ' compact' : ''}`}
      style={{ top, height, touchAction: 'none' }}
      onPointerDown={onPointerDownMove}
    >
      <div className="activity-block-main">
        <div className="activity-block-title-row">
          <span className="icon-emoji">{activity.icon}</span>
          <span className="activity-block-title">{activity.title}</span>
          {activity.recurrenceId && <Repeat size={11} className="activity-repeat-icon" aria-label="Recurring" />}
          {activity.status === 'completed' && <Check size={14} className="activity-status-icon good" />}
          {activity.status === 'skipped' && <X size={14} className="activity-status-icon muted" />}
        </div>
        {!isSmall && (
          <div className="activity-block-meta">
            <span>{category?.icon} {category?.name}</span>
            <span className="dot-sep">·</span>
            <span className={`priority-label ${activity.priority}`}>{activity.priority}</span>
            <span className="dot-sep">·</span>
            <span>{minutesToClock(activity.start)} · {formatDuration(activity.duration)}</span>
          </div>
        )}
        {movedBy !== 0 && (
          <div className="activity-block-moved">{movedBy > 0 ? '+' : ''}{formatDuration(Math.abs(movedBy))} {movedBy > 0 ? 'later' : 'earlier'}</div>
        )}
      </div>
      {!activity.fixed && <span className="flexible-tag">flexible</span>}
      <div className="activity-resize-handle" onPointerDown={onPointerDownResize} />
    </div>
  );
}
