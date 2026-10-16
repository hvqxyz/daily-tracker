import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { formatDuration } from '../../common/time.js';
import './RecentActivitiesPopover.css';

/**
 * Small menu above the timeline's + button: recently scheduled activities and
 * a way into the normal "Add activity" editor. Its visibility follows focus
 * (owned by the Timeline); this component only reports Escape.
 */
export function RecentActivitiesPopover({ recent, onPick, onCreateNew, onEscape }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onEscape();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onEscape]);

  return (
    <div
      className="recent-popover"
      role="dialog"
      aria-label="Add activity"
      // keep presses here away from the timeline's drag / click-to-add handlers
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      // a mouse press here must not move focus out (that would close the menu before the click lands)
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="recent-popover-header">
        <h3 className="recent-popover-title">Add activity</h3>
        <span className="recent-popover-subtitle">Recent activities</span>
      </div>

      {recent.length === 0 ? (
        <p className="recent-popover-empty">No recent activities yet</p>
      ) : (
        <ul className="recent-popover-list">
          {recent.map((entry) => (
            <li key={entry.sourceId || entry.key}>
              <button type="button" className="recent-popover-item" onClick={() => onPick(entry)}>
                <span className="icon-emoji">{entry.icon}</span>
                <span className="recent-popover-name">{entry.title}</span>
                {entry.duration > 0 && <span className="recent-popover-duration">{formatDuration(entry.duration)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="recent-popover-divider" />
      <button type="button" className="recent-popover-create" onClick={onCreateNew}>
        <Plus size={16} /> Create new activity
      </button>
    </div>
  );
}
