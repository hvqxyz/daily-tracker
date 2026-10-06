import { formatDuration } from '../../common/time.js';
import './CapacityBanner.css';

export function CapacityBanner({ availableMinutes, plannedMinutes }) {
  const freeMinutes = availableMinutes - plannedMinutes;
  const over = freeMinutes < 0;
  const pct = Math.min(100, Math.round((plannedMinutes / Math.max(availableMinutes, 1)) * 100));

  return (
    <div className={`capacity-banner${over ? ' over' : ''}`}>
      <div className="capacity-bar-track">
        <div className="capacity-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="capacity-stats">
        <div className="capacity-stat">
          <span className="capacity-stat-value">{formatDuration(availableMinutes)}</span>
          <span className="capacity-stat-label">Available</span>
        </div>
        <div className="capacity-stat">
          <span className="capacity-stat-value">{formatDuration(plannedMinutes)}</span>
          <span className="capacity-stat-label">Planned</span>
        </div>
        <div className="capacity-stat">
          <span className={`capacity-stat-value${over ? ' critical' : ''}`}>
            {over ? '−' : ''}{formatDuration(Math.abs(freeMinutes))}
          </span>
          <span className="capacity-stat-label">{over ? 'Over' : 'Free'}</span>
        </div>
      </div>
      {over && (
        <p className="capacity-warning">⚠️ You're planning {formatDuration(Math.abs(freeMinutes))} more than available</p>
      )}
    </div>
  );
}
