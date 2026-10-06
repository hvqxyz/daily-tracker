import { CalendarDays, LayoutTemplate, BarChart3, Settings, Sun, Activity, NotebookPen, Plus } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/** The application menu: always visible at the top, icon + small label per section. */
export function TopNav({ page, onChange, onQuickNote }) {
  return (
    <nav className="top-nav" aria-label="Main">
      <div className="top-nav-inner">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className="top-nav-btn"
            aria-current={page === id}
            onClick={() => onChange(id)}
          >
            <Icon size={18} strokeWidth={2} />
            <span>{label}</span>
          </button>
        ))}
        {onQuickNote && (
          <button type="button" className="top-nav-quick" onClick={onQuickNote} aria-label="Quick note (Ctrl+Shift+N)" title="Quick note (Ctrl+Shift+N)">
            <Plus size={16} strokeWidth={2.4} />
          </button>
        )}
      </div>
    </nav>
  );
}
