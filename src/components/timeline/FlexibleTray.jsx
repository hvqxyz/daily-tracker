import { formatDuration } from '../../common/time.js';
import { categoryInfo } from '../../common/model.js';
import './Timeline.css';

export function FlexibleTray({ activities, categories, onOpenActivity, onBeginPlace, dragId }) {
  return (
    <div className="flexible-tray">
      <span className="flexible-tray-label">Flexible — drag onto your day</span>
      <div className="flexible-tray-chips">
        {activities.map((activity) => {
          const category = categoryInfo(categories, activity.categoryId);
          return (
            <div
              key={activity.id}
              className={`flexible-chip${dragId === activity.id ? ' dragging' : ''}`}
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => onBeginPlace(e, activity)}
              onClick={() => onOpenActivity(activity)}
            >
              <span className="icon-emoji">{activity.icon}</span>
              <span className="flexible-chip-title">{activity.title}</span>
              <span className="flexible-chip-meta">{category?.icon} · {formatDuration(activity.duration)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
