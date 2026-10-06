import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore, selectDay } from '../common/store.js';
import { todayKey, startOfWeekKey, shiftDateKey, formatDuration } from '../common/time.js';
import { Card } from '../components/Card.jsx';
import './InsightsPage.css';

function weekDates(weekStartKey) {
  return Array.from({ length: 7 }, (_, i) => shiftDateKey(weekStartKey, i));
}

export function InsightsPage({ onOpenDay }) {
  const state = useStore();
  const today = todayKey();
  const [weekStart, setWeekStart] = useState(() => startOfWeekKey(today));

  const dates = useMemo(() => weekDates(weekStart), [weekStart]);
  const days = useMemo(() => dates.map((key) => ({ key, day: selectDay(state, key) })), [dates, state]);

  const categoryTotals = useMemo(() => {
    const totals = new Map();
    days.forEach(({ day }) => {
      day.activities.forEach((a) => {
        if (a.status === 'skipped') return;
        totals.set(a.categoryId, (totals.get(a.categoryId) || 0) + a.duration);
      });
    });
    return state.categories
      .map((c) => ({ ...c, minutes: totals.get(c.id) || 0 }))
      .filter((c) => c.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
  }, [days, state.categories]);

  const maxMinutes = Math.max(...categoryTotals.map((c) => c.minutes), 1);

  const isThisWeek = weekStart === startOfWeekKey(today);
  const rangeLabel = `${new Date(`${dates[0]}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${new Date(`${dates[6]}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

  const insightText = useMemo(() => {
    if (categoryTotals.length < 2) return null;
    const most = categoryTotals[0];
    const least = categoryTotals[categoryTotals.length - 1];
    if (most.id === least.id) return null;
    return `You spent the most time on ${most.name} this week, and relatively little on ${least.name}.`;
  }, [categoryTotals]);

  return (
    <div className="insights-page">
      <Card>
        <div className="week-nav-row">
          <button type="button" className="calendar-nav-btn" onClick={() => setWeekStart(shiftDateKey(weekStart, -7))}>
            <ChevronLeft size={18} />
          </button>
          <span className="week-nav-label">{isThisWeek ? 'This week' : rangeLabel}</span>
          <button type="button" className="calendar-nav-btn" onClick={() => setWeekStart(shiftDateKey(weekStart, 7))}>
            <ChevronRight size={18} />
          </button>
        </div>

        {categoryTotals.length === 0 ? (
          <div className="empty-state">No activity logged this week yet.</div>
        ) : (
          <div className="balance-bars">
            {categoryTotals.map((c) => (
              <div className="balance-row" key={c.id}>
                <span className="balance-label">{c.icon} {c.name}</span>
                <div className="balance-track">
                  <div className="balance-fill" style={{ width: `${(c.minutes / maxMinutes) * 100}%`, background: c.color }} />
                </div>
                <span className="balance-value">{formatDuration(c.minutes)}</span>
              </div>
            ))}
          </div>
        )}

        {insightText && <p className="balance-insight">{insightText}</p>}
      </Card>

      <Card title="Week at a glance">
        <div className="week-glance-grid">
          {days.map(({ key, day }) => {
            const date = new Date(`${key}T00:00:00`);
            const nonSkipped = day.activities.filter((a) => a.status !== 'skipped');
            const completed = day.activities.filter((a) => a.status === 'completed').length;
            const pct = nonSkipped.length > 0 ? Math.round((completed / nonSkipped.length) * 100) : null;
            const uniqueCats = [...new Set(day.activities.map((a) => a.categoryId))]
              .map((id) => state.categories.find((c) => c.id === id))
              .filter(Boolean)
              .slice(0, 3);

            return (
              <button type="button" key={key} className={`week-glance-day${key === today ? ' today' : ''}`} onClick={() => onOpenDay(key)}>
                <span className="week-glance-dow">{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                <span className="week-glance-date">{date.getDate()}</span>
                <span className="week-glance-icons">{uniqueCats.map((c) => c.icon).join(' ') || '·'}</span>
                <span className="week-glance-pct">{pct != null ? `${pct}%` : '—'}</span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
